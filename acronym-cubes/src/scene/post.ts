import * as THREE from "three";

/**
 * Single-frame post pipeline (no temporal accumulation, no TAA):
 *   scene (MSAA, HDR, depth) → CoC + half-res colour → DoF gather (64 fixed
 *   golden-spiral taps) → full-res composite → bloom mip chain → final
 *   (ACES, vignette, sRGB, grain, ±1/255 dither) to the canvas.
 *
 * Every radius is a fraction of the frame height, so a 720p render looks like
 * a downscaled 4K render. Grain and dither hash (pixel, frame % 600): fully
 * deterministic, never Math.random().
 */
export type PostParams = {
  frame: number;
  focusDistance: number;
  /** blur strength: CoC = aperture · |z − focus| / z, in units of maxBlur */
  aperture: number;
  /** half-width (world units) of the zone around the focus that stays fully sharp */
  focusRange: number;
  /** extra blur multiplier for the foreground (in front of the focus) */
  nearScale: number;
  /** maximum blur radius as a fraction of the frame height */
  maxBlur: number;
  bloomStrength: number;
  bloomThreshold: number;
  exposure: number;
  vignette: number;
  grain: number;
  /** saturation before tone mapping (1 = unchanged) */
  saturation: number;
  /** extra darkening toward the bottom edge (0 = none) */
  bottomFalloff: number;
};

const FS_VERT = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const DEPTH_FN = /* glsl */ `
  uniform float uNear;
  uniform float uFar;
  uniform float uRange;
  uniform float uNearScale;
  float viewZ(float d) {
    return (uNear * uFar) / (uFar - d * (uFar - uNear));
  }
  // signed circle of confusion in [-1, 1]: + behind the focus, − in front
  float cocUnit(float z, float focus, float aperture) {
    float dz = z - focus;
    dz = sign(dz) * max(abs(dz) - uRange, 0.0);
    float k = aperture * dz / z;
    if (k < 0.0) k *= uNearScale;
    return clamp(k, -1.0, 1.0);
  }
`;

const BLOOM_LEVELS = 6;
const DOF_TAPS = 64;

function makePass(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

function rt(w: number, h: number, opts: THREE.RenderTargetOptions = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });
}

export class PostPipeline {
  private renderer: THREE.WebGLRenderer;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private w = 0;
  private h = 0;
  private main!: THREE.WebGLRenderTarget;
  private half!: THREE.WebGLRenderTarget;
  private dof!: THREE.WebGLRenderTarget;
  private comp!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];

  private cocMat: THREE.ShaderMaterial;
  private dofMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private prefilterMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    // golden-angle spiral, sorted by radius (fixed pattern → deterministic)
    const taps: THREE.Vector3[] = [];
    for (let i = 0; i < DOF_TAPS; i++) {
      const r = Math.sqrt((i + 0.5) / DOF_TAPS);
      const a = i * 2.399963229728653;
      taps.push(new THREE.Vector3(Math.cos(a), Math.sin(a), r));
    }

    this.cocMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uTexel;      // full-res texel
      uniform float uFocus;
      uniform float uAperture;
      uniform float uMaxCoc;     // in half-res pixels
      ${DEPTH_FN}
      float coc(vec2 uv) {
        float z = viewZ(texture(tDepth, uv).r);
        return cocUnit(z, uFocus, uAperture) * uMaxCoc;
      }
      void main() {
        vec2 o = uTexel * 0.5;
        vec3 c = texture(tColor, vUv + vec2(-o.x, -o.y)).rgb
               + texture(tColor, vUv + vec2( o.x, -o.y)).rgb
               + texture(tColor, vUv + vec2(-o.x,  o.y)).rgb
               + texture(tColor, vUv + vec2( o.x,  o.y)).rgb;
        // the CoC that wins is the one closest to the camera (most negative)
        float k = min(min(coc(vUv + vec2(-o.x, -o.y)), coc(vUv + vec2(o.x, -o.y))),
                      min(coc(vUv + vec2(-o.x, o.y)), coc(vUv + vec2(o.x, o.y))));
        float kc = coc(vUv);
        outColor = vec4(c * 0.25, abs(k) > abs(kc) ? k : kc);
      }`,
      {
        tColor: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uFocus: { value: 10 },
        uAperture: { value: 1 },
        uMaxCoc: { value: 8 },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uRange: { value: 0 },
        uNearScale: { value: 1 },
      },
    );

    this.dofMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tHalf;
      uniform vec2 uTexel;       // half-res texel
      uniform float uMaxCoc;     // half-res pixels
      uniform vec3 uTaps[${DOF_TAPS}];
      void main() {
        vec4 c = texture(tHalf, vUv);
        vec3 acc = c.rgb;
        float tot = 1.0;
        float cc = abs(c.a);
        float spacing = uMaxCoc / sqrt(float(${DOF_TAPS}));
        for (int i = 0; i < ${DOF_TAPS}; i++) {
          vec3 t = uTaps[i];
          float r = t.z * uMaxCoc;
          vec4 s = texture(tHalf, vUv + t.xy * r * uTexel);
          float ss = abs(s.a);
          // a sample behind the centre may not spill over a sharper centre
          if (s.a > c.a) ss = min(ss, cc * 2.0);
          float m = smoothstep(r - spacing, r + spacing * 0.5, ss);
          acc += mix(acc / tot, s.rgb, m);
          tot += 1.0;
        }
        outColor = vec4(acc / tot, c.a);
      }`,
      {
        tHalf: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uMaxCoc: { value: 8 },
        uTaps: { value: taps },
      },
    );

    this.compMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tDof;
      uniform float uFocus;
      uniform float uAperture;
      uniform float uMaxCoc;     // in full-res pixels
      ${DEPTH_FN}
      void main() {
        vec3 sharp = texture(tColor, vUv).rgb;
        vec3 blur = texture(tDof, vUv).rgb;
        float z = viewZ(texture(tDepth, vUv).r);
        float k = abs(cocUnit(z, uFocus, uAperture) * uMaxCoc);
        outColor = vec4(mix(sharp, blur, smoothstep(0.7, 2.6, k)), 1.0);
      }`,
      {
        tColor: { value: null },
        tDepth: { value: null },
        tDof: { value: null },
        uFocus: { value: 10 },
        uAperture: { value: 1 },
        uMaxCoc: { value: 16 },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uRange: { value: 0 },
        uNearScale: { value: 1 },
      },
    );

    // 13-tap downsample (Jimenez 2014); first level with soft threshold
    const down13 = /* glsl */ `
      vec3 down13(sampler2D t, vec2 uv, vec2 tx) {
        vec3 a = texture(t, uv + tx * vec2(-2.0, -2.0)).rgb;
        vec3 b = texture(t, uv + tx * vec2( 0.0, -2.0)).rgb;
        vec3 c = texture(t, uv + tx * vec2( 2.0, -2.0)).rgb;
        vec3 d = texture(t, uv + tx * vec2(-1.0, -1.0)).rgb;
        vec3 e = texture(t, uv + tx * vec2( 1.0, -1.0)).rgb;
        vec3 f = texture(t, uv + tx * vec2(-2.0,  0.0)).rgb;
        vec3 g = texture(t, uv).rgb;
        vec3 h = texture(t, uv + tx * vec2( 2.0,  0.0)).rgb;
        vec3 i = texture(t, uv + tx * vec2(-1.0,  1.0)).rgb;
        vec3 j = texture(t, uv + tx * vec2( 1.0,  1.0)).rgb;
        vec3 k = texture(t, uv + tx * vec2(-2.0,  2.0)).rgb;
        vec3 l = texture(t, uv + tx * vec2( 0.0,  2.0)).rgb;
        vec3 m = texture(t, uv + tx * vec2( 2.0,  2.0)).rgb;
        vec3 o = (d + e + i + j) * 0.125;
        o += (a + b + g + f) * 0.03125;
        o += (b + c + h + g) * 0.03125;
        o += (f + g + l + k) * 0.03125;
        o += (g + h + m + l) * 0.03125;
        return o;
      }`;
    this.prefilterMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uThreshold;
      ${down13}
      void main() {
        vec3 c = down13(tSrc, vUv, uTexel);
        float br = max(c.r, max(c.g, c.b));
        float knee = uThreshold * 0.5;
        float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 1e-4);
        float w = max(soft, br - uThreshold) / max(br, 1e-4);
        outColor = vec4(c * w, 1.0);
      }`,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 } },
    );
    this.downMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      ${down13}
      void main() { outColor = vec4(down13(tSrc, vUv, uTexel), 1.0); }`,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    );
    this.upMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tSrc;    // lower (smaller) level, upsampled with a tent
      uniform sampler2D tBase;   // same-size level of the down chain
      uniform vec2 uTexel;       // texel of tSrc
      void main() {
        vec2 t = uTexel;
        vec3 s = texture(tSrc, vUv + vec2(-t.x, -t.y)).rgb
               + texture(tSrc, vUv + vec2( 0.0, -t.y)).rgb * 2.0
               + texture(tSrc, vUv + vec2( t.x, -t.y)).rgb
               + texture(tSrc, vUv + vec2(-t.x,  0.0)).rgb * 2.0
               + texture(tSrc, vUv).rgb * 4.0
               + texture(tSrc, vUv + vec2( t.x,  0.0)).rgb * 2.0
               + texture(tSrc, vUv + vec2(-t.x,  t.y)).rgb
               + texture(tSrc, vUv + vec2( 0.0,  t.y)).rgb * 2.0
               + texture(tSrc, vUv + vec2( t.x,  t.y)).rgb;
        outColor = vec4(texture(tBase, vUv).rgb + s / 16.0, 1.0);
      }`,
      { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() } },
    );

    this.finalMat = makePass(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tComp;
      uniform sampler2D tBloom;
      uniform float uBloom;
      uniform float uExposure;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uSat;
      uniform float uBottom;
      uniform float uFrame;
      uniform vec2 uRes;
      uvec3 pcg3d(uvec3 v) {
        v = v * 1664525u + 1013904223u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        v ^= v >> 16u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        return v;
      }
      vec3 aces(vec3 x) {
        const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec3 c = texture(tComp, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(lum), c, uSat), 0.0);
        c = aces(c * uExposure);
        vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        c *= 1.0 - uVignette * smoothstep(0.35, 1.15, length(p));
        c *= 1.0 - uBottom * smoothstep(0.55, 1.0, 1.0 - vUv.y);
        c = toSRGB(c);
        uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame)));
        vec3 r = vec3(h) / 4294967295.0;
        // grain: monochrome, ±uGrain, fixed function of (pixel, frame % 600)
        c += (r.x - 0.5) * 2.0 * uGrain;
        // ±1/255 triangular dither
        c += (r.y + r.z - 1.0) / 255.0;
        outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
      {
        tComp: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0.6 },
        uExposure: { value: 1 },
        uVignette: { value: 0.4 },
        uGrain: { value: 0.015 },
        uSat: { value: 1 },
        uBottom: { value: 0 },
        uFrame: { value: 0 },
        uRes: { value: new THREE.Vector2() },
      },
    );
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.main = rt(w, h, { samples: 4, depthBuffer: true, depthTexture });
    const hw = Math.max(1, Math.round(w / 2));
    const hh = Math.max(1, Math.round(h / 2));
    this.half = rt(hw, hh);
    this.dof = rt(hw, hh);
    this.comp = rt(w, h);
    this.down = [];
    this.up = [];
    let lw = hw;
    let lh = hh;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.down.push(rt(lw, lh));
      this.up.push(rt(lw, lh));
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
    }
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  /** Optional stage timer (profiling only): called after each stage. */
  public mark: ((stage: string) => void) | null = null;

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: PostParams) {
    const r = this.renderer;
    const { w, h } = this;
    r.setRenderTarget(this.main);
    r.clear(true, true, true);
    r.render(scene, camera);
    this.mark?.("scene");

    const maxCocFull = p.maxBlur * h;
    const maxCocHalf = maxCocFull / 2;

    const coc = this.cocMat.uniforms;
    coc.tColor.value = this.main.texture;
    coc.tDepth.value = this.main.depthTexture;
    coc.uTexel.value.set(1 / w, 1 / h);
    coc.uFocus.value = p.focusDistance;
    coc.uAperture.value = p.aperture;
    coc.uMaxCoc.value = maxCocHalf;
    coc.uNear.value = camera.near;
    coc.uFar.value = camera.far;
    coc.uRange.value = p.focusRange;
    coc.uNearScale.value = p.nearScale;
    this.pass(this.cocMat, this.half);

    const dof = this.dofMat.uniforms;
    dof.tHalf.value = this.half.texture;
    dof.uTexel.value.set(1 / this.half.width, 1 / this.half.height);
    dof.uMaxCoc.value = maxCocHalf;
    this.pass(this.dofMat, this.dof);

    const comp = this.compMat.uniforms;
    comp.tColor.value = this.main.texture;
    comp.tDepth.value = this.main.depthTexture;
    comp.tDof.value = this.dof.texture;
    comp.uFocus.value = p.focusDistance;
    comp.uAperture.value = p.aperture;
    comp.uMaxCoc.value = maxCocFull;
    comp.uNear.value = camera.near;
    comp.uFar.value = camera.far;
    comp.uRange.value = p.focusRange;
    comp.uNearScale.value = p.nearScale;
    this.pass(this.compMat, this.comp);
    this.mark?.("dof");

    // bloom: prefilter into level 0 (half res), then down, then up
    const pf = this.prefilterMat.uniforms;
    pf.tSrc.value = this.comp.texture;
    pf.uTexel.value.set(1 / w, 1 / h);
    pf.uThreshold.value = p.bloomThreshold;
    this.pass(this.prefilterMat, this.down[0]);
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      const d = this.downMat.uniforms;
      d.tSrc.value = this.down[i - 1].texture;
      d.uTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
      this.pass(this.downMat, this.down[i]);
    }
    let src = this.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      const u = this.upMat.uniforms;
      u.tSrc.value = src.texture;
      u.tBase.value = this.down[i].texture;
      u.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.upMat, this.up[i]);
      src = this.up[i];
    }

    this.mark?.("bloom");
    const f = this.finalMat.uniforms;
    f.tComp.value = this.comp.texture;
    f.tBloom.value = this.up[0].texture;
    f.uBloom.value = p.bloomStrength / BLOOM_LEVELS;
    f.uExposure.value = p.exposure;
    f.uVignette.value = p.vignette;
    f.uGrain.value = p.grain;
    f.uSat.value = p.saturation;
    f.uBottom.value = p.bottomFalloff;
    f.uFrame.value = p.frame;
    f.uRes.value.set(w, h);
    this.pass(this.finalMat, null);
    this.mark?.("final");
  }

  dispose() {
    [this.main, this.half, this.dof, this.comp, ...this.down, ...this.up].forEach((t) => t?.dispose());
  }
}
