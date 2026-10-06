import * as THREE from "three";
import { linearRGB } from "./batch2d";

// Layered render pipeline (no temporal effects anywhere):
//
//   for each layer (back to front):
//     render layer scene -> 4x MSAA half-float target (premultiplied alpha)
//     depth of field:
//       "uniform": one Gaussian blur (sigma = fraction of frame height)
//       "depth":   per-pixel circle of confusion from the layer's depth
//                  buffer, blended between a stack of pre-blurred levels
//     composite "over" onto the HDR accumulation buffer
//   bloom: soft-threshold prefilter + 6-level down/up mip chain
//   final: exposure, hue-preserving shoulder tonemap, vignette, fade,
//          optional glitch, sRGB encode, then grain (~1.5%) and +-1/255
//          triangular dither, both a pure hash of (pixel, frame).

export type DepthDof = {
  focus: number; // view-space distance in focus
  band: number; // +- distance that stays sharp
  range: number; // distance over which blur ramps to max
  maxBlur: number; // sigma at full CoC, fraction of frame height
  nearMul?: number; // CoC multiplier in front of the focus band (default 1)
};

export type LayerSpec = {
  scene: THREE.Scene;
  camera?: THREE.Camera;
  blur?: number; // uniform blur sigma, fraction of frame height
  depth?: DepthDof;
  opacity?: number;
};

export type PostParams = {
  exposure?: number;
  bloom?: number;
  fade?: number;
  glitch?: number;
  vignette?: number;
  grainFrame: number; // frame index fed to the grain hash (wrapped for loops)
};

/** Optional colourway grade (see README). Absent = exact original colours. */
export type Grade = {
  hue?: number; // degrees, rotates hue around the neutral axis
  saturation?: number; // multiplier
  tint?: [number, number, number]; // linear RGB multiplier
};

export type PipelineOptions = {
  background: string;
  bloomThreshold?: number;
  bloomKnee?: number;
  bloomIntensity?: number;
  bloomRadius?: number; // 0..1, weight of wide levels
  grain?: number;
  vignette?: number;
  saturation?: number;
};

const FS_VERT = /* glsl */ `
  out vec2 vUv;
  void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const mkPass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: "precision highp float;\nlayout(location = 0) out highp vec4 fragOut;\nin vec2 vUv;\n" + frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });

const HASH_GLSL = /* glsl */ `
  uint pcg(uint v){
    uint s = v * 747796405u + 2891336453u;
    uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
    return (w >> 22u) ^ w;
  }
  float h01(uint a, uint b, uint c){
    return float(pcg(a ^ pcg(b ^ pcg(c)))) * (1.0 / 4294967296.0);
  }
`;

type RT = THREE.WebGLRenderTarget;

const rt = (w: number, h: number, extra: Partial<THREE.RenderTargetOptions> = {}): RT =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    colorSpace: THREE.NoColorSpace,
    ...extra,
  });

const gaussKernel = (sigma: number) => {
  // Linear-sampling Gaussian: pairs of taps merged into one bilinear fetch.
  const radius = Math.min(30, Math.ceil(sigma * 3));
  const w: number[] = [];
  for (let i = 0; i <= radius; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const sum = w[0] + 2 * w.slice(1).reduce((a, b) => a + b, 0);
  const offsets = [0];
  const weights = [w[0] / sum];
  for (let i = 1; i <= radius; i += 2) {
    const a = w[i];
    const b = i + 1 <= radius ? w[i + 1] : 0;
    const t = a + b;
    offsets.push(i + b / t);
    weights.push(t / sum);
  }
  return { offsets, weights };
};

const MAX_TAPS = 17;
const LEVELS = 7; // pyramid levels 0..6

// Profiling switches (input prop "perf"), never used for final renders.
export const PERF: { msaa: number; dof: boolean; bloom: boolean } = { msaa: 4, dof: true, bloom: true };

export class Pipeline {
  private gl: THREE.WebGLRenderer;
  private opts: Required<PipelineOptions>;
  private w = 0;
  private h = 0;
  private msaa!: RT;
  private single!: RT; // no MSAA: for layers that get blurred anyway
  private accum!: RT;
  private pyr: RT[] = []; // pyramid (index 0 unused: level 0 is the layer itself)
  private tmp: RT[] = [];
  private blurOut: Map<string, RT> = new Map();
  private bloomDown: RT[] = [];
  private bloomUp: RT[] = [];
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mCopy: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mBlur: THREE.ShaderMaterial;
  private mSelect: THREE.ShaderMaterial;
  private mPre: THREE.ShaderMaterial;
  private mUp: THREE.ShaderMaterial;
  private mFinal: THREE.ShaderMaterial;
  private bg: [number, number, number];

  constructor(gl: THREE.WebGLRenderer, opts: PipelineOptions) {
    this.gl = gl;
    this.opts = {
      bloomThreshold: 0.55,
      bloomKnee: 0.4,
      bloomIntensity: 0.6,
      bloomRadius: 0.6,
      grain: 0.015,
      vignette: 0.35,
      saturation: 1,
      ...opts,
    };
    this.bg = linearRGB(opts.background);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);

    this.mCopy = mkPass(
      /* glsl */ `
      uniform sampler2D t; uniform float uOpacity;
      void main(){ fragOut = texture(t, vUv) * uOpacity; }`,
      { t: { value: null }, uOpacity: { value: 1 } },
    );
    // premultiplied "over" onto the accumulation buffer
    for (const m of [this.mCopy]) {
      m.blending = THREE.CustomBlending;
      m.blendSrc = THREE.OneFactor;
      m.blendDst = THREE.OneMinusSrcAlphaFactor;
      m.blendSrcAlpha = THREE.OneFactor;
      m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    }

    this.mDown = mkPass(
      /* glsl */ `
      uniform sampler2D t; uniform vec2 uTexel;
      void main(){
        // 4 bilinear taps = 4x4 texel tent: alias-free 2x reduction
        vec4 s = texture(t, vUv + uTexel * vec2(-1.0, -1.0));
        s += texture(t, vUv + uTexel * vec2( 1.0, -1.0));
        s += texture(t, vUv + uTexel * vec2(-1.0,  1.0));
        s += texture(t, vUv + uTexel * vec2( 1.0,  1.0));
        fragOut = s * 0.25;
      }`,
      { t: { value: null }, uTexel: { value: new THREE.Vector2() } },
    );

    this.mBlur = mkPass(
      /* glsl */ `
      uniform sampler2D t; uniform vec2 uDir; uniform float uOff[${MAX_TAPS}]; uniform float uW[${MAX_TAPS}]; uniform int uN;
      void main(){
        vec4 s = texture(t, vUv) * uW[0];
        for (int i = 1; i < ${MAX_TAPS}; i++) {
          if (i >= uN) break;
          vec2 o = uDir * uOff[i];
          s += (texture(t, vUv + o) + texture(t, vUv - o)) * uW[i];
        }
        fragOut = s;
      }`,
      {
        t: { value: null },
        uDir: { value: new THREE.Vector2() },
        uOff: { value: new Array(MAX_TAPS).fill(0) },
        uW: { value: new Array(MAX_TAPS).fill(0) },
        uN: { value: 1 },
      },
    );

    this.mSelect = mkPass(
      /* glsl */ `
      uniform sampler2D t0, t1, t2, t3, t4; uniform sampler2D tDepth;
      uniform float uNear, uFar, uFocus, uBand, uRange, uNearMul, uOpacity;
      void main(){
        float d = texture(tDepth, vUv).r;
        float z = (uNear * uFar) / (uFar - d * (uFar - uNear));
        float dz = z - uFocus;
        float coc = clamp((abs(dz) - uBand) / uRange, 0.0, 1.0) * (dz < 0.0 ? uNearMul : 1.0);
        // background (no geometry) counts as fully blurred far field
        if (d >= 0.99999) coc = 1.0;
        coc = clamp(coc, 0.0, 1.0) * 4.0;
        vec4 a0 = texture(t0, vUv), a1 = texture(t1, vUv), a2 = texture(t2, vUv), a3 = texture(t3, vUv), a4 = texture(t4, vUv);
        vec4 c = mix(a0, a1, clamp(coc, 0.0, 1.0));
        c = mix(c, a2, clamp(coc - 1.0, 0.0, 1.0));
        c = mix(c, a3, clamp(coc - 2.0, 0.0, 1.0));
        c = mix(c, a4, clamp(coc - 3.0, 0.0, 1.0));
        fragOut = c * uOpacity;
      }`,
      {
        t0: { value: null },
        t1: { value: null },
        t2: { value: null },
        t3: { value: null },
        t4: { value: null },
        tDepth: { value: null },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFocus: { value: 10 },
        uBand: { value: 1 },
        uRange: { value: 5 },
        uNearMul: { value: 1 },
        uOpacity: { value: 1 },
      },
    );
    this.mSelect.blending = THREE.CustomBlending;
    this.mSelect.blendSrc = THREE.OneFactor;
    this.mSelect.blendDst = THREE.OneMinusSrcAlphaFactor;
    this.mSelect.blendSrcAlpha = THREE.OneFactor;
    this.mSelect.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;

    this.mPre = mkPass(
      /* glsl */ `
      uniform sampler2D t; uniform vec2 uTexel; uniform float uThr, uKnee;
      void main(){
        vec4 s = texture(t, vUv + uTexel * vec2(-1.0, -1.0));
        s += texture(t, vUv + uTexel * vec2( 1.0, -1.0));
        s += texture(t, vUv + uTexel * vec2(-1.0,  1.0));
        s += texture(t, vUv + uTexel * vec2( 1.0,  1.0));
        vec3 c = s.rgb * 0.25;
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee);
        soft = soft * soft / (4.0 * uKnee + 1e-5);
        float contrib = max(soft, br - uThr) / max(br, 1e-5);
        fragOut = vec4(c * contrib, 1.0);
      }`,
      { t: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 0.6 }, uKnee: { value: 0.3 } },
    );

    this.mUp = mkPass(
      /* glsl */ `
      uniform sampler2D tLow, tHigh; uniform vec2 uTexel; uniform float uMix;
      void main(){
        // 9-tap tent upsample of the lower level
        vec4 s = texture(tLow, vUv) * 4.0;
        s += texture(tLow, vUv + uTexel * vec2(-1.0, 0.0)) * 2.0;
        s += texture(tLow, vUv + uTexel * vec2( 1.0, 0.0)) * 2.0;
        s += texture(tLow, vUv + uTexel * vec2(0.0, -1.0)) * 2.0;
        s += texture(tLow, vUv + uTexel * vec2(0.0,  1.0)) * 2.0;
        s += texture(tLow, vUv + uTexel * vec2(-1.0, -1.0));
        s += texture(tLow, vUv + uTexel * vec2( 1.0, -1.0));
        s += texture(tLow, vUv + uTexel * vec2(-1.0,  1.0));
        s += texture(tLow, vUv + uTexel * vec2( 1.0,  1.0));
        fragOut = texture(tHigh, vUv) + s / 16.0 * uMix;
      }`,
      { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } },
    );

    this.mFinal = mkPass(
      /* glsl */ `
      ${HASH_GLSL}
      uniform sampler2D tScene, tBloom;
      uniform float uExposure, uBloom, uFade, uGlitch, uVignette, uGrain, uSat;
      uniform uint uFrame;
      uniform vec2 uRes;
      uniform int uGradeOn; uniform mat3 uGrade;
      vec3 shoulder(vec3 c){
        float m = max(c.r, max(c.g, c.b));
        float k = 0.72;
        if (m <= k) return c;
        float mm = k + (1.0 - k) * (1.0 - exp(-(m - k) / (1.0 - k)));
        vec3 o = c * (mm / m);
        // very bright cores bleach toward white, like film
        float wt = clamp((m - 1.0) / 3.0, 0.0, 1.0);
        return mix(o, vec3(mm), wt * wt * (3.0 - 2.0 * wt) * 0.8);
      }
      vec3 toSRGB(vec3 c){
        c = max(c, 0.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main(){
        vec2 uv = vUv;
        float split = 0.0;
        if (uGlitch > 0.0) {
          uint fr = uFrame / 2u;
          float band = floor(uv.y * 36.0);
          float hb = h01(uint(band), fr, 11u);
          if (hb < uGlitch * 0.55) {
            uv.x += (h01(uint(band), fr, 23u) - 0.5) * 0.12 * uGlitch;
          }
          float big = floor(uv.y * 7.0);
          if (h01(uint(big), fr, 37u) < uGlitch * 0.25) uv.x += (h01(uint(big), fr, 41u) - 0.5) * 0.05;
          split = 0.006 * uGlitch;
        }
        vec3 c;
        if (split > 0.0) {
          c.r = texture(tScene, uv + vec2(split, 0.0)).r + texture(tBloom, uv + vec2(split, 0.0)).r * uBloom;
          c.g = texture(tScene, uv).g + texture(tBloom, uv).g * uBloom;
          c.b = texture(tScene, uv - vec2(split, 0.0)).b + texture(tBloom, uv - vec2(split, 0.0)).b * uBloom;
        } else {
          c = texture(tScene, uv).rgb + texture(tBloom, uv).rgb * uBloom;
        }
        c *= uExposure;
        if (uGradeOn == 1) c = max(uGrade * c, 0.0);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(l), c, uSat), 0.0);
        c = shoulder(c);
        vec2 q = vUv - 0.5;
        q.x *= uRes.x / uRes.y;
        float v = 1.0 - uVignette * smoothstep(0.25, 1.05, length(q));
        c *= v * uFade;
        vec3 s = toSRGB(c);
        uvec2 p = uvec2(gl_FragCoord.xy);
        // grain: zero-mean triangular noise, ~1.5% peak (pixel, frame)
        float g = (h01(p.x, p.y, uFrame * 4u + 1u) + h01(p.x, p.y, uFrame * 4u + 2u) - 1.0) * uGrain;
        // dither: +-1/255 triangular, per channel
        vec3 d = vec3(
          h01(p.x, p.y, uFrame * 8u + 3u) + h01(p.x, p.y, uFrame * 8u + 4u) - 1.0,
          h01(p.x, p.y, uFrame * 8u + 5u) + h01(p.x, p.y, uFrame * 8u + 6u) - 1.0,
          h01(p.x, p.y, uFrame * 8u + 7u) + h01(p.x, p.y, uFrame * 8u + 9u) - 1.0) / 255.0;
        fragOut = vec4(clamp(s + g + d, 0.0, 1.0), 1.0); 
      }`,
      {
        tScene: { value: null },
        tBloom: { value: null },
        uExposure: { value: 1 },
        uBloom: { value: 0.6 },
        uFade: { value: 1 },
        uGlitch: { value: 0 },
        uVignette: { value: 0.35 },
        uGrain: { value: 0.015 },
        uSat: { value: 1 },
        uFrame: { value: 0 },
        uRes: { value: new THREE.Vector2() },
        uGradeOn: { value: 0 },
        uGrade: { value: new THREE.Matrix3() },
      },
    );
  }

  /** Hue rotation (luma-preserving), saturation and tint as one 3x3 matrix. */
  setGrade(g?: Grade) {
    const u = this.mFinal.uniforms;
    if (!g || (!g.hue && (g.saturation ?? 1) === 1 && !g.tint)) {
      u.uGradeOn.value = 0;
      return;
    }
    const a = THREE.MathUtils.degToRad(g.hue ?? 0);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const lr = 0.2126;
    const lg = 0.7152;
    const lb = 0.0722;
    // standard hue-rotation matrix about the luminance axis
    const hue = new THREE.Matrix3().set(
      lr + c * (1 - lr) + s * -lr, lg + c * -lg + s * -lg, lb + c * -lb + s * (1 - lb),
      lr + c * -lr + s * 0.143, lg + c * (1 - lg) + s * 0.14, lb + c * -lb + s * -0.283,
      lr + c * -lr + s * -(1 - lr), lg + c * -lg + s * lg, lb + c * (1 - lb) + s * lb,
    );
    const k = g.saturation ?? 1;
    const sat = new THREE.Matrix3().set(
      lr * (1 - k) + k, lg * (1 - k), lb * (1 - k),
      lr * (1 - k), lg * (1 - k) + k, lb * (1 - k),
      lr * (1 - k), lg * (1 - k), lb * (1 - k) + k,
    );
    const t = g.tint ?? [1, 1, 1];
    const tint = new THREE.Matrix3().set(t[0], 0, 0, 0, t[1], 0, 0, 0, t[2]);
    u.uGrade.value.copy(tint.multiply(sat).multiply(hue));
    u.uGradeOn.value = 1;
  }

  private ensure(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    this.msaa = rt(w, h, {
      samples: PERF.msaa,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
    });
    this.single = rt(w, h, { depthBuffer: true });
    this.accum = rt(w, h);
    this.pyr = [];
    this.tmp = [];
    for (let l = 0; l < LEVELS; l++) {
      this.pyr.push(rt(w >> l, h >> l));
      this.tmp.push(rt(w >> l, h >> l));
    }
    this.bloomDown = [];
    this.bloomUp = [];
    for (let l = 1; l < LEVELS; l++) {
      this.bloomDown.push(rt(w >> l, h >> l));
      this.bloomUp.push(rt(w >> l, h >> l));
    }
  }

  dispose() {
    this.msaa?.depthTexture?.dispose();
    this.msaa?.dispose();
    this.single?.dispose();
    this.accum?.dispose();
    for (const r of [...this.pyr, ...this.tmp, ...this.bloomDown, ...this.bloomUp]) r.dispose();
    for (const r of this.blurOut.values()) r.dispose();
    this.blurOut.clear();
  }

  private pass(m: THREE.ShaderMaterial, target: RT | null, clear = true) {
    this.quad.material = m;
    this.gl.setRenderTarget(target);
    if (clear) {
      this.gl.setClearColor(0x000000, 0);
      this.gl.clear(true, false, false);
    }
    this.gl.render(this.qScene, this.qCam);
  }

  private outRT(key: string, l: number) {
    let r = this.blurOut.get(key);
    if (!r) {
      r = rt(this.w >> l, this.h >> l);
      this.blurOut.set(key, r);
    }
    return r;
  }

  /** Build pyramid levels 1..maxL from the (resolved) layer texture. */
  private buildPyramid(src: THREE.Texture, maxL: number) {
    let prev: THREE.Texture = src;
    let pw = this.w;
    let ph = this.h;
    for (let l = 1; l <= maxL; l++) {
      this.mDown.uniforms.t.value = prev;
      this.mDown.uniforms.uTexel.value.set(0.5 / pw, 0.5 / ph);
      this.pass(this.mDown, this.pyr[l]);
      prev = this.pyr[l].texture;
      pw = this.w >> l;
      ph = this.h >> l;
    }
  }

  private levelFor(sigmaPx: number) {
    let l = 0;
    while (l < LEVELS - 1 && sigmaPx / (1 << l) > 2.0) l++;
    return l;
  }

  /** Gaussian blur of level l of the pyramid (level 0 = src), sigma in full-res px. */
  private blur(src: THREE.Texture, sigmaPx: number, key: string): THREE.Texture {
    const l = this.levelFor(sigmaPx);
    const s = sigmaPx / (1 << l);
    const input = l === 0 ? src : this.pyr[l].texture;
    if (s < 0.35) return input;
    const lw = this.w >> l;
    const lh = this.h >> l;
    const k = gaussKernel(s);
    const u = this.mBlur.uniforms;
    for (let i = 0; i < MAX_TAPS; i++) {
      u.uOff.value[i] = k.offsets[i] ?? 0;
      u.uW.value[i] = k.weights[i] ?? 0;
    }
    u.uN.value = Math.min(MAX_TAPS, k.offsets.length);
    u.t.value = input;
    u.uDir.value.set(1 / lw, 0);
    this.pass(this.mBlur, this.tmp[l]);
    const out = this.outRT(`${key}:${l}`, l);
    u.t.value = this.tmp[l].texture;
    u.uDir.value.set(0, 1 / lh);
    this.pass(this.mBlur, out);
    return out.texture;
  }

  render(layers: LayerSpec[], camera: THREE.PerspectiveCamera, post: PostParams) {
    const gl = this.gl;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.ensure(size.x, size.y);
    const H = this.h;
    gl.autoClear = false;

    // clear accumulation to the background colour
    gl.setRenderTarget(this.accum);
    gl.setClearColor(new THREE.Color(this.bg[0], this.bg[1], this.bg[2]), 1);
    gl.clear(true, true, true);

    layers.forEach((L, li) => {
      const cam = L.camera ?? camera;
      // MSAA only where edges stay sharp; blurred layers don't need it.
      const target = !L.depth && (L.blur ?? 0) >= 0.002 ? this.single : this.msaa;
      gl.setRenderTarget(target);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, true);
      gl.render(L.scene, cam);
      const tex = target.texture;
      const opacity = L.opacity ?? 1;

      if (L.depth && PERF.dof) {
        const D = L.depth;
        const maxSigma = D.maxBlur * H;
        const sigmas = [0.25, 0.5, 0.75, 1].map((f) => maxSigma * f);
        this.buildPyramid(tex, this.levelFor(maxSigma));
        const levels = sigmas.map((s, i) => this.blur(tex, s, `L${li}d${i}`));
        const u = this.mSelect.uniforms;
        u.t0.value = tex;
        u.t1.value = levels[0];
        u.t2.value = levels[1];
        u.t3.value = levels[2];
        u.t4.value = levels[3];
        u.tDepth.value = this.msaa.depthTexture;
        const pc = cam as THREE.PerspectiveCamera;
        u.uNear.value = pc.near;
        u.uFar.value = pc.far;
        u.uFocus.value = D.focus;
        u.uBand.value = D.band;
        u.uRange.value = D.range;
        u.uNearMul.value = D.nearMul ?? 1;
        u.uOpacity.value = opacity;
        this.pass(this.mSelect, this.accum, false);
      } else {
        const sigma = (L.blur ?? 0) * H;
        let out: THREE.Texture = tex;
        if (sigma >= 0.35 && PERF.dof) {
          this.buildPyramid(tex, this.levelFor(sigma));
          out = this.blur(tex, sigma, `L${li}u`);
        }
        this.mCopy.uniforms.t.value = out;
        this.mCopy.uniforms.uOpacity.value = opacity;
        this.pass(this.mCopy, this.accum, false);
      }
    });

    // bloom
    const o = this.opts;
    this.mPre.uniforms.t.value = this.accum.texture;
    this.mPre.uniforms.uTexel.value.set(0.5 / this.w, 0.5 / this.h);
    this.mPre.uniforms.uThr.value = o.bloomThreshold;
    this.mPre.uniforms.uKnee.value = o.bloomKnee;
    this.pass(this.mPre, this.bloomDown[0]);
    for (let i = 1; i < this.bloomDown.length; i++) {
      const pw = this.w >> i;
      const ph = this.h >> i;
      this.mDown.uniforms.t.value = this.bloomDown[i - 1].texture;
      this.mDown.uniforms.uTexel.value.set(0.5 / pw, 0.5 / ph);
      this.pass(this.mDown, this.bloomDown[i]);
    }
    const last = this.bloomDown.length - 1;
    let low: THREE.Texture = this.bloomDown[last].texture;
    for (let i = last - 1; i >= 0; i--) {
      const lw = this.w >> (i + 2);
      const lh = this.h >> (i + 2);
      this.mUp.uniforms.tLow.value = low;
      this.mUp.uniforms.tHigh.value = this.bloomDown[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / Math.max(1, lw), 1 / Math.max(1, lh));
      this.mUp.uniforms.uMix.value = o.bloomRadius + 0.4;
      this.pass(this.mUp, this.bloomUp[i]);
      low = this.bloomUp[i].texture;
    }

    // final
    const f = this.mFinal.uniforms;
    f.tScene.value = this.accum.texture;
    f.tBloom.value = low;
    f.uExposure.value = post.exposure ?? 1;
    f.uBloom.value = (post.bloom ?? 1) * o.bloomIntensity / this.bloomDown.length;
    f.uFade.value = post.fade ?? 1;
    f.uGlitch.value = post.glitch ?? 0;
    f.uVignette.value = post.vignette ?? o.vignette;
    f.uGrain.value = o.grain;
    f.uSat.value = o.saturation;
    f.uFrame.value = Math.max(0, Math.floor(post.grainFrame)) >>> 0;
    f.uRes.value.set(this.w, this.h);
    this.pass(this.mFinal, null);
    gl.setRenderTarget(null);
  }
}
