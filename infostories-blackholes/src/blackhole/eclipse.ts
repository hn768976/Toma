import type { WebGLRenderer } from "three";
import { GLSL_COMMON, hexToVec } from "../lib/glsl";
import { FullscreenPass } from "../lib/pass";
import { animFrame, grainFrame } from "../lib/loop";
import type { StageFactory } from "../lib/GLStage";

/** Look 2 — Black Hole Eclipse. One full-screen fragment shader, fixed camera, 600-frame loop. */
export type EclipseParams = {
  period: number;
  ringHot: string; ringMid: string; ringCool: string;
  glowInner: string; glowOuter: string;
  cream: string; tan: string; brown: string;
  hazeHi: string; hazeLo: string;
  grain: number;
};

const FRAG = GLSL_COMMON + /* glsl */ `
uniform vec2 uRes;
uniform float uFrame;    // frame % period
uniform vec3 uRingHot, uRingMid, uRingCool, uGlowIn, uGlowOut, uCream, uTan, uBrown, uHazeHi, uHazeLo;
uniform float uGrain;
in vec2 vUv;
out vec4 outColor;

const float R = 0.20;           // disc radius, frame heights
const vec2 C = vec2(0.0, 0.015); // centre at (50%, 48.5% from top): just above centre

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Flow noise: two phases sliding around the disc, cross-faded (exactly periodic).
float dustField(vec2 p, float d, out float lanes) {
  float acc = 0.0; float lacc = 0.0;
  for (int k = 0; k < 2; k++) {
    float ph = fract(phaseK(4) + float(k) * 0.5);
    int cyc = cycleK(4, k);
    uint seed = uint(cyc * 2 + k) * 7919u + 11u;
    float w = 1.0 - abs(ph * 2.0 - 1.0);
    // angular slide: faster near the disc (differential rotation)
    float slide = (ph - 0.5) * 0.55 * pow(R / max(d, R), 1.5);
    vec2 q = rot(slide) * p;
    float a = atan(q.y, q.x);
    // tangentially stretched coordinates (periodic in angle)
    vec3 s3 = vec3(cos(a) * 1.05, sin(a) * 1.05, d * 22.0);
    vec3 warp = vec3(pfbm(s3 * 1.3 + vec3(3.1, 0.0, 0.0), 4, 3, seed + 3u),
                     pfbm(s3 * 1.3 + vec3(0.0, 5.7, 0.0), 4, 3, seed + 5u), 0.0);
    vec3 sp = vec3(q * 3.2 + warp.xy * 0.9, zLoop(4));
    float n = pfbm(vec3(s3.xy + warp.xy * 0.35, s3.z + warp.x * 2.0), 4, 5, seed);
    float n2 = pfbm(sp * vec3(1.0, 1.0, 1.0), 4, 4, seed + 77u);
    acc += w * (0.8 * n + 0.2 * n2);
    lacc += w * pfbm(vec3(s3.xy * 0.9 + warp.yx * 0.7, d * 16.0 + warp.x * 0.8), 4, 4, seed + 31u);
  }
  lanes = lacc;
  return acc;
}

vec3 stars(vec2 fc) {
  vec2 uv = fc / uRes.y;
  float cell = 0.013;
  vec2 g = uv / cell;
  ivec2 id = ivec2(floor(g));
  vec3 col = vec3(0.0);
  float px = 1.0 / uRes.y;
  for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {
    ivec2 c = id + ivec2(ox, oy);
    if (hash2i(c, 1u) > 0.3) continue;
    vec2 pos = (vec2(c) + 0.15 + 0.7 * vec2(hash2i(c, 2u), hash2i(c, 3u))) * cell;
    float b = pow(hash2i(c, 4u), 8.0);
    float r = mix(0.00025, 0.0009, b);
    float sig = max(r, 0.55 * px);
    float dd = length(uv - pos);
    float tw = 1.0 + 0.3 * sin(TAU * (phaseK(1 + int(hash2i(c, 5u) * 3.0)) + hash2i(c, 6u)));
    float inten = (0.06 + 0.8 * b) * (r * r) / (sig * sig) * tw;
    vec3 tint = mix(vec3(0.8, 0.95, 0.95), vec3(1.0, 0.85, 0.6), hash2i(c, 7u));
    col += tint * inten * exp(-dd * dd / (2.0 * sig * sig));
  }
  return col;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 uv = fc / uRes;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) - C;
  float px = 1.0 / uRes.y;
  float d = length(p);
  float ang = atan(p.y, p.x);
  float s = max(d - R, 0.0);

  // --- dust geometry: thick 'eye' annulus round the hole + smile-shaped wings
  vec2 q = rot(-0.05) * p;
  float wingW = 0.032 + 0.05 * exp(-pow(q.x / 0.32, 2.0));
  float wingC = 0.07 - 0.34 * exp(-pow(q.x / 0.42, 2.0));   // ends rise, lowest under the disc
  float wing = exp(-pow((q.y - wingC) / wingW, 2.0)) * smoothstep(0.8, 0.3, abs(q.x)) * smoothstep(0.08, 0.3, abs(q.x));
  float bottomW = smoothstep(0.55, -0.75, sin(ang));
  float leftW = smoothstep(0.2, -0.9, cos(ang));
  float sideW = smoothstep(0.75, -0.2, sin(ang));  // left, right and bottom; little on top
  float lowRight = smoothstep(0.3, 1.0, cos(ang + 0.6));
  float topRight = smoothstep(0.2, 0.95, sin(ang)) * smoothstep(-0.7, 0.3, cos(ang));
  float ann = exp(-pow(s / (0.045 + 0.05 * leftW + 0.04 * lowRight + 0.01 * bottomW), 1.4)) * (1.0 - 0.8 * topRight) * (0.55 + 0.45 * sideW);
  float density = clamp(ann + wing * 0.5, 0.0, 1.4);

  // --- background: black at top into teal haze, lower right
  float hz = exp(-pow((p.x - 0.2 + 0.3 * p.y) / (0.36 - 0.45 * p.y), 2.0)) * smoothstep(0.02, -0.36, p.y);
  float hzLow = smoothstep(0.6, 0.15, uv.y) * mix(0.45, 1.0, smoothstep(-0.6, 0.5, p.x)) * 0.6;
  float hn = pfbm(vec3(uv * vec2(aspect, 1.0) * 2.2, zLoop(2)), 2, 3, 900u);
  vec3 col = mix(vec3(0.0), uHazeLo, hzLow * 0.9);
  col = mix(col, uHazeHi, clamp(hz * (1.1 + 0.3 * hn) + wing * 0.35, 0.0, 1.0));
  col = srgb2lin(col);
  // stars: fine specks, densest inside the nebula and haze, sparse in empty corners
  col += stars(fc) * (0.3 + 1.2 * clamp(density * 1.5 + hz, 0.0, 1.0));

  // --- red-orange glow lobe, upper left
  float dirW = mix(0.08, 1.0, smoothstep(0.1, 0.98, cos(ang - 2.3)));
  float glow = (exp(-pow(max(s - 0.045, 0.0) / 0.075, 1.1)) * smoothstep(0.0, 0.05, s) * 0.85 + 0.15 * exp(-s / 0.05)) * exp(-pow(s / 0.24, 2.0)) * dirW;
  vec3 glowCol = mix(srgb2lin(uGlowOut), srgb2lin(uGlowIn), exp(-s / 0.11));
  col += glowCol * glow * 2.6;

  // --- dust: cream / peach near the hole, tan outward, brown lanes; partly opaque
  float lanes;
  float n = dustField(p, d, lanes);
  float dn = smoothstep(-0.35, 0.45, n);
  float near = exp(-s / 0.06);
  vec3 dcol = mix(srgb2lin(uTan), srgb2lin(uCream), clamp(dn * 0.7 + near * 0.7, 0.0, 1.0));
  dcol = mix(dcol, srgb2lin(vec3(1.0, 0.86, 0.72)), near * 0.5);
  vec3 wingTint = mix(dcol, srgb2lin(vec3(0.36, 0.5, 0.46)), smoothstep(0.22, 0.5, abs(q.x)) * 0.75);
  float dustI = density * (0.3 + 0.95 * dn) * (0.5 + 1.1 * near);
  col = col * (1.0 - 0.8 * clamp(ann * 1.3, 0.0, 1.0)) + wingTint * dustI * 1.1;
  float lane = smoothstep(0.0, 0.4, lanes) * smoothstep(0.05, 0.4, density) * smoothstep(-0.2, 0.6, -sin(ang) + 0.3 * abs(cos(ang)));
  col = mix(col, srgb2lin(uBrown) * 0.5, clamp(lane * 1.05, 0.0, 0.9) * (1.0 - near * 0.3));
  // pale blue-white glow just under the bottom edge
  col += srgb2lin(vec3(0.62, 0.8, 0.84)) * 0.4 * exp(-length((p - vec2(0.02, -0.215)) * vec2(0.75, 1.7)) / 0.045);

  // --- fiery inner rim (10 to 3 o'clock, mottled) + flame wisps
  float hot = smoothstep(-0.45, 1.0, cos(ang - 0.95));
  float rn = pnoise(vec3(cos(ang) * 3.0, sin(ang) * 3.0, zLoop(6)), 6, 300u) * 0.5 + 0.5;
  float rn2 = pnoise(vec3(cos(ang) * 9.0, sin(ang) * 9.0, zLoop(10)), 10, 301u) * 0.5 + 0.5;
  float rn3 = pnoise(vec3(cos(ang) * 28.0, sin(ang) * 28.0, (d - R) * 160.0 + zLoop(12)), 12, 302u) * 0.5 + 0.5;
  float ringW = 0.004 + 0.009 * pow(hot, 2.0);
  float ring = exp(-pow((d - R - 0.7 * ringW) / ringW, 2.0));
  float heat = clamp(hot * 0.75 + (rn - 0.5) * 0.6 + (rn2 - 0.5) * 0.3, 0.0, 1.0);
  vec3 ringCol = mix(srgb2lin(uRingCool), srgb2lin(uRingMid), smoothstep(0.1, 0.55, heat));
  ringCol = mix(ringCol, srgb2lin(uRingHot), smoothstep(0.55, 0.95, heat));
  ringCol = mix(ringCol, srgb2lin(vec3(1.0, 0.82, 0.25)), smoothstep(0.5, 0.9, hot) * 0.5 * rn3);
  float lowFade = mix(0.3, 1.0, smoothstep(-0.9, 0.2, sin(ang)));
  col += ringCol * ring * (0.9 + 2.4 * heat) * lowFade * (0.45 + 0.9 * rn3);
  vec3 wp = vec3(cos(ang) * 11.0, sin(ang) * 11.0, s * 24.0 - zLoop(6));
  float wisp = pfbm(wp + vec3(pnoise(wp * 0.5, 3, 401u) * 1.3, 0.0, 0.0), 6, 3, 400u);
  wisp = pow(clamp(wisp * 0.5 + 0.55, 0.0, 1.0), 4.0);
  col += mix(srgb2lin(uRingCool), srgb2lin(uRingMid), heat) * wisp * exp(-s / 0.02) * (0.3 + 1.4 * hot) * lowFade * 1.3;

  // --- tone (soft shoulder, hot whites), vignette
  col = col / (1.0 + max(col - 0.8, 0.0) * 0.6);
  vec3 outC = lin2srgb(col);
  vec2 vq = uv - 0.5;
  outC *= 1.0 - 0.22 * pow(dot(vq, vq) * 2.0, 1.4);

  // --- the black disc (hard, anti-aliased edge): grain/dither stay outside
  float disc = smoothstep(R - 0.8 * px, R + 0.8 * px, d); // 0 inside
  uint fr = uint(uFrame);
  outC += (grainN(fc, fr) * uGrain + ditherTri(fc, fr)) * disc;
  outColor = vec4(clamp(outC * disc, 0.0, 1.0), 1.0);
}`;

export const createEclipse =
  (prm: EclipseParams): StageFactory =>
  (gl: WebGLRenderer, w: number, h: number) => {
    const pass = new FullscreenPass(FRAG, {
      uRes: { value: [w, h] },
      uFI: { value: 0 },
      uPI: { value: prm.period },
      uFrame: { value: 0 },
      uRingHot: { value: hexToVec(prm.ringHot) },
      uRingMid: { value: hexToVec(prm.ringMid) },
      uRingCool: { value: hexToVec(prm.ringCool) },
      uGlowIn: { value: hexToVec(prm.glowInner) },
      uGlowOut: { value: hexToVec(prm.glowOuter) },
      uCream: { value: hexToVec(prm.cream) },
      uTan: { value: hexToVec(prm.tan) },
      uBrown: { value: hexToVec(prm.brown) },
      uHazeHi: { value: hexToVec(prm.hazeHi) },
      uHazeLo: { value: hexToVec(prm.hazeLo) },
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
