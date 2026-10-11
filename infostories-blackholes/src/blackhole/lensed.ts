import type { WebGLRenderer } from "three";
import { GLSL_COMMON, hexToVec } from "../lib/glsl";
import { FullscreenPass } from "../lib/pass";
import { animFrame, grainFrame } from "../lib/loop";
import type { StageFactory } from "../lib/GLStage";

/**
 * Look 3 — Lensed Black Hole. Analytic lensing: each disc image (direct near,
 * direct far, upper lensed arch, lower lensed arc) is a nested family of
 * ellipses A(u), B(u) over normalised orbit radius u; per pixel we solve for u
 * by bisection, then texture with 300 orbital bands in (u, theta).
 */
export type LensedParams = {
  period: number;
  ring: string; inner: string; outer: string; bg0: string; bg1: string; shadowGlow: string;
  grain: number;
};

const FRAG = GLSL_COMMON + /* glsl */ `
uniform vec2 uRes;
uniform float uFrame;
uniform vec3 uRing, uInner, uOuter, uBg0, uBg1, uShadow;
uniform float uGrain;
in vec2 vUv;
out vec4 outColor;

const float RS = 0.19;     // shadow radius (frame heights)
const float RIN = 0.196;    // inner disc edge
const float ROUT = 0.8;    // outer disc edge (~ +-40% of frame width)
const float SINE = 0.2;    // view elevation -> disc aspect ~1:5
const float TILT = 0.12;   // disc rises to the left
const float NB = 300.0;    // orbital bands
const float LOWSQ = 0.97;  // lower half of the shadow outline is flattened (seen past the disc)

float rOf(float u) { return mix(RIN, ROUT, u); }
// image families ------------------------------------------------------------
// 0: direct disc (near & far), 1: upper lensed arch, 2: lower lensed arc
vec2 famAB(int fam, float u) {
  if (fam == 0) { float r = rOf(u); return vec2(r, r * SINE - 0.02 * exp(-(r - RIN) / 0.2)); }
  if (fam == 1) return vec2(RS * 1.05 + u * (ROUT * 0.66 - RS * 1.05), RS * (1.04 + 0.56 * pow(u, 0.85)));
  float k = RS * (1.03 + 0.6 * pow(u, 0.85)); return vec2(k * 1.04, k * LOWSQ);
}
// returns u in [0,1] or -1 when the pixel is outside the family
float solveU(int fam, vec2 q) {
  vec2 ab0 = famAB(fam, 0.0), ab1 = famAB(fam, 1.0);
  float f0 = dot(q / ab0, q / ab0), f1 = dot(q / ab1, q / ab1);
  if (f0 < 1.0 || f1 > 1.0) return -1.0;
  float lo = 0.0, hi = 1.0;
  for (int i = 0; i < 16; i++) {
    float m = 0.5 * (lo + hi);
    vec2 ab = famAB(fam, m);
    if (dot(q / ab, q / ab) > 1.0) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}

// fine orbital streaks at a given band count; every band turns a whole number of times per loop
float streakLevel(float u, float theta, uint seed, float nb, float lvl) {
  float bf = u * nb;
  float bi = floor(bf);
  uint b = uint(bi) + uint(lvl) * 100003u;
  float h = hash1(b * 2654435761u ^ seed);
  float strand = vnoise1p(bf / 3.0, 100000, seed ^ 0x51u ^ uint(lvl));
  h = h * 0.35 + 0.65 * smoothstep(0.25, 0.85, strand);
  int turns = 1 + int(floor(pow(1.0 - u, 1.3) * 5.999));     // 6 inside -> 1 outside
  float a = theta / TAU - phaseK(turns);                       // co-rotating angle
  int fq = 12 + int(hash1(b * 40503u ^ seed ^ 77u) * 40.0);
  float s1 = vnoise1p(a * float(fq), fq, b * 9176u ^ seed);
  float s2 = vnoise1p(a * float(fq / 4 + 1), fq / 4 + 1, b * 7331u ^ seed ^ 5u);
  float st = smoothstep(0.35, 0.95, s1) * (0.25 + 0.75 * s2);
  float fw = fwidth(bf);
  float prof = 0.5 + 0.5 * cos(TAU * (fract(bf) - 0.5));
  prof = mix(prof, 0.5, clamp(fw * 1.2 - 0.25, 0.0, 1.0));
  float bright = 0.2 + 1.2 * h * h;
  return st * bright * prof * 2.6;
}
// ~300 bands; where bands fall below a pixel, coarser band groups are used
// (like mip levels), so the texture stays fibrous instead of averaging to haze
float streaks(float u, float theta, uint seed) {
  float fw = max(fwidth(u * NB), 1e-4);
  float lev = clamp(log2(fw * 1.6), 0.0, 4.0);
  float l0 = floor(lev);
  float s0 = streakLevel(u, theta, seed, NB / exp2(l0), l0);
  float s1 = streakLevel(u, theta, seed, NB / exp2(l0 + 1.0), l0 + 1.0);
  float c0 = streakLevel(u, theta, seed ^ 0x77u, NB / exp2(l0 + 2.5), l0 + 2.5);  // coarse clumping
  return mix(s0, s1, lev - l0) * (0.35 + 1.1 * c0);
}

vec3 discEmission(float u, float theta, float doppler) {
  vec3 c = mix(uInner, uOuter, smoothstep(0.0, 0.65, u));
  c = mix(c, uRing, exp(-u * 18.0) * 0.4);
  float inten = 8.0 * exp(-u * 3.0) + 0.35 + 14.0 * exp(-u * 30.0);
  return c * inten * doppler;
}

vec3 starsSparse(vec2 fc) {
  vec2 uv = fc / uRes.y; float cell = 0.03; ivec2 id = ivec2(floor(uv / cell));
  float px = 1.0 / uRes.y;
  if (hash2i(id, 21u) > 0.22) return vec3(0.0);
  vec2 pos = (vec2(id) + 0.2 + 0.6 * vec2(hash2i(id, 22u), hash2i(id, 23u))) * cell;
  float b = pow(hash2i(id, 24u), 4.0);
  float r = mix(0.0003, 0.0008, b); float sig = max(r, 0.55 * px);
  float tw = 1.0 + 0.25 * sin(TAU * phaseK(1 + int(hash2i(id, 25u) * 3.0)) + 6.0 * hash2i(id, 26u));
  float dd = length(uv - pos);
  return vec3(1.0, 0.85, 0.8) * (0.05 + 0.35 * b) * (r * r) / (sig * sig) * tw * exp(-dd * dd / (2.0 * sig * sig));
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p0 = vec2((uv.x - 0.48) * aspect, uv.y - 0.5);
  float ct = cos(TILT), st = sin(TILT);
  vec2 p = vec2(ct * p0.x - st * p0.y, st * p0.x + ct * p0.y);
  float px = 1.0 / uRes.y;

  vec2 pe = vec2(p.x / 1.02, p.y > 0.0 ? p.y : p.y / LOWSQ);
  float rho = length(pe);
  float shadow = 1.0 - smoothstep(RS - px, RS + px, rho);   // 1 inside

  // background + broad halo
  vec3 col = mix(uBg1, uBg0, smoothstep(0.15, 1.1, length(p0 * vec2(0.8, 1.0))));
  col += starsSparse(fc);
  col += uInner * 0.09 * exp(-max(rho - RS, 0.0) / 0.09);
  col += uOuter * 0.025 * exp(-abs(p.y) / 0.05) * exp(-abs(p.x) / 0.4);
  col += uOuter * 0.14 * exp(-length(p * vec2(0.5, 1.15)) / 0.17);
  col += uOuter * 0.05 * exp(-length((p - vec2(0.2, 0.1)) * vec2(0.8, 1.0)) / 0.15);
  

  // shadow interior: soft pink glow, brighter toward the rim
  col = mix(col, uShadow * (0.8 + 0.2 * pow(rho / RS, 2.0)) * mix(0.12, 1.0, smoothstep(-0.14, -0.03, p.y)), shadow);

  vec2 qa = vec2(p.x, abs(p.y));
  float nearA = 0.0; vec3 nearE = vec3(0.0);
  // direct image (fam 0): far half hidden by the shadow, near half in front
  float u0 = solveU(0, qa);
  if (u0 >= 0.0) {
    vec2 ab = famAB(0, u0);
    float th = atan(p.y / ab.y, p.x / ab.x);
    float dop = 1.0 + 0.35 * (-cos(th));
    float edge = smoothstep(0.0, 0.03, u0) * smoothstep(1.0, 0.5, u0);
    vec3 e = discEmission(u0, th, dop) * (0.1 + streaks(u0, th, 11u)) * edge;
    if (p.y > 0.0) col += e * 0.75 * (1.0 - shadow);
    else { nearA = 0.95 * edge * smoothstep(1.0, 0.35, u0); nearE = e * 1.35; }
  }
  // upper lensed arch: the disc's far side bent over the top
  if (p.y > 0.0) {
    float u1 = solveU(1, qa);
    if (u1 >= 0.0) {
      vec2 ab = famAB(1, u1);
      float th = atan(p.y / ab.y, p.x / ab.x);
      float dop = 1.0 + 0.35 * (-cos(th));
      float edge = smoothstep(0.0, 0.02, u1) * smoothstep(1.0, 0.6, u1);
      float base = 1.0;
      float ud = u1 * 0.35;  // lensed images show the inner disc, magnified
      col += discEmission(u1 * 0.55, th, dop) * (0.1 + streaks(ud, th, 23u)) * 0.85 * edge * base;
    }
  } else {
    // lower lensed arc: thinner and dimmer, under the shadow
    float u2 = solveU(2, qa);
    if (u2 >= 0.0) {
      vec2 ab = famAB(2, u2);
      float th = atan(p.y / ab.y, p.x / ab.x);
      float dop = 1.0 + 0.35 * (-cos(th));
      float ang = smoothstep(0.5, 0.92, -p.y / max(length(p), 1e-4));
      float edge = smoothstep(0.0, 0.01, u2) * smoothstep(1.0, 0.35, u2);
      float ud = u2 * 0.25;
      col += discEmission(u2 * 0.7, -th, dop) * (0.03 + streaks(ud, -th, 37u)) * edge * ang * 0.9;
    }
  }
  // photon ring: thin, white-hot, brightest at the top, plus a soft halo
  float dr = rho - RS * 1.012;
  float topW = smoothstep(-0.7, 0.6, p.y / max(rho, 1e-4));
  float ringW = mix(0.0016, 0.011, topW);
  col += uRing * (exp(-dr * dr / (ringW * ringW)) * mix(1.6, 9.0, topW));
  col += uRing * 0.9 * exp(-abs(dr) / 0.02) * mix(0.25, 1.0, topW);
  col = col * (1.0 - nearA) + nearE;   // the near side of the disc passes in front

  // tone map: exponential shoulder -> hot cores go white
  vec3 tm = 1.0 - exp(-col * 1.0);
  float tl = dot(tm, vec3(0.3, 0.55, 0.15));
  tm = clamp(mix(vec3(tl), tm, 1.18), 0.0, 1.0);
  vec3 outC = lin2srgb(tm);
  vec2 vq = uv - 0.5;
  outC *= 1.0 - 0.35 * pow(dot(vq, vq) * 2.0, 1.3);
  uint fr = uint(uFrame);
  outC += grainN(fc, fr) * uGrain + ditherTri(fc, fr);
  outColor = vec4(clamp(outC, 0.0, 1.0), 1.0);
}`;

const lin = (hex: string) => hexToVec(hex).map((c) => Math.pow(c, 2.2)) as [number, number, number];

export const createLensed =
  (prm: LensedParams): StageFactory =>
  (gl: WebGLRenderer, w: number, h: number) => {
    const pass = new FullscreenPass(FRAG, {
      uRes: { value: [w, h] },
      uFI: { value: 0 },
      uPI: { value: prm.period },
      uFrame: { value: 0 },
      uRing: { value: lin(prm.ring) },
      uInner: { value: lin(prm.inner) },
      uOuter: { value: lin(prm.outer) },
      uBg0: { value: lin(prm.bg0) },
      uBg1: { value: lin(prm.bg1) },
      uShadow: { value: lin(prm.shadowGlow) },
      uGrain: { value: prm.grain },
    });
    return {
      render: (frame) => {
        pass.uniforms.uFI.value = animFrame(frame, prm.period);
        pass.uniforms.uFrame.value = grainFrame(frame, prm.period);
        pass.render(gl, null);
      },
      dispose: () => pass.dispose(),
    };
  };
