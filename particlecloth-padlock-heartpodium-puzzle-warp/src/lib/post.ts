import * as THREE from "three";
import { GRAIN_GLSL } from "./grain.glsl";

// A small, fully deterministic post pipeline for the three.js looks:
//   scene (MSAA, half-float, depth texture)
//   → SSAO (fixed kernel + fixed 4×4 rotation pattern, depth-aware blur)
//   → depth of field (half-res scatter-as-gather, fixed Vogel disk)
//   → bloom (mip chain)
//   → final (exposure, tone map, grade, vignette, grain, ±1/255 dither) → canvas
// No TAA, no temporal accumulation, nothing carried between frames.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const triangle = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
})();

class FullScreenPass {
  mesh: THREE.Mesh;
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  material: THREE.ShaderMaterial;
  constructor(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string | number> = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader,
      uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(triangle, this.material);
    this.mesh.frustumCulled = false;
  }
  get u() {
    return this.material.uniforms;
  }
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    r.setRenderTarget(target);
    r.render(this.mesh, this.cam);
  }
}

const DEPTH_HELPERS = /* glsl */ `
uniform float uNear;
uniform float uFar;
float viewZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); } // negative
float linDepth(float d) { return -viewZ(d); }
`;

// ---------------- SSAO ----------------
const SSAO_FRAG = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uBias;
uniform float uIntensity;
varying vec2 vUv;
${DEPTH_HELPERS}
vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uInvProj * clip;
  return v.xyz / v.w;
}
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 1.0) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  // normal from the smaller of left/right and up/down differences (avoids edge halos)
  vec3 pr = viewPos(vUv + vec2(uTexel.x, 0.0)) - P;
  vec3 pl = P - viewPos(vUv - vec2(uTexel.x, 0.0));
  vec3 pu = viewPos(vUv + vec2(0.0, uTexel.y)) - P;
  vec3 pd = P - viewPos(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z) < abs(pl.z) ? pr : pl;
  vec3 dy = abs(pu.z) < abs(pd.z) ? pu : pd;
  vec3 N = normalize(cross(dx, dy));
  // fixed 4x4 rotation pattern (interleaved), removed by the blur pass
  vec2 pix = floor(gl_FragCoord.xy);
  float idx = mod(pix.x, 4.0) + 4.0 * mod(pix.y, 4.0);
  float rot = idx * 2.39996323 + 0.37;
  vec3 rv = vec3(cos(rot), sin(rot), 0.0);
  vec3 T = normalize(rv - N * dot(rv, N));
  vec3 B = cross(N, T);
  float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    // fixed hemisphere kernel: Vogel spiral, scaled toward the centre
    float r = sqrt((fi + 0.5) / 16.0);
    float a = fi * 2.39996323;
    float h = sqrt(max(0.0, 1.0 - r * r));
    float s = mix(0.15, 1.0, (fi + 1.0) / 16.0);
    s *= s;
    vec3 k = (T * cos(a) * r + B * sin(a) * r + N * (h * 0.85 + 0.15)) * uRadius * s;
    vec3 Sp = P + k;
    vec4 c = uProj * vec4(Sp, 1.0);
    vec2 suv = c.xy / c.w * 0.5 + 0.5;
    float sz = viewZ(texture2D(tDepth, suv).x);
    float range = smoothstep(0.0, 1.0, uRadius / max(abs(P.z - sz), 1e-4));
    occ += (sz >= Sp.z + uBias ? 1.0 : 0.0) * range;
  }
  float ao = 1.0 - occ / 16.0;
  gl_FragColor = vec4(vec3(pow(clamp(ao, 0.0, 1.0), uIntensity)), 1.0);
}
`;

const AO_BLUR_APPLY_FRAG = /* glsl */ `
uniform sampler2D tAO;
uniform sampler2D tDepth;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uStrength;
varying vec2 vUv;
${DEPTH_HELPERS}
void main() {
  float zc = linDepth(texture2D(tDepth, vUv).x);
  float sum = 0.0, wsum = 0.0;
  for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
    vec2 o = (vec2(float(x), float(y)) + 0.5) * uTexel;
    float z = linDepth(texture2D(tDepth, vUv + o).x);
    float w = 1.0 / (1e-3 + abs(z - zc) / max(zc, 1e-3) * 40.0);
    sum += texture2D(tAO, vUv + o).x * w;
    wsum += w;
  }
  float ao = sum / wsum;
  vec4 col = texture2D(tColor, vUv);
  gl_FragColor = vec4(col.rgb * mix(1.0, ao, uStrength), col.a);
}
`;

// ---------------- Depth of field ----------------
const COC_GLSL = /* glsl */ `
uniform float uFocus;      // focus distance (world units)
uniform float uFocusRange; // half-depth of the perfectly sharp band
uniform float uAperture;   // CoC scale, in fraction of frame height per unit of (z-zf)/z
uniform float uMaxCoc;     // max CoC radius, fraction of frame height
uniform float uHeightPx;   // full-res height in px
float cocPx(float z) {
  float dz = z - uFocus;
  float s = sign(dz) * max(abs(dz) - uFocusRange, 0.0);
  float c = uAperture * s / max(z, 1e-4);
  return clamp(c, -uMaxCoc, uMaxCoc) * uHeightPx; // signed, full-res pixels
}
`;

// full → half res: colour + CoC (in half-res pixels)
const DOF_PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexelFull;
varying vec2 vUv;
${DEPTH_HELPERS}
${COC_GLSL}
void main() {
  vec3 c = vec3(0.0); float coc = 0.0; float cmin = 1e9;
  for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(float(i - (i / 2) * 2), float(i / 2)) - 0.5) * uTexelFull;
    vec2 uv = vUv + o;
    c += texture2D(tColor, uv).rgb;
    float k = cocPx(linDepth(texture2D(tDepth, uv).x));
    coc += k;
    cmin = min(cmin, k);
  }
  c *= 0.25; coc *= 0.25;
  // keep the near field's spread (most negative wins)
  if (cmin < 0.0) coc = min(coc, cmin);
  gl_FragColor = vec4(c, coc * 0.5);
}
`;

const DOF_GATHER_FRAG = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 uTexelHalf;
uniform float uMaxCocHalf; // px at half res
uniform int uCount;
varying vec2 vUv;
#define MAX_SAMPLES 200
void main() {
  vec4 center = texture2D(tHalf, vUv);
  float c0 = center.a;
  vec3 acc = center.rgb; float wsum = 1.0;
  float nearW = 0.0;
  float fc = float(uCount);
  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (i >= uCount) break;
    float fi = float(i) + 0.5;
    float r = sqrt(fi / fc) * uMaxCocHalf;
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = texture2D(tHalf, vUv + off * uTexelHalf);
    float cs = s.a;
    float size = abs(cs);
    // background samples may not spread over a sharper foreground
    if (cs > c0) size = min(size, max(abs(c0), 0.0) * 2.0 + 0.0);
    float w = smoothstep(r - 1.0, r + 0.5, size);
    acc += s.rgb * w; wsum += w;
    if (cs < c0 - 0.5 && cs < -1.0) nearW += w;
  }
  vec3 col = acc / wsum;
  float nearCov = clamp(nearW / max(wsum - 1.0, 1.0) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(col, max(smoothstep(0.4, 1.4, abs(c0)), nearCov));
}
`;

const DOF_TENT_FRAG = /* glsl */ `
uniform sampler2D tIn;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(tIn, vUv) * 4.0;
  s += texture2D(tIn, vUv + vec2(uTexel.x, 0.0)) * 2.0;
  s += texture2D(tIn, vUv - vec2(uTexel.x, 0.0)) * 2.0;
  s += texture2D(tIn, vUv + vec2(0.0, uTexel.y)) * 2.0;
  s += texture2D(tIn, vUv - vec2(0.0, uTexel.y)) * 2.0;
  s += texture2D(tIn, vUv + uTexel) + texture2D(tIn, vUv - uTexel);
  s += texture2D(tIn, vUv + vec2(uTexel.x, -uTexel.y)) + texture2D(tIn, vUv + vec2(-uTexel.x, uTexel.y));
  gl_FragColor = s / 16.0;
}
`;

const DOF_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
varying vec2 vUv;
${DEPTH_HELPERS}
${COC_GLSL}
void main() {
  vec4 sharp = texture2D(tColor, vUv);
  vec4 b = texture2D(tBlur, vUv);
  float c = abs(cocPx(linDepth(texture2D(tDepth, vUv).x)));
  float k = max(smoothstep(0.6, 2.2, c), b.a);
  gl_FragColor = vec4(mix(sharp.rgb, b.rgb, k), 1.0);
}
`;

// ---------------- Bloom ----------------
const BLOOM_DOWN_FRAG = /* glsl */ `
uniform sampler2D tIn;
uniform vec2 uTexel; // of the source
uniform float uThreshold;
uniform float uKaris;
varying vec2 vUv;
vec3 pre(vec3 c) {
  if (uThreshold > 0.0) {
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold * 0.5, 0.0, uThreshold);
    soft = soft * soft / (2.0 * uThreshold + 1e-4);
    c *= max(soft, br - uThreshold) / max(br, 1e-4);
  }
  return c;
}
vec3 S(vec2 o) { return pre(texture2D(tIn, vUv + o * uTexel).rgb); }
float kw(vec3 c) { return uKaris > 0.0 ? 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))) : 1.0; }
void main() {
  vec3 a = S(vec2(-2, 2)), b = S(vec2(0, 2)), c = S(vec2(2, 2));
  vec3 d = S(vec2(-2, 0)), e = S(vec2(0, 0)), f = S(vec2(2, 0));
  vec3 g = S(vec2(-2, -2)), h = S(vec2(0, -2)), i = S(vec2(2, -2));
  vec3 j = S(vec2(-1, 1)), k = S(vec2(1, 1)), l = S(vec2(-1, -1)), m = S(vec2(1, -1));
  vec3 g0 = (j + k + l + m) * 0.25;
  vec3 g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25;
  vec3 g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;
  float w0 = kw(g0) * 0.5, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.125;
  vec3 o = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  gl_FragColor = vec4(o, 1.0);
}
`;

const BLOOM_UP_FRAG = /* glsl */ `
uniform sampler2D tLow;   // smaller level (already accumulated)
uniform sampler2D tCur;   // this level's downsample
uniform vec2 uTexel;      // of tLow
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture2D(tLow, vUv).rgb * 4.0;
  s += (texture2D(tLow, vUv + vec2(t.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(t.x, 0.0)).rgb +
        texture2D(tLow, vUv + vec2(0.0, t.y)).rgb + texture2D(tLow, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  s += texture2D(tLow, vUv + t).rgb + texture2D(tLow, vUv - t).rgb +
       texture2D(tLow, vUv + vec2(t.x, -t.y)).rgb + texture2D(tLow, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(texture2D(tCur, vUv).rgb + s / 16.0, 1.0);
}
`;

// ---------------- Final ----------------
const FINAL_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uBloomLevels;
uniform float uExposure;
uniform int uTone;          // 0 none(clamp) 1 ACES 2 AgX-ish 3 soft exp
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform float uCA;          // chromatic aberration, fraction of width at the corners
uniform float uGrain;
uniform float uGrainFloor;
uniform float uBlackGate;
uniform float uLoopFrame;
uniform vec3 uTint;
uniform vec3 uBottomTint;
varying vec2 vUv;
${GRAIN_GLSL}
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 softExp(vec3 c) { return 1.0 - exp(-c); }
vec3 neutral(vec3 color) {
  // Khronos PBR neutral
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0, 1.0, 1.0), g);
}
vec3 fetch(sampler2D t, vec2 uv) {
  if (uCA <= 0.0) return texture2D(t, uv).rgb;
  vec2 d = (uv - 0.5) * uCA;
  return vec3(texture2D(t, uv - d).r, texture2D(t, uv).g, texture2D(t, uv + d).b);
}
void main() {
  vec3 c = fetch(tColor, vUv);
  if (uBloom > 0.0) c += fetch(tBloom, vUv) * (uBloom / uBloomLevels);
  c *= uExposure * uTint;
  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * smoothstep(0.2, 0.85, length(q * vec2(1.0, 0.75)) * 1.35);
  c *= vig;
  // optional vertical grade: darker / cooler toward the bottom of frame
  c *= mix(vec3(1.0), uBottomTint, pow(1.0 - vUv.y, 1.5));
  c = c * uGain + uLift;
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(L), c, uSaturation), 0.0);
  if (uTone == 1) c = acesFilmic(c);
  else if (uTone == 2) c = neutral(c);
  else if (uTone == 3) c = softExp(c);
  c = clamp(c, 0.0, 1.0);
  c = linearToSRGB(c);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  c = applyGrainDither(c, gl_FragCoord.xy, uLoopFrame, uGrain, uGrainFloor, uBlackGate);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export type ToneMap = "none" | "aces" | "neutral" | "soft";

export interface PostOptions {
  samples?: number;
  ssao?: { radius: number; intensity: number; strength: number; bias?: number };
  dof?: { focus: number; focusRange?: number; aperture: number; maxCoc: number };
  bloom?: { strength: number; radius?: number; threshold?: number; levels?: number };
  final: {
    exposure?: number;
    tone?: ToneMap;
    lift?: [number, number, number];
    gain?: [number, number, number];
    tint?: [number, number, number];
    bottomTint?: [number, number, number];
    saturation?: number;
    contrast?: number;
    vignette?: number;
    ca?: number;
    grain?: number;
    grainFloor?: number;
    blackGate?: boolean;
  };
}

const rtOpts = (): THREE.RenderTargetOptions => ({
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: false,
  generateMipmaps: false,
});

export class PostPipeline {
  w: number;
  h: number;
  opts: PostOptions;
  sceneRT: THREE.WebGLRenderTarget;
  private aoRT?: THREE.WebGLRenderTarget;
  private aoOutRT?: THREE.WebGLRenderTarget;
  private dofHalfA?: THREE.WebGLRenderTarget;
  private dofHalfB?: THREE.WebGLRenderTarget;
  private dofHalfC?: THREE.WebGLRenderTarget;
  private dofOut?: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private ssao?: FullScreenPass;
  private aoApply?: FullScreenPass;
  private dofPre?: FullScreenPass;
  private dofGather?: FullScreenPass;
  private dofTent?: FullScreenPass;
  private dofComp?: FullScreenPass;
  private bDown?: FullScreenPass;
  private bUp?: FullScreenPass;
  final: FullScreenPass;

  constructor(w: number, h: number, opts: PostOptions) {
    this.w = w;
    this.h = h;
    this.opts = opts;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      ...rtOpts(),
      depthBuffer: true,
      samples: opts.samples ?? 4,
      depthTexture,
    });
    const texel = new THREE.Vector2(1 / w, 1 / h);
    const depthU = () => ({ uNear: { value: 0.1 }, uFar: { value: 100 } });

    if (opts.ssao) {
      this.aoRT = new THREE.WebGLRenderTarget(w, h, rtOpts());
      this.aoOutRT = new THREE.WebGLRenderTarget(w, h, rtOpts());
      this.ssao = new FullScreenPass(SSAO_FRAG, {
        tDepth: { value: depthTexture },
        uProj: { value: new THREE.Matrix4() },
        uInvProj: { value: new THREE.Matrix4() },
        uTexel: { value: texel },
        uRadius: { value: opts.ssao.radius },
        uBias: { value: opts.ssao.bias ?? 0.002 },
        uIntensity: { value: opts.ssao.intensity },
        ...depthU(),
      });
      this.aoApply = new FullScreenPass(AO_BLUR_APPLY_FRAG, {
        tAO: { value: this.aoRT.texture },
        tDepth: { value: depthTexture },
        tColor: { value: this.sceneRT.texture },
        uTexel: { value: texel },
        uStrength: { value: opts.ssao.strength },
        ...depthU(),
      });
    }

    if (opts.dof) {
      const hw = Math.max(1, Math.round(w / 2));
      const hh = Math.max(1, Math.round(h / 2));
      this.dofHalfA = new THREE.WebGLRenderTarget(hw, hh, rtOpts());
      this.dofHalfB = new THREE.WebGLRenderTarget(hw, hh, rtOpts());
      this.dofHalfC = new THREE.WebGLRenderTarget(hw, hh, rtOpts());
      this.dofOut = new THREE.WebGLRenderTarget(w, h, rtOpts());
      const cocU = () => ({
        uFocus: { value: opts.dof!.focus },
        uFocusRange: { value: opts.dof!.focusRange ?? 0 },
        uAperture: { value: opts.dof!.aperture },
        uMaxCoc: { value: opts.dof!.maxCoc },
        uHeightPx: { value: h },
      });
      this.dofPre = new FullScreenPass(DOF_PREFILTER_FRAG, {
        tColor: { value: null },
        tDepth: { value: depthTexture },
        uTexelFull: { value: texel },
        ...depthU(),
        ...cocU(),
      });
      const maxCocHalf = opts.dof.maxCoc * h * 0.5;
      // sample count grows with blur area so the disk stays well sampled at 4K
      const count = Math.max(48, Math.min(200, Math.round(maxCocHalf * maxCocHalf * 0.9)));
      this.dofGather = new FullScreenPass(DOF_GATHER_FRAG, {
        tHalf: { value: this.dofHalfA.texture },
        uTexelHalf: { value: new THREE.Vector2(1 / hw, 1 / hh) },
        uMaxCocHalf: { value: maxCocHalf },
        uCount: { value: count },
      });
      this.dofTent = new FullScreenPass(DOF_TENT_FRAG, {
        tIn: { value: this.dofHalfB.texture },
        uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      });
      this.dofComp = new FullScreenPass(DOF_COMPOSITE_FRAG, {
        tColor: { value: null },
        tDepth: { value: depthTexture },
        tBlur: { value: this.dofHalfC.texture },
        ...depthU(),
        ...cocU(),
      });
    }

    const levels = opts.bloom?.levels ?? 6;
    if (opts.bloom) {
      let bw = w, bh = h;
      for (let i = 0; i < levels; i++) {
        bw = Math.max(1, Math.round(bw / 2));
        bh = Math.max(1, Math.round(bh / 2));
        this.bloomDown.push(new THREE.WebGLRenderTarget(bw, bh, rtOpts()));
        this.bloomUp.push(new THREE.WebGLRenderTarget(bw, bh, rtOpts()));
      }
      this.bDown = new FullScreenPass(BLOOM_DOWN_FRAG, {
        tIn: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: 0 },
        uKaris: { value: 0 },
      });
      this.bUp = new FullScreenPass(BLOOM_UP_FRAG, {
        tLow: { value: null },
        tCur: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: opts.bloom.radius ?? 1 },
      });
    }

    const f = opts.final;
    const toneIdx = { none: 0, aces: 1, neutral: 2, soft: 3 }[f.tone ?? "aces"];
    this.final = new FullScreenPass(FINAL_FRAG, {
      tColor: { value: null },
      tBloom: { value: this.bloomUp[0]?.texture ?? null },
      uBloom: { value: opts.bloom?.strength ?? 0 },
      uBloomLevels: { value: levels },
      uExposure: { value: f.exposure ?? 1 },
      uTone: { value: toneIdx },
      uLift: { value: new THREE.Vector3(...(f.lift ?? [0, 0, 0])) },
      uGain: { value: new THREE.Vector3(...(f.gain ?? [1, 1, 1])) },
      uTint: { value: new THREE.Vector3(...(f.tint ?? [1, 1, 1])) },
      uBottomTint: { value: new THREE.Vector3(...(f.bottomTint ?? [1, 1, 1])) },
      uSaturation: { value: f.saturation ?? 1 },
      uContrast: { value: f.contrast ?? 1 },
      uVignette: { value: f.vignette ?? 0 },
      uCA: { value: f.ca ?? 0 },
      uGrain: { value: f.grain ?? 0.015 },
      uGrainFloor: { value: f.grainFloor ?? 0 },
      uBlackGate: { value: f.blackGate ? 1 : 0 },
      uLoopFrame: { value: 0 },
    });
  }

  render(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, loopFrame: number) {
    const setDepth = (p?: FullScreenPass) => {
      if (!p) return;
      p.u.uNear.value = camera.near;
      p.u.uFar.value = camera.far;
    };
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);
    let color: THREE.Texture = this.sceneRT.texture;

    if (this.ssao && this.aoApply && this.aoRT && this.aoOutRT) {
      setDepth(this.ssao);
      setDepth(this.aoApply);
      this.ssao.u.uProj.value.copy(camera.projectionMatrix);
      this.ssao.u.uInvProj.value.copy(camera.projectionMatrixInverse);
      this.ssao.render(r, this.aoRT);
      this.aoApply.u.tColor.value = color;
      this.aoApply.render(r, this.aoOutRT);
      color = this.aoOutRT.texture;
    }

    if (this.dofPre && this.dofGather && this.dofTent && this.dofComp) {
      setDepth(this.dofPre);
      setDepth(this.dofComp);
      this.dofPre.u.tColor.value = color;
      this.dofPre.render(r, this.dofHalfA!);
      this.dofGather.render(r, this.dofHalfB!);
      this.dofTent.render(r, this.dofHalfC!);
      this.dofComp.u.tColor.value = color;
      this.dofComp.render(r, this.dofOut!);
      color = this.dofOut!.texture;
    }

    if (this.bDown && this.bUp && this.opts.bloom) {
      let src: THREE.Texture = color;
      let sw = this.w, sh = this.h;
      for (let i = 0; i < this.bloomDown.length; i++) {
        this.bDown.u.tIn.value = src;
        this.bDown.u.uTexel.value.set(1 / sw, 1 / sh);
        this.bDown.u.uThreshold.value = i === 0 ? (this.opts.bloom.threshold ?? 0) : 0;
        this.bDown.u.uKaris.value = i === 0 ? 1 : 0;
        this.bDown.render(r, this.bloomDown[i]);
        src = this.bloomDown[i].texture;
        sw = this.bloomDown[i].width;
        sh = this.bloomDown[i].height;
      }
      const n = this.bloomDown.length;
      // smallest level: up = down
      let low: THREE.WebGLRenderTarget = this.bloomDown[n - 1];
      for (let i = n - 2; i >= 0; i--) {
        this.bUp.u.tLow.value = low.texture;
        this.bUp.u.tCur.value = this.bloomDown[i].texture;
        this.bUp.u.uTexel.value.set(1 / low.width, 1 / low.height);
        this.bUp.render(r, this.bloomUp[i]);
        low = this.bloomUp[i];
      }
    }

    this.final.u.tColor.value = color;
    this.final.u.uLoopFrame.value = loopFrame;
    this.final.render(r, null);
  }

  /** camera focus can follow the subject */
  setFocus(focus: number) {
    if (this.dofPre) this.dofPre.u.uFocus.value = focus;
    if (this.dofComp) this.dofComp.u.uFocus.value = focus;
  }

  dispose() {
    [this.sceneRT, this.aoRT, this.aoOutRT, this.dofHalfA, this.dofHalfB, this.dofHalfC, this.dofOut, ...this.bloomDown, ...this.bloomUp].forEach((t) => t?.dispose());
  }
}
