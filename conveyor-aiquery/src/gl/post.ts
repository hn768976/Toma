import * as THREE from "three";

// Fullscreen triangle helper for post passes.
export class FullscreenPass {
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  run(gl: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }
}

export const makeRT = (w: number, h: number, opts: { type?: THREE.TextureDataType; samples?: number; depth?: boolean; format?: THREE.PixelFormat; filter?: THREE.MagnificationTextureFilter } = {}) => {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: opts.type ?? THREE.HalfFloatType,
    format: opts.format ?? THREE.RGBAFormat,
    samples: opts.samples ?? 0,
    depthBuffer: !!opts.depth,
    minFilter: opts.filter ?? THREE.LinearFilter,
    magFilter: opts.filter ?? THREE.LinearFilter,
    generateMipmaps: false,
  });
  if (opts.depth) {
    rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height, THREE.FloatType);
  }
  return rt;
};

export const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const shader = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    glslVersion: null,
  });

// Shared GLSL helpers. Every "random" value here is a fixed function of the
// pixel position (and, for grain, the frame number), so passes are stable.
export const COMMON = /* glsl */ `
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 acesFilm(vec3 x) {
  // Stephen Hill's fit of the ACES RRT+ODT.
  const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = m1 * x;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(m2 * (a / b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;

// --- Bloom: threshold, a 5-level down/up chain (fixed taps). -------------
export class Bloom {
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private prefilter: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  constructor(w: number, h: number, private levels = 5, threshold = 1.0, knee = 0.6) {
    let cw = w / 2, ch = h / 2;
    for (let i = 0; i < levels; i++) {
      this.down.push(makeRT(cw, ch));
      this.up.push(makeRT(cw, ch));
      cw /= 2; ch /= 2;
    }
    this.prefilter = shader(`
      uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold; uniform float knee; varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.0);
        c += texture2D(tSrc, vUv + texel * vec2(-1.0,-1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0,-1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0, 1.0)).rgb;
        c *= 0.25;
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 1e-4);
        float contrib = max(soft, br - threshold) / max(br, 1e-4);
        gl_FragColor = vec4(c * contrib, 1.0);
      }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: threshold }, knee: { value: knee } });
    this.downMat = shader(`
      uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += texture2D(tSrc, vUv + texel * vec2(-1.0,-1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0,-1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0, 1.0)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0);
      }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.upMat = shader(`
      uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 texel; varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.0);
        c += texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb * 2.0;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0, 0.0)).rgb * 2.0;
        c += texture2D(tSrc, vUv + texel * vec2( 0.0,-1.0)).rgb * 2.0;
        c += texture2D(tSrc, vUv + texel * vec2( 0.0, 1.0)).rgb * 2.0;
        c += texture2D(tSrc, vUv + texel * vec2(-1.0,-1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0,-1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + texel * vec2( 1.0, 1.0)).rgb;
        gl_FragColor = vec4(c / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
      }`, { tSrc: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() } });
  }
  // Returns the half-res bloom texture (sum of all levels).
  run(gl: THREE.WebGLRenderer, fs: FullscreenPass, src: THREE.Texture, srcW: number, srcH: number): THREE.Texture {
    this.prefilter.uniforms.tSrc.value = src;
    this.prefilter.uniforms.texel.value.set(0.5 / srcW, 0.5 / srcH);
    fs.run(gl, this.prefilter, this.down[0]);
    for (let i = 1; i < this.levels; i++) {
      const s = this.down[i - 1];
      this.downMat.uniforms.tSrc.value = s.texture;
      this.downMat.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      fs.run(gl, this.downMat, this.down[i]);
    }
    let cur = this.down[this.levels - 1].texture;
    for (let i = this.levels - 2; i >= 0; i--) {
      const s = this.down[i + 1];
      this.upMat.uniforms.tSrc.value = cur;
      this.upMat.uniforms.tAdd.value = this.down[i].texture;
      this.upMat.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      fs.run(gl, this.upMat, this.up[i]);
      cur = this.up[i].texture;
    }
    return cur;
  }
}

// --- Depth of field: gather with a fixed golden-angle disc pattern. -------
// Input: colour (rgb) + signed circle of confusion in pixels (a; <0 = near).
// Runs at half resolution; the composite pass blends it with the sharp image.
export const DOF_TAPS = 96;
export const makeDofDownsample = () =>
  shader(`
    uniform sampler2D tSrc; uniform vec2 texel; uniform float cocScale; varying vec2 vUv;
    void main(){
      // 4x4 bilinear taps cover up to a 4x reduction
      vec3 acc = vec3(0.0); float ws = 0.0; float nearC = 0.0; float sumC = 0.0;
      for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
        vec4 s = texture2D(tSrc, vUv + texel * (vec2(float(i), float(j)) - 1.5));
        // in-focus pixels barely feed the blur buffer (they are taken sharp
        // from full res later); this keeps them from spreading as speckle
        float w = 0.02 + smoothstep(0.5, 3.0, abs(s.a));
        acc += s.rgb * w; ws += w;
        nearC = min(nearC, s.a);
        sumC += s.a;
      }
      float avgC = sumC / 16.0;
      gl_FragColor = vec4(acc / ws, (nearC < -1.0 ? nearC : avgC) * cocScale);
    }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, cocScale: { value: 0.5 } });

export const makeDofGather = () =>
  shader(`
    ${COMMON}
    #define TAPS ${DOF_TAPS}
    uniform sampler2D tSrc; uniform vec2 texel; uniform float maxCoc; uniform float cocScale; varying vec2 vUv;
    void main(){
      vec4 center = texture2D(tSrc, vUv);
      center.a *= cocScale;
      float cc = abs(center.a);
      float tapArea = maxCoc * maxCoc / float(TAPS);
      float floorA = max(tapArea, maxCoc * maxCoc * 0.09);
      float wc = tapArea / max(cc * cc, floorA);
      vec3 acc = center.rgb * wc; float wsum = wc; float nearW = 0.0;
      float rot = ign(gl_FragCoord.xy) * 6.2831853;
      for (int i = 0; i < TAPS; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(TAPS)) * maxCoc;
        float th = fi * 2.39996323 + rot;
        vec2 off = vec2(cos(th), sin(th)) * r;
        vec4 s = texture2D(tSrc, vUv + off * texel);
        s.a *= cocScale;
        float sc = abs(s.a);
        // A background tap may not spread further than the centre's own blur,
        // so sharp foreground edges are not eaten by background bokeh.
        float eff = (s.a > center.a && s.a > 0.0) ? min(sc, cc) : sc;
        float w = clamp(eff - r + 1.0, 0.0, 1.0);
        // lens character for large discs: brighter rim (onion ring) and
        // cat-eye clipping toward the frame edges
        if (eff > 4.0) {
          float rr = r / eff;
          w *= 1.0 + 0.22 * smoothstep(0.6, 0.98, rr);
          vec2 ce = (vUv - 0.5) * vec2(1.6, 0.9);
          w *= 1.0 - smoothstep(0.85, 1.25, length(off / eff + ce));
        }
        // scatter-as-gather: a tap's light is spread over its CoC disc, so it
        // carries (area one tap represents) / (area of its disc)
        w *= tapArea / max(eff * eff, floorA);
        acc += s.rgb * w; wsum += w;
        if (s.a < -1.0 && s.a < center.a) nearW += w;
      }
      // alpha: how blurred this pixel should look (own CoC, or covered by a
      // blurred foreground object), in gather pixels
      float cover = nearW / wsum;
      gl_FragColor = vec4(acc / wsum, max(cc, cover * 6.0));
    }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, maxCoc: { value: 16 }, cocScale: { value: 0.5 } });

// 3x3 tent to smooth the gather's ring structure.
export const makeTent = () =>
  shader(`
    uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tSrc, vUv) * 4.0;
      c += (texture2D(tSrc, vUv + vec2(texel.x, 0.0)) + texture2D(tSrc, vUv - vec2(texel.x, 0.0)) + texture2D(tSrc, vUv + vec2(0.0, texel.y)) + texture2D(tSrc, vUv - vec2(0.0, texel.y))) * 2.0;
      c += texture2D(tSrc, vUv + texel) + texture2D(tSrc, vUv - texel) + texture2D(tSrc, vUv + vec2(texel.x, -texel.y)) + texture2D(tSrc, vUv + vec2(-texel.x, texel.y));
      gl_FragColor = c / 16.0;
    }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
