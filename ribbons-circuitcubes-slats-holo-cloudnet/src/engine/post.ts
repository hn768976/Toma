import * as THREE from "three";

// Deterministic post pipeline. Every pass is a pure function of the scene
// render and the uniforms set from the current frame: no history buffers,
// no TAA, no random kernels (all sample patterns are fixed formulas).

export type PostParams = {
  /** Screen-space ambient occlusion strength (0 = off). */
  ao: number;
  /** AO sampling radius in world units. */
  aoRadius: number;
  /** Colour the occlusion darkens toward (linear RGB). */
  aoTint: THREE.Color;
  /** Depth of field: focus distance in view-space units (0 = off). */
  focus: number;
  /** Max far-field blur radius as a fraction of frame height. */
  dofFar: number;
  /** Max near-field blur radius as a fraction of frame height. */
  dofNear: number;
  /** How fast blur grows away from focus (in 1/units of relative depth). */
  dofRange: number;
  bloom: number;
  bloomThreshold: number;
  bloomRadius: number;
  exposure: number;
  vignette: number;
  /** Grain amplitude (fraction of full scale, peak-to-peak/2). */
  grain: number;
  /** Saturation multiplier applied before encoding. */
  saturation: number;
};

export const defaultPost = (): PostParams => ({
  ao: 0,
  aoRadius: 0.5,
  aoTint: new THREE.Color(0, 0, 0),
  focus: 0,
  dofFar: 0.01,
  dofNear: 0.01,
  dofRange: 1,
  bloom: 0,
  bloomThreshold: 1,
  bloomRadius: 0.8,
  exposure: 1,
  vignette: 0.25,
  grain: 0.015,
  saturation: 1,
});

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DEPTH_COMMON = /* glsl */ `
uniform sampler2D tDepth;
uniform float cNear;
uniform float cFar;
uniform float cOrtho;
uniform mat4 projInv;
float viewZAt(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (cOrtho > 0.5) return -(cNear + d * (cFar - cNear));
  return (cNear * cFar) / ((cFar - cNear) * d - cFar);
}
vec3 viewPosAt(vec2 uv) {
  float z = viewZAt(uv);
  vec4 clip = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vec4 v = projInv * clip;
  v.xyz /= v.w;
  // ray through the pixel scaled to depth z
  return v.xyz * (z / v.z);
}`;

const AO_FRAG = /* glsl */ `
${DEPTH_COMMON}
uniform vec2 res;       // AO target size
uniform float radius;   // world units
uniform float projScale;// pixels per world unit at distance 1
varying vec2 vUv;
// interleaved gradient noise — a fixed formula of the pixel position
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec3 P = viewPosAt(vUv);
  if (-P.z > cFar * 0.98) { gl_FragColor = vec4(1.0); return; }
  vec2 px = 1.0 / res;
  vec3 Px = viewPosAt(vUv + vec2(px.x, 0.0));
  vec3 Py = viewPosAt(vUv + vec2(0.0, px.y));
  vec3 Pmx = viewPosAt(vUv - vec2(px.x, 0.0));
  vec3 Pmy = viewPosAt(vUv - vec2(0.0, px.y));
  vec3 dx = abs(Px.z - P.z) < abs(Pmx.z - P.z) ? Px - P : P - Pmx;
  vec3 dy = abs(Py.z - P.z) < abs(Pmy.z - P.z) ? Py - P : P - Pmy;
  vec3 N = normalize(cross(dx, dy));
  float ssR = radius * projScale / max(-P.z, 0.01);
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  const int NS = 16;
  for (int i = 0; i < NS; i++) {
    float fi = float(i);
    float a = fi * 2.3999632 + rot;
    float r = (fi + 0.5) / float(NS);
    vec2 off = vec2(cos(a), sin(a)) * r * ssR * px;
    vec3 Q = viewPosAt(vUv + off);
    vec3 v = Q - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float f = max(radius * radius - vv, 0.0) / (radius * radius);
    occ += f * max((vn - 0.01 * -P.z) / (sqrt(vv) + 0.001), 0.0);
  }
  occ = clamp(occ * 2.0 / float(NS), 0.0, 1.0);
  gl_FragColor = vec4(vec3(1.0 - occ), 1.0);
}`;

const COC_COMMON = /* glsl */ `
uniform float focus;
uniform float dofFar;
uniform float dofNear;
uniform float dofRange;
uniform float frameH;   // pixels of full-res height
// signed circle of confusion in full-res pixels (+ far, - near)
float cocAt(vec2 uv) {
  if (focus <= 0.0) return 0.0;
  float z = -viewZAt(uv);
  float rel = (z - focus) / z * dofRange;
  float c = rel > 0.0 ? min(rel, 1.0) * dofFar : max(rel, -1.0) * dofNear;
  return c * frameH;
}`;

const DOF_PREP_FRAG = /* glsl */ `
${DEPTH_COMMON}
${COC_COMMON}
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform float aoOn;
uniform float aoStrength;
uniform vec3 aoTint;
uniform vec2 srcTexel;
varying vec2 vUv;
vec3 aoColor(vec2 uv) {
  vec3 c = texture2D(tColor, uv).rgb;
  if (aoOn > 0.5) {
    float a = texture2D(tAO, uv).r;
    c = mix(c, c * aoTint, (1.0 - a) * aoStrength);
  }
  return c;
}
void main() {
  vec3 c = 0.25 * (aoColor(vUv + srcTexel * vec2(-0.5, -0.5)) + aoColor(vUv + srcTexel * vec2(0.5, -0.5))
       + aoColor(vUv + srcTexel * vec2(-0.5, 0.5)) + aoColor(vUv + srcTexel * vec2(0.5, 0.5)));
  float coc = cocAt(vUv) * 0.5; // in half-res pixels
  gl_FragColor = vec4(c, coc);
}`;

const DOF_GATHER_FRAG = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 texel;
uniform float maxR;  // half-res pixels
varying vec2 vUv;
void main() {
  vec4 C = texture2D(tHalf, vUv);
  float cc = abs(C.a);
  vec3 acc = C.rgb;
  float wsum = 1.0;
  const int NS = 64;
  for (int i = 0; i < NS; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / float(NS)) * maxR;
    float a = fi * 2.3999632;
    vec4 S = texture2D(tHalf, vUv + vec2(cos(a), sin(a)) * r * texel);
    float sc = abs(S.a);
    // background must not bleed over a sharper foreground
    if (S.a > C.a) sc = min(sc, cc * 2.0 + 0.5);
    float w = clamp(sc - r + 1.0, 0.0, 1.0);
    acc += S.rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, C.a);
}`;

const TENT_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(tSrc, vUv) * 4.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 0.0)) * 2.0;
  s += texture2D(tSrc, vUv - texel * vec2(1.0, 0.0)) * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, 1.0)) * 2.0;
  s += texture2D(tSrc, vUv - texel * vec2(0.0, 1.0)) * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0));
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0));
  s += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0));
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0));
  gl_FragColor = s / 16.0;
}`;

const COMPOSITE_FRAG = /* glsl */ `
${DEPTH_COMMON}
${COC_COMMON}
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform sampler2D tBlur;
uniform float aoOn;
uniform float aoStrength;
uniform vec3 aoTint;
uniform vec2 aoTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  if (aoOn > 0.5) {
    float a = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++)
      a += texture2D(tAO, vUv + vec2(float(x), float(y)) * aoTexel * 1.5).r;
    a /= 9.0;
    c = mix(c, c * aoTint, (1.0 - a) * aoStrength);
  }
  if (focus > 0.0) {
    float coc = abs(cocAt(vUv));
    vec3 b = texture2D(tBlur, vUv).rgb;
    c = mix(c, b, smoothstep(0.6, 2.5, coc));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const BLOOM_PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
vec3 pf(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float knee = threshold * 0.5;
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - threshold) / max(br, 1e-4);
  return c * contrib;
}
void main() {
  vec3 c = pf(texture2D(tSrc, vUv + texel * vec2(-0.5, -0.5)).rgb)
         + pf(texture2D(tSrc, vUv + texel * vec2(0.5, -0.5)).rgb)
         + pf(texture2D(tSrc, vUv + texel * vec2(-0.5, 0.5)).rgb)
         + pf(texture2D(tSrc, vUv + texel * vec2(0.5, 0.5)).rgb);
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;

const DOWN13_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel; // source texel
varying vec2 vUv;
vec3 t(vec2 o) { return texture2D(tSrc, vUv + o * texel).rgb; }
void main() {
  vec3 a = t(vec2(-2.0, 2.0)), b = t(vec2(0.0, 2.0)), c = t(vec2(2.0, 2.0));
  vec3 d = t(vec2(-2.0, 0.0)), e = t(vec2(0.0, 0.0)), f = t(vec2(2.0, 0.0));
  vec3 g = t(vec2(-2.0, -2.0)), h = t(vec2(0.0, -2.0)), i = t(vec2(2.0, -2.0));
  vec3 j = t(vec2(-1.0, 1.0)), k = t(vec2(1.0, 1.0)), l = t(vec2(-1.0, -1.0)), m = t(vec2(1.0, -1.0));
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;   // smaller (already upsampled) level
uniform sampler2D tBase;  // same-size downsample level
uniform vec2 texel;       // source texel
uniform float radius;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += (texture2D(tSrc, vUv + texel * vec2(1.0, 0.0)).rgb + texture2D(tSrc, vUv - texel * vec2(1.0, 0.0)).rgb
      + texture2D(tSrc, vUv + texel * vec2(0.0, 1.0)).rgb + texture2D(tSrc, vUv - texel * vec2(0.0, 1.0)).rgb) * 2.0;
  s += texture2D(tSrc, vUv + texel).rgb + texture2D(tSrc, vUv - texel).rgb
     + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 16.0 * radius, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
precision highp int;
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform float bloom;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float saturation;
uniform float aspect;
uniform uint frameSeed;
varying vec2 vUv;
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967295.0;
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 softClip(vec3 c) {
  // linear below the knee, smooth shoulder to 1.0 above it (keeps hues saturated)
  const float k = 0.8;
  vec3 over = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * bloom;
  c *= exposure;
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  c *= 1.0 - vignette * smoothstep(0.25, 1.15, length(q));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0);
  c = toSRGB(softClip(c));
  uvec3 p = uvec3(uvec2(gl_FragCoord.xy), frameSeed);
  float g = hash3(p) - 0.5;
  float d = hash3(p + uvec3(7919u, 104729u, 1299709u)) - 0.5;
  c += g * 2.0 * grain + d * (2.0 / 255.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const makePass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

const BLOOM_LEVELS = 6;

export class PostPipeline {
  private gl: THREE.WebGLRenderer;
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private aoRT!: THREE.WebGLRenderTarget;
  private halfA!: THREE.WebGLRenderTarget;
  private halfB!: THREE.WebGLRenderTarget;
  private compRT!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mats: Record<string, THREE.ShaderMaterial>;
  private msaa: number;

  constructor(gl: THREE.WebGLRenderer, msaa = 4) {
    this.gl = gl;
    this.msaa = msaa;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const depthU = () => ({
      tDepth: { value: null },
      cNear: { value: 0.1 },
      cFar: { value: 100 },
      cOrtho: { value: 0 },
      projInv: { value: new THREE.Matrix4() },
    });
    const cocU = () => ({
      focus: { value: 0 },
      dofFar: { value: 0 },
      dofNear: { value: 0 },
      dofRange: { value: 1 },
      frameH: { value: 1 },
    });
    this.mats = {
      ao: makePass(AO_FRAG, { ...depthU(), res: { value: new THREE.Vector2() }, radius: { value: 0.5 }, projScale: { value: 1 } }),
      prep: makePass(DOF_PREP_FRAG, {
        ...depthU(),
        ...cocU(),
        tColor: { value: null },
        tAO: { value: null },
        aoOn: { value: 0 },
        aoStrength: { value: 0 },
        aoTint: { value: new THREE.Color() },
        srcTexel: { value: new THREE.Vector2() },
      }),
      gather: makePass(DOF_GATHER_FRAG, { tHalf: { value: null }, texel: { value: new THREE.Vector2() }, maxR: { value: 1 } }),
      tent: makePass(TENT_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } }),
      composite: makePass(COMPOSITE_FRAG, {
        ...depthU(),
        ...cocU(),
        tColor: { value: null },
        tAO: { value: null },
        tBlur: { value: null },
        aoOn: { value: 0 },
        aoStrength: { value: 0 },
        aoTint: { value: new THREE.Color() },
        aoTexel: { value: new THREE.Vector2() },
      }),
      prefilter: makePass(BLOOM_PREFILTER_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 } }),
      down: makePass(DOWN13_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } }),
      up: makePass(UP_FRAG, { tSrc: { value: null }, tBase: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } }),
      final: makePass(FINAL_FRAG, {
        tSrc: { value: null },
        tBloom: { value: null },
        bloom: { value: 0 },
        exposure: { value: 1 },
        vignette: { value: 0 },
        grain: { value: 0 },
        saturation: { value: 1 },
        aspect: { value: 16 / 9 },
        frameSeed: { value: 0 },
      }),
    };
  }

  private alloc(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.disposeTargets();
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.FloatType;
    this.sceneRT = rt(w, h, { depthBuffer: true, depthTexture, samples: this.msaa });
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.aoRT = rt(hw, hh);
    this.halfA = rt(hw, hh);
    this.halfB = rt(hw, hh);
    this.compRT = rt(w, h);
    this.down = [];
    this.up = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const s = 2 ** (i + 1);
      this.down.push(rt(Math.ceil(w / s), Math.ceil(h / s)));
      this.up.push(rt(Math.ceil(w / s), Math.ceil(h / s)));
    }
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  private setDepth(m: THREE.ShaderMaterial, cam: THREE.Camera) {
    const c = cam as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    m.uniforms.tDepth.value = this.sceneRT.depthTexture;
    m.uniforms.cNear.value = c.near;
    m.uniforms.cFar.value = c.far;
    m.uniforms.cOrtho.value = (c as THREE.OrthographicCamera).isOrthographicCamera ? 1 : 0;
    m.uniforms.projInv.value.copy(c.projectionMatrixInverse);
  }

  private setCoc(m: THREE.ShaderMaterial, p: PostParams) {
    m.uniforms.focus.value = p.focus;
    m.uniforms.dofFar.value = p.dofFar;
    m.uniforms.dofNear.value = p.dofNear;
    m.uniforms.dofRange.value = p.dofRange;
    m.uniforms.frameH.value = this.h;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, p: PostParams, w: number, h: number, frame: number) {
    const gl = this.gl;
    this.alloc(w, h);
    gl.autoClear = true;
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const M = this.mats;
    const aoOn = p.ao > 0;
    if (aoOn) {
      const m = M.ao;
      this.setDepth(m, camera);
      m.uniforms.res.value.set(this.aoRT.width, this.aoRT.height);
      m.uniforms.radius.value = p.aoRadius;
      const pc = camera as THREE.PerspectiveCamera;
      m.uniforms.projScale.value = (this.aoRT.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(pc.fov ?? 45) * 0.5);
      this.pass(m, this.aoRT);
    }

    const dofOn = p.focus > 0;
    if (dofOn) {
      const m = M.prep;
      this.setDepth(m, camera);
      this.setCoc(m, p);
      m.uniforms.tColor.value = this.sceneRT.texture;
      m.uniforms.tAO.value = this.aoRT.texture;
      m.uniforms.aoOn.value = aoOn ? 1 : 0;
      m.uniforms.aoStrength.value = p.ao;
      m.uniforms.aoTint.value.copy(p.aoTint);
      m.uniforms.srcTexel.value.set(1 / w, 1 / h);
      this.pass(m, this.halfA);

      const g = M.gather;
      g.uniforms.tHalf.value = this.halfA.texture;
      g.uniforms.texel.value.set(1 / this.halfA.width, 1 / this.halfA.height);
      g.uniforms.maxR.value = Math.max(p.dofFar, p.dofNear) * h * 0.5;
      this.pass(g, this.halfB);

      const t = M.tent;
      t.uniforms.tSrc.value = this.halfB.texture;
      t.uniforms.texel.value.set(1 / this.halfB.width, 1 / this.halfB.height);
      this.pass(t, this.halfA);
    }

    {
      const m = M.composite;
      this.setDepth(m, camera);
      this.setCoc(m, p);
      m.uniforms.tColor.value = this.sceneRT.texture;
      m.uniforms.tAO.value = this.aoRT.texture;
      m.uniforms.tBlur.value = this.halfA.texture;
      m.uniforms.aoOn.value = aoOn ? 1 : 0;
      m.uniforms.aoStrength.value = p.ao;
      m.uniforms.aoTint.value.copy(p.aoTint);
      m.uniforms.aoTexel.value.set(1 / this.aoRT.width, 1 / this.aoRT.height);
      this.pass(m, this.compRT);
    }

    if (p.bloom > 0) {
      const pf = M.prefilter;
      pf.uniforms.tSrc.value = this.compRT.texture;
      pf.uniforms.texel.value.set(1 / w, 1 / h);
      pf.uniforms.threshold.value = p.bloomThreshold;
      this.pass(pf, this.down[0]);
      for (let i = 1; i < BLOOM_LEVELS; i++) {
        const d = M.down;
        d.uniforms.tSrc.value = this.down[i - 1].texture;
        d.uniforms.texel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
        this.pass(d, this.down[i]);
      }
      let src = this.down[BLOOM_LEVELS - 1];
      for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
        const u = M.up;
        u.uniforms.tSrc.value = src.texture;
        u.uniforms.tBase.value = this.down[i].texture;
        u.uniforms.texel.value.set(1 / src.width, 1 / src.height);
        u.uniforms.radius.value = p.bloomRadius;
        this.pass(u, this.up[i]);
        src = this.up[i];
      }
    }

    const f = M.final;
    f.uniforms.tSrc.value = this.compRT.texture;
    f.uniforms.tBloom.value = this.up[0].texture;
    f.uniforms.bloom.value = p.bloom;
    f.uniforms.exposure.value = p.exposure;
    f.uniforms.vignette.value = p.vignette;
    f.uniforms.grain.value = p.grain;
    f.uniforms.saturation.value = p.saturation;
    f.uniforms.aspect.value = w / h;
    f.uniforms.frameSeed.value = (((frame % 600) + 600) % 600) + 1;
    this.pass(f, null);
  }

  private disposeTargets() {
    if (!this.sceneRT) return;
    this.sceneRT.depthTexture?.dispose();
    [this.sceneRT, this.aoRT, this.halfA, this.halfB, this.compRT, ...this.down, ...this.up].forEach((t) => t.dispose());
  }

  dispose() {
    this.disposeTargets();
    Object.values(this.mats).forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
