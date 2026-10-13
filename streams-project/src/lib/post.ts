import * as THREE from "three";
import { mulberry32 } from "./random";

// Deterministic post pipeline for the three.js looks.
//   scene (MSAA, half-float, depth) → [SSAO] → [bokeh DoF] → bloom → final
// Final: exposure, tone map, vignette, grain (pixel+frame hash), ±1/255 dither.
// Every input is a uniform set from the current frame; nothing is carried
// between frames (no TAA, no feedback buffers).

export type PostParams = {
  exposure: number;
  tonemap: 0 | 1 | 2; // 0 clamp, 1 ACES fitted, 2 soft (Reinhard on max channel)
  saturation: number;
  contrast: number;
  vignette: number;
  grain: number; // amplitude in display units (0.015 = 1.5%)
  grainDarkFade: number; // luminance below which grain fades to 0 (0 = off)
  loopFrames: number; // grain pattern repeats on this period
  bloom: { strength: number; threshold: number; knee: number; radius: number };
  dof: null | {
    focus: number; // view-space distance in world units
    aperture: number; // CoC at infinity, as a fraction of frame height
    maxCoc: number; // clamp, fraction of frame height
  };
  ssao: null | { radius: number; intensity: number; power: number };
  lift: [number, number, number]; // added before tone map (haze floor)
  ca?: number; // lateral chromatic aberration at the frame corner, px at 720p
};

export const defaultPost = (): PostParams => ({
  exposure: 1,
  tonemap: 1,
  saturation: 1,
  contrast: 1,
  vignette: 0.15,
  grain: 0.015,
  grainDarkFade: 0,
  loopFrames: 600,
  bloom: { strength: 0.6, threshold: 1.0, knee: 0.5, radius: 0.85 },
  dof: null,
  ssao: null,
  lift: [0, 0, 0],
});

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
uniform vec2 uCamNF; // near, far
float viewZ(float d) {
  // perspective depth [0,1] → positive view distance
  float n = uCamNF.x, f = uCamNF.y;
  return (n * f) / (f - d * (f - n));
}
`;

const COC = /* glsl */ `
uniform float uFocus;
uniform float uAperture; // CoC at infinity in pixels of the target
uniform float uMaxCoc;   // pixels
float cocPx(float z) {
  return clamp((1.0 - uFocus / z) * uAperture, -uMaxCoc, uMaxCoc);
}
`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });

// ---------- SSAO (fixed kernel, fixed 4x4 rotation pattern) ----------
const AO_SAMPLES = 16;
const aoKernel = (() => {
  const rng = mulberry32(9001);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < AO_SAMPLES; i++) {
    const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng());
    v.normalize();
    let s = (i + 1) / AO_SAMPLES;
    s = 0.1 + 0.9 * s * s;
    v.multiplyScalar(s * (0.5 + 0.5 * rng()));
    out.push(v);
  }
  return out;
})();

const SSAO_FRAG = /* glsl */ `
${COMMON}
varying vec2 vUv;
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uTexel; // of depth texture
uniform float uRadius;
uniform vec3 uKernel[${AO_SAMPLES}];
vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * clip;
  return v.xyz / v.w;
}
void main() {
  float d = texture2D(tDepth, vUv).r;
  if (d >= 1.0) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec3 px = viewPos(vUv + vec2(uTexel.x, 0.0)) - P;
  vec3 nx = P - viewPos(vUv - vec2(uTexel.x, 0.0));
  vec3 py = viewPos(vUv + vec2(0.0, uTexel.y)) - P;
  vec3 ny = P - viewPos(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(px.z) < abs(nx.z) ? px : nx;
  vec3 dy = abs(py.z) < abs(ny.z) ? py : ny;
  vec3 N = normalize(cross(dx, dy));
  // fixed 4x4 interleaved rotation pattern (screen-space, not time-varying)
  ivec2 ip = ivec2(gl_FragCoord.xy) & 3;
  float ang = (float(ip.x * 4 + ip.y) * 0.39269908) + float(ip.y) * 0.19634954;
  vec3 rv = vec3(cos(ang), sin(ang), 0.0);
  vec3 T = normalize(rv - N * dot(rv, N));
  vec3 B = cross(N, T);
  mat3 TBN = mat3(T, B, N);
  float occ = 0.0;
  for (int i = 0; i < ${AO_SAMPLES}; i++) {
    vec3 S = P + TBN * uKernel[i] * uRadius;
    vec4 o = uProj * vec4(S, 1.0);
    vec2 suv = (o.xy / o.w) * 0.5 + 0.5;
    float sz = viewPos(suv).z;
    float range = smoothstep(0.0, 1.0, uRadius / abs(P.z - sz));
    occ += (sz >= S.z + 0.02 * uRadius ? 1.0 : 0.0) * range;
  }
  gl_FragColor = vec4(vec3(1.0 - occ / float(${AO_SAMPLES})), 1.0);
}`;

const AO_BLUR_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tAO;
uniform vec2 uTexel;
void main() {
  float s = 0.0;
  for (int x = -2; x < 2; x++)
    for (int y = -2; y < 2; y++)
      s += texture2D(tAO, vUv + (vec2(float(x), float(y)) + 0.5) * uTexel).r;
  gl_FragColor = vec4(vec3(s / 16.0), 1.0);
}`;

const AO_APPLY_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform float uIntensity;
uniform float uPower;
void main() {
  vec4 c = texture2D(tColor, vUv);
  float ao = pow(clamp(texture2D(tAO, vUv).r, 0.0, 1.0), uPower);
  gl_FragColor = vec4(c.rgb * mix(1.0, ao, uIntensity), c.a);
}`;

// ---------- DoF ----------
const DOF_PREFILTER = /* glsl */ `
${COMMON}
${COC}
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uSrcTexel; // full-res texel
void main() {
  vec3 c = texture2D(tColor, vUv).rgb; // bilinear = 2x2 average
  float d0 = texture2D(tDepth, vUv + vec2(-0.5, -0.5) * uSrcTexel).r;
  float d1 = texture2D(tDepth, vUv + vec2(0.5, -0.5) * uSrcTexel).r;
  float d2 = texture2D(tDepth, vUv + vec2(-0.5, 0.5) * uSrcTexel).r;
  float d3 = texture2D(tDepth, vUv + vec2(0.5, 0.5) * uSrcTexel).r;
  float d = min(min(d0, d1), min(d2, d3));
  // CoC in half-res pixels (uAperture/uMaxCoc are given in half-res px here)
  gl_FragColor = vec4(c, cocPx(viewZ(d)));
}`;

const DOF_TILEMAX = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc; // half-res, a = signed coc
uniform vec2 uSrcSize;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * 8;
  float m = 0.0;
  ivec2 sz = ivec2(uSrcSize);
  for (int y = 0; y < 8; y++)
    for (int x = 0; x < 8; x++) {
      ivec2 p = min(base + ivec2(x, y), sz - 1);
      m = max(m, abs(texelFetch(tSrc, p, 0).a));
    }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const DOF_DILATE = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tTile;
uniform vec2 uTexel;
void main() {
  float m = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++)
      m = max(m, texture2D(tTile, vUv + vec2(float(x), float(y)) * uTexel).r);
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const DOF_TAPS = 96;
const DOF_GATHER = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc;   // half-res color + signed coc
uniform sampler2D tTile;  // dilated tile max |coc| (linear filtered → smooth)
uniform vec2 uTexel;      // half-res texel
uniform float uMaxCoc;
void main() {
  vec4 c = texture2D(tSrc, vUv);
  float R = min(texture2D(tTile, vUv).r, uMaxCoc);
  if (R < 0.75) { gl_FragColor = vec4(c.rgb, 0.0); return; }
  float centerSize = abs(c.a);
  // normalised weighted average of every tap whose CoC covers this pixel:
  // the result does not depend on the disk radius R (only its sampling does)
  vec3 acc = c.rgb;
  float wsum = 1.0;
  float fg = 0.0;
  float w = max(0.5, R / sqrt(float(${DOF_TAPS})) * 0.9);
  for (int i = 0; i < ${DOF_TAPS}; i++) {
    float r = R * sqrt((float(i) + 0.5) / float(${DOF_TAPS}));
    float ang = float(i) * 2.39996323;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * r;
    vec4 s = texture2D(tSrc, tc);
    float sampleSize = abs(s.a);
    if (s.a > c.a) sampleSize = min(sampleSize, centerSize * 2.0);
    float m = smoothstep(r - w, r + w, sampleSize);
    acc += s.rgb * m;
    wsum += m;
    if (s.a < c.a - 0.5) fg = max(fg, m * smoothstep(0.5, 2.0, -s.a));
  }
  gl_FragColor = vec4(acc / wsum, fg);
}`;

const DOF_SMOOTH = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec4 s = texture2D(tSrc, vUv) * 4.0;
  s += texture2D(tSrc, vUv + vec2(uTexel.x, 0.0)) * 2.0;
  s += texture2D(tSrc, vUv - vec2(uTexel.x, 0.0)) * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, uTexel.y)) * 2.0;
  s += texture2D(tSrc, vUv - vec2(0.0, uTexel.y)) * 2.0;
  s += texture2D(tSrc, vUv + uTexel);
  s += texture2D(tSrc, vUv - uTexel);
  s += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y));
  s += texture2D(tSrc, vUv + vec2(-uTexel.x, uTexel.y));
  gl_FragColor = s / 16.0;
}`;

const DOF_COMPOSITE = /* glsl */ `
${COMMON}
${COC}
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
void main() {
  vec4 sharp = texture2D(tColor, vUv);
  vec4 b = texture2D(tBlur, vUv);
  float coc = abs(cocPx(viewZ(texture2D(tDepth, vUv).r)));
  float w = max(smoothstep(0.75, 3.0, coc), b.a);
  gl_FragColor = vec4(mix(sharp.rgb, b.rgb, w), 1.0);
}`;

// ---------- Bloom ----------
const BLOOM_DOWN = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel; // source texel
uniform float uPrefilter;
uniform float uThreshold;
uniform float uKnee;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
vec3 pre(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * contrib;
}
void main() {
  vec3 a = tap(vec2(-2, 2)), b = tap(vec2(0, 2)), c = tap(vec2(2, 2));
  vec3 d = tap(vec2(-2, 0)), e = tap(vec2(0, 0)), f = tap(vec2(2, 0));
  vec3 g = tap(vec2(-2, -2)), h = tap(vec2(0, -2)), i = tap(vec2(2, -2));
  vec3 j = tap(vec2(-1, 1)), k = tap(vec2(1, 1)), l = tap(vec2(-1, -1)), m = tap(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter > 0.5) col = pre(col);
  gl_FragColor = vec4(min(col, vec3(64.0)), 1.0);
}`;

const BLOOM_UP = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tLow;   // lower-res upsampled chain
uniform sampler2D tCur;   // this level's downsample
uniform vec2 uTexel;      // low texel
uniform float uRadius;
void main() {
  vec3 s = texture2D(tLow, vUv).rgb * 4.0;
  s += texture2D(tLow, vUv + vec2(uTexel.x, 0.0)).rgb * 2.0;
  s += texture2D(tLow, vUv - vec2(uTexel.x, 0.0)).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(0.0, uTexel.y)).rgb * 2.0;
  s += texture2D(tLow, vUv - vec2(0.0, uTexel.y)).rgb * 2.0;
  s += texture2D(tLow, vUv + uTexel).rgb;
  s += texture2D(tLow, vUv - uTexel).rgb;
  s += texture2D(tLow, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  s += texture2D(tLow, vUv + vec2(-uTexel.x, uTexel.y)).rgb;
  gl_FragColor = vec4(texture2D(tCur, vUv).rgb + s / 16.0 * uRadius, 1.0);
}`;

// ---------- Final ----------
export const GRAIN_GLSL = /* glsl */ `
uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcgHash(p.x + pcgHash(p.y + pcgHash(p.z)))) / 4294967295.0;
}
`;

const FINAL = /* glsl */ `
${GRAIN_GLSL}
varying vec2 vUv;
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform int uTonemap;
uniform float uSat;
uniform float uContrast;
uniform float uVignette;
uniform float uGrain;
uniform float uGrainDark;
uniform int uFrame;
uniform vec3 uLift;
uniform vec2 uRes;
uniform float uCA;
vec3 aces(vec3 x) {
  x *= 0.6;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 col;
  if (uCA > 0.0) {
    vec2 d = (vUv - 0.5) * uCA * (uRes.y / 720.0) / uRes * 1.4;
    col = vec3(texture2D(tSrc, vUv + d).r, texture2D(tSrc, vUv).g, texture2D(tSrc, vUv - d).b);
  } else col = texture2D(tSrc, vUv).rgb;
  col += texture2D(tBloom, vUv).rgb * uBloom;
  col = col * uExposure + uLift;
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  col *= 1.0 - uVignette * smoothstep(0.25, 1.1, length(q));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSat), 0.0);
  if (uTonemap == 1) col = aces(col);
  else if (uTonemap == 2) { float m = max(col.r, max(col.g, col.b)); col = col / (1.0 + max(m - 0.6, 0.0) / (1.0 + m)) ; }
  vec3 s = toSrgb(col);
  s = clamp((s - 0.5) * uContrast + 0.5, 0.0, 1.0);
  uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
  float g = hash3(p) + hash3(p + uvec3(0u, 0u, 7919u)) - 1.0; // triangular [-1,1]
  float lumD = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float ga = uGrain;
  if (uGrainDark > 0.0) ga *= smoothstep(uGrainDark * 0.5, uGrainDark * 1.5, lumD);
  s += g * ga;
  float dth = hash3(p + uvec3(0u, 0u, 104729u)) + hash3(p + uvec3(0u, 0u, 1299709u)) - 1.0;
  s += dth / 255.0;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

const BLOOM_LEVELS = 6;

export class Post {
  params: PostParams;
  private renderer: THREE.WebGLRenderer;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private w = 0;
  private h = 0;
  private rts: Record<string, THREE.WebGLRenderTarget> = {};
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private m: Record<string, THREE.ShaderMaterial>;
  private samples: number;

  constructor(renderer: THREE.WebGLRenderer, params: PostParams, samples = 4) {
    this.renderer = renderer;
    this.params = params;
    this.samples = samples;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const nf = { value: new THREE.Vector2(0.1, 100) };
    this.m = {
      ssao: mat(SSAO_FRAG, {
        uCamNF: nf,
        tDepth: { value: null },
        uProj: { value: new THREE.Matrix4() },
        uProjInv: { value: new THREE.Matrix4() },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 0.5 },
        uKernel: { value: aoKernel },
      }),
      aoBlur: mat(AO_BLUR_FRAG, { tAO: { value: null }, uTexel: { value: new THREE.Vector2() } }),
      aoApply: mat(AO_APPLY_FRAG, {
        tColor: { value: null },
        tAO: { value: null },
        uIntensity: { value: 1 },
        uPower: { value: 1 },
      }),
      prefilter: mat(DOF_PREFILTER, {
        uCamNF: nf,
        uFocus: { value: 1 },
        uAperture: { value: 1 },
        uMaxCoc: { value: 1 },
        tColor: { value: null },
        tDepth: { value: null },
        uSrcTexel: { value: new THREE.Vector2() },
      }),
      tileMax: mat(DOF_TILEMAX, { tSrc: { value: null }, uSrcSize: { value: new THREE.Vector2() } }),
      dilate: mat(DOF_DILATE, { tTile: { value: null }, uTexel: { value: new THREE.Vector2() } }),
      gather: mat(DOF_GATHER, {
        tSrc: { value: null },
        tTile: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uMaxCoc: { value: 1 },
      }),
      smooth: mat(DOF_SMOOTH, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }),
      composite: mat(DOF_COMPOSITE, {
        uCamNF: nf,
        uFocus: { value: 1 },
        uAperture: { value: 1 },
        uMaxCoc: { value: 1 },
        tColor: { value: null },
        tDepth: { value: null },
        tBlur: { value: null },
      }),
      down: mat(BLOOM_DOWN, {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uPrefilter: { value: 0 },
        uThreshold: { value: 1 },
        uKnee: { value: 0.5 },
      }),
      up: mat(BLOOM_UP, {
        tLow: { value: null },
        tCur: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
      }),
      final: mat(FINAL, {
        tSrc: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0 },
        uExposure: { value: 1 },
        uTonemap: { value: 1 },
        uSat: { value: 1 },
        uContrast: { value: 1 },
        uVignette: { value: 0 },
        uGrain: { value: 0 },
        uGrainDark: { value: 0 },
        uFrame: { value: 0 },
        uLift: { value: new THREE.Vector3() },
        uRes: { value: new THREE.Vector2() },
        uCA: { value: 0 },
      }),
    };
  }

  private rt(name: string, w: number, h: number, opts: THREE.RenderTargetOptions = {}) {
    if (!this.rts[name]) {
      this.rts[name] = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        ...opts,
      });
    }
    return this.rts[name];
  }

  private resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    for (const k of Object.keys(this.rts)) this.rts[k].dispose();
    this.bloomDown.forEach((r) => r.dispose());
    this.bloomUp.forEach((r) => r.dispose());
    this.rts = {};
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    depthTexture.format = THREE.DepthFormat;
    this.rt("scene", w, h, {
      samples: this.samples,
      depthBuffer: true,
      depthTexture,
    });
    this.bloomDown = [];
    this.bloomUp = [];
    let bw = w,
      bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
      const o = {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      };
      this.bloomDown.push(new THREE.WebGLRenderTarget(bw, bh, o));
      this.bloomUp.push(new THREE.WebGLRenderTarget(bw, bh, o));
    }
  }

  private pass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: number) {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x,
      h = size.y;
    this.resize(w, h);
    const p = this.params;
    const m = this.m;
    const hw = Math.max(1, Math.round(w / 2)),
      hh = Math.max(1, Math.round(h / 2));

    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    (m.prefilter.uniforms.uCamNF.value as THREE.Vector2).set(camera.near, camera.far);

    const sceneRT = this.rts.scene;
    r.setRenderTarget(sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(scene, camera);

    let src: THREE.Texture = sceneRT.texture;
    const depth = sceneRT.depthTexture!;

    if (p.ssao) {
      const ao = this.rt("ao", hw, hh);
      const ao2 = this.rt("ao2", hw, hh);
      const u = m.ssao.uniforms;
      u.tDepth.value = depth;
      (u.uProj.value as THREE.Matrix4).copy(camera.projectionMatrix);
      (u.uProjInv.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
      (u.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
      u.uRadius.value = p.ssao.radius;
      this.pass(m.ssao, ao);
      m.aoBlur.uniforms.tAO.value = ao.texture;
      (m.aoBlur.uniforms.uTexel.value as THREE.Vector2).set(1 / hw, 1 / hh);
      this.pass(m.aoBlur, ao2);
      const out = this.rt("aoOut", w, h);
      m.aoApply.uniforms.tColor.value = src;
      m.aoApply.uniforms.tAO.value = ao2.texture;
      m.aoApply.uniforms.uIntensity.value = p.ssao.intensity;
      m.aoApply.uniforms.uPower.value = p.ssao.power;
      this.pass(m.aoApply, out);
      src = out.texture;
    }

    if (p.dof) {
      const half = this.rt("dofHalf", hw, hh);
      const half2 = this.rt("dofHalf2", hw, hh);
      const tw = Math.ceil(hw / 8),
        th = Math.ceil(hh / 8);
      const tile = this.rt("dofTile", tw, th, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
      const apertureHalf = p.dof.aperture * hh;
      const maxHalf = p.dof.maxCoc * hh;
      const pu = m.prefilter.uniforms;
      pu.uFocus.value = p.dof.focus;
      pu.uAperture.value = apertureHalf;
      pu.uMaxCoc.value = maxHalf;
      pu.tColor.value = src;
      pu.tDepth.value = depth;
      (pu.uSrcTexel.value as THREE.Vector2).set(1 / w, 1 / h);
      this.pass(m.prefilter, half);
      m.tileMax.uniforms.tSrc.value = half.texture;
      (m.tileMax.uniforms.uSrcSize.value as THREE.Vector2).set(hw, hh);
      this.pass(m.tileMax, tile);
      const tile2 = this.rt("dofTile2", tw, th);
      m.dilate.uniforms.tTile.value = tile.texture;
      (m.dilate.uniforms.uTexel.value as THREE.Vector2).set(1 / tw, 1 / th);
      this.pass(m.dilate, tile2);
      const gu = m.gather.uniforms;
      gu.tSrc.value = half.texture;
      gu.tTile.value = tile2.texture;
      (gu.uTexel.value as THREE.Vector2).set(1 / hw, 1 / hh);
      gu.uMaxCoc.value = maxHalf;
      this.pass(m.gather, half2);
      m.smooth.uniforms.tSrc.value = half2.texture;
      (m.smooth.uniforms.uTexel.value as THREE.Vector2).set(1 / hw, 1 / hh);
      this.pass(m.smooth, half);
      const out = this.rt("dofOut", w, h);
      const cu = m.composite.uniforms;
      cu.uFocus.value = p.dof.focus;
      cu.uAperture.value = p.dof.aperture * h;
      cu.uMaxCoc.value = p.dof.maxCoc * h;
      cu.tColor.value = src;
      cu.tDepth.value = depth;
      cu.tBlur.value = half.texture;
      this.pass(m.composite, out);
      src = out.texture;
    }

    // bloom
    const du = m.down.uniforms;
    du.uThreshold.value = p.bloom.threshold;
    du.uKnee.value = p.bloom.knee;
    let prevTex: THREE.Texture = src;
    let pw = w,
      ph = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      du.tSrc.value = prevTex;
      (du.uTexel.value as THREE.Vector2).set(1 / pw, 1 / ph);
      du.uPrefilter.value = i === 0 ? 1 : 0;
      this.pass(m.down, this.bloomDown[i]);
      prevTex = this.bloomDown[i].texture;
      pw = this.bloomDown[i].width;
      ph = this.bloomDown[i].height;
    }
    let low: THREE.WebGLRenderTarget = this.bloomDown[BLOOM_LEVELS - 1];
    const uu = m.up.uniforms;
    uu.uRadius.value = p.bloom.radius;
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      uu.tLow.value = low.texture;
      uu.tCur.value = this.bloomDown[i].texture;
      (uu.uTexel.value as THREE.Vector2).set(1 / low.width, 1 / low.height);
      this.pass(m.up, this.bloomUp[i]);
      low = this.bloomUp[i];
    }

    const fu = m.final.uniforms;
    fu.tSrc.value = src;
    fu.tBloom.value = this.bloomUp[0].texture;
    fu.uBloom.value = p.bloom.strength;
    fu.uExposure.value = p.exposure;
    fu.uTonemap.value = p.tonemap;
    fu.uSat.value = p.saturation;
    fu.uContrast.value = p.contrast;
    fu.uVignette.value = p.vignette;
    fu.uGrain.value = p.grain;
    fu.uGrainDark.value = p.grainDarkFade;
    fu.uFrame.value = ((frame % p.loopFrames) + p.loopFrames) % p.loopFrames;
    (fu.uLift.value as THREE.Vector3).set(...p.lift);
    (fu.uRes.value as THREE.Vector2).set(w, h);
    fu.uCA.value = p.ca ?? 0;
    this.pass(m.final, null);
  }

  dispose() {
    for (const k of Object.keys(this.rts)) this.rts[k].dispose();
    this.bloomDown.forEach((r) => r.dispose());
    this.bloomUp.forEach((r) => r.dispose());
    Object.values(this.m).forEach((x) => x.dispose());
  }
}
