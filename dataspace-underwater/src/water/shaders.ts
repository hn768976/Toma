// Water kit shaders (GLSL ES 3.00, run by PixiJS 8 on WebGL2).
//
// Loop rule: the only time input is uTheta = 2π·(frame % 600)/600. Every
// time-dependent term is either sin/cos(k·uTheta) with integer k, or the
// caustic below whose time terms are integer multiples of uTheta, so
// frame 600 is identical to frame 0.

import { GLSL_FINAL } from "../lib/glsl";

/** Full-screen quad in clip space; vUV has y = 0 at the top of the frame. */
export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
out vec2 vUV;
void main() {
  vUV = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
precision highp float;
#define TAU 6.28318530718
uniform float uTheta;     // 2π·(frame%600)/600
uniform vec2  uRes;       // output size in device px
uniform vec3  uDeep;
uniform vec3  uMid;
uniform vec3  uTop;
uniform vec3  uRayCol;
uniform vec3  uSunCol;
uniform vec2  uSun;       // sun patch centre (uv, y down; may be < 0)
uniform float uSunR;      // sun patch radius (fraction of height)
uniform float uFlare;     // 0..1 flare amount this frame (from whole-cycle formula)
uniform float uRayGain;
uniform float uRayDensity; // scales ray angular frequencies (~ray count)
uniform float uRayReach;  // how far down the rays reach (uv.y)
uniform float uSurface;   // strength of the surface wave lines
uniform float uLift;      // strength of the radial lift under the sun
uniform float uRaySrc;    // how far above the surface the rays converge (smaller = wider fan)
uniform float uRayFan;    // angular falloff of the fan
uniform float uSunCore;   // brightness of the sun patch core
uniform float uLiftReach; // vertical reach of the lit column
uniform float uRayLean;   // sideways offset of the ray source
uniform float uRayStart;  // depth at which rays reach full strength
uniform float uRaySharp;  // ray exponent multiplier
uniform float uSunEdge;   // sun patch inner radius fraction
uniform float uSunBreak;  // ripple breakup of the sun patch
uniform vec2  uColumn;    // bubble-column glow: x (uv), strength
uniform float uRayFine;   // strength of the fine crisp streaks

// Loopable caustic: a variant of the classic iterative water-caustic, with all
// time multipliers integers so it is exactly periodic in t over 2π.
float caustic(vec2 pIn, float t) {
  vec2 p = mod(pIn, TAU * 8.0) - 250.0;
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float k = (n == 0) ? -2.0 : (n == 1) ? -1.0 : (n == 2) ? 1.0 : 2.0;
    float tt = t * k;
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return min(pow(abs(c), 8.0), 3.0);
}

vec2 aspectP(vec2 uv) { return vec2(uv.x * uRes.x / uRes.y, uv.y); }

// Periodic surface displacement (sum of waves, whole cycles per loop).
vec2 surfaceWarp(vec2 p) {
  float t = uTheta;
  return vec2(
    0.55 * sin(p.x * 9.0 + p.y * 4.0 + 2.0 * t + 0.3) + 0.35 * sin(p.x * 17.0 - p.y * 11.0 - 3.0 * t + 1.7) + 0.2 * sin(p.x * 31.0 + 5.0 * t + 4.1),
    0.55 * sin(p.y * 13.0 - p.x * 6.0 + 3.0 * t + 2.2) + 0.35 * sin(p.x * 21.0 + p.y * 7.0 + 2.0 * t + 0.9) + 0.2 * sin(p.y * 37.0 - 4.0 * t + 5.3)
  );
}

// God-ray brightness for a point (uv). Rays fan from a source above the sun
// patch; the angular pattern is a sum of ray families that sway with whole-
// cycle phases, modulated by the surface caustic so they flicker.
float rayField(vec2 uv) {
  float asp = uRes.x / uRes.y;
  vec2 src = vec2((uSun.x + uRayLean) * asp, uSun.y - uRaySrc);
  vec2 d = aspectP(uv) - src;
  float ang = atan(d.x, d.y);
  float r = length(d);
  float t = uTheta;
  float D = uRayDensity;

  float s = 0.0;
  s += 0.42 * pow(0.5 + 0.5 * cos(ang * 23.0 * D + 1.3 + 0.9 * sin(t + 0.4) + 0.4 * sin(2.0 * t + 2.1)), 5.0 * uRaySharp);
  s += 0.36 * pow(0.5 + 0.5 * cos(ang * 37.0 * D + 4.1 - 1.1 * sin(t + 1.9) + 0.5 * sin(3.0 * t + 0.2)), 7.0 * uRaySharp);
  s += 0.30 * pow(0.5 + 0.5 * cos(ang * 53.0 * D + 2.6 + 1.3 * sin(2.0 * t + 4.4)), 9.0 * uRaySharp);
  s += 0.22 * pow(0.5 + 0.5 * cos(ang * 79.0 * D + 0.7 - 1.6 * sin(t + 3.3) + 0.6 * sin(2.0 * t)), 12.0 * uRaySharp);
  s += 0.15 * pow(0.5 + 0.5 * cos(ang * 113.0 * D + 5.5 + 2.0 * sin(3.0 * t + 1.1)), 14.0 * uRaySharp);

  // Fine crisp streaks on top of the broad shafts (fixed sharpness).
  s += uRayFine * 0.30 * pow(0.5 + 0.5 * cos(ang * 61.0 + 1.9 + 1.2 * sin(t + 2.4)), 22.0);
  s += uRayFine * 0.24 * pow(0.5 + 0.5 * cos(ang * 97.0 + 0.4 - 1.4 * sin(2.0 * t + 0.8)), 26.0);
  s += uRayFine * 0.18 * pow(0.5 + 0.5 * cos(ang * 143.0 + 3.3 + 1.7 * sin(t + 5.0)), 30.0);
  // Surface ripples focus light into some rays more than others.
  float cs = caustic(vec2(ang * 6.0 + 11.0, 3.7), t);
  s *= 0.45 + 1.4 * cs;
  // Broad brightness envelope across the fan (slow whole-cycle drift).
  float env = 0.55 + 0.45 * sin(ang * 4.0 + 0.8 + 0.6 * sin(t + 0.5));
  s *= env;
  // Breakup along the length, drifting down the rays (whole cycles).
  s *= 0.7 + 0.6 * caustic(vec2(ang * 9.0 + 3.0, r * 2.2 - 0.0), t);
  // Gentle edge flicker.
  s *= 0.85 + 0.15 * sin(ang * 151.0 * D + 4.0 * t + 2.0 * sin(t));

  // Fade with depth; ray lengths vary across the fan.
  float len = uRayReach * (0.6 + 0.4 * (0.5 + 0.5 * sin(ang * 9.0 + 2.2 + 0.7 * sin(t + 2.6))));
  float fade = smoothstep(len, 0.0, uv.y) * exp(-uv.y * 1.1);
  // Rays emerge just under the surface glow.
  fade *= smoothstep(-0.05, uRayStart, uv.y + 0.02);
  // Wider fan edges are weaker.
  fade *= exp(-ang * ang * uRayFan);
  return s * fade;
}

// Distance in "surface patch" space (ellipse — the surface is seen obliquely).
float sunDist(vec2 uv, out vec2 q) {
  float asp = uRes.x / uRes.y;
  vec2 p = aspectP(uv);
  vec2 c = vec2(uSun.x * asp, uSun.y);
  q = (p - c) * vec2(1.0, 1.9);
  q += 0.024 * surfaceWarp(p * 1.6) + 0.016 * surfaceWarp(p * 4.3 + 1.7) + 0.008 * surfaceWarp(p * 9.1 + 3.1);
  return length(q);
}
`;

/** Pass 1 — water background, surface underside lines, radial lift. */
export const WATER_BG_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uBN;
uniform vec2 uBNOffset;
in vec2 vUV;
out vec4 fragColor;
void main() {
  vec2 uv = vUV;
  float asp = uRes.x / uRes.y;
  vec2 p = aspectP(uv);
  vec2 sp = vec2(uSun.x * asp, uSun.y);

  // Lit water: a broad column of light under the sun, brightest at mid
  // depth, dark navy at the sides and the bottom (as the reference footage).
  vec2 dl = (p - sp) * vec2(0.8, 1.0);
  float dx = (uv.x - uSun.x) * asp;
  float y = uv.y;
  float wMid = 0.62 + 0.12 * y;
  float wTop = 0.30 + 0.10 * y;
  float mMid = exp(-(dx * dx) / (wMid * wMid)) * (1.0 - 0.25 * smoothstep(0.6, 1.0, y));
  float mTop = exp(-(dx * dx) / (wTop * wTop)) * (exp(-pow((y - 0.4) / (0.42 * uLiftReach), 2.0)) * 0.95);
  vec3 col = mix(uDeep, uMid, clamp(mMid * 1.1, 0.0, 1.0));
  col = mix(col, uTop, clamp(mTop * uLift, 0.0, 1.0));
  // Extra lift right under the sun patch.
  float near = exp(-dot(dl, dl) / 0.06);
  col = mix(col, uTop, 0.5 * near * uLift);
  // Total internal reflection band around Snell's window: the surface outside
  // the window mirrors the dark depths.
  vec2 sq;
  float sd = sunDist(uv, sq);
  float tir = smoothstep(uSunR * 1.05, uSunR * 1.6, sd) * smoothstep(0.32, 0.02, uv.y);
  col *= 1.0 - 0.42 * tir * min(1.0, uSurface * 2.0);
  // Slow volumetric mottling (whole-cycle drift), with a hint of green.
  float mot = sin(p.x * 3.1 + p.y * 2.3 + uTheta) * sin(p.x * 1.7 - p.y * 3.7 - uTheta + 1.3)
            + 0.5 * sin(p.x * 6.3 - p.y * 4.1 + 2.0 * uTheta + 0.5);
  col *= 1.0 + 0.085 * mot;
  col.g += 0.012 * mot * (col.g + 0.05);
  // Light scattered by a bubble column (Look 2): a soft teal haze around it.
  float cdx = (uv.x - uColumn.x) * asp;
  col += uTop * uColumn.y * exp(-cdx * cdx / 0.012) * smoothstep(0.0, 0.35, y) * (0.6 + 0.4 * smoothstep(1.0, 0.5, y));
  // Darker corners.
  vec2 vc = (uv - vec2(0.5, 0.45)) * vec2(1.0, 1.0);
  col *= 1.0 - 0.25 * smoothstep(0.45, 0.75, length(vc));

  // Underside of the surface: faint moving wave lines near the top.
  float sy = 1.0 / (uv.y + 0.07);
  vec2 surf = vec2((p.x - sp.x) * sy * 0.55, sy * 0.95);
  float lines = caustic(surf * 2.2 + 30.0, uTheta);
  float topMask = smoothstep(0.30, 0.0, uv.y);
  near = exp(-dot(dl, dl) / 0.5);
  col += uTop * lines * topMask * uSurface * (0.25 + 0.9 * near);

  // Blue-noise dither on the gradient itself (offset walks with frame%600).
  vec2 bnc = mod(gl_FragCoord.xy + uBNOffset, 64.0) / 64.0;
  float bn = texture(uBN, bnc).r;
  col += (bn - 0.5) * (3.0 / 255.0);

  fragColor = vec4(col, 1.0);
}
`;

/** Pass 2 — additive god rays. */
export const RAYS_FRAG = /* glsl */ `#version 300 es
${COMMON}
in vec2 vUV;
out vec4 fragColor;
void main() {
  float r = rayField(vUV) * uRayGain;
  fragColor = vec4(uRayCol * r * 0.55, 0.0);
}
`;

/** Pass 3 — Snell's window: the rippling, broken-up sun patch and its glow (additive, on top). */
export const SNELL_FRAG = /* glsl */ `#version 300 es
${COMMON}
in vec2 vUV;
out vec4 fragColor;
void main() {
  vec2 q;
  float d = sunDist(vUV, q);
  float R = uSunR;
  float t = uTheta;
  // Refracted disc broken into bright cells by the ripples.
  float cells = caustic(q * 7.5 + 4.0, t * 2.0);
  float cells2 = caustic(q * 15.0 + 9.0, t);
  // Snell's window: a crisp-edged ellipse of distorted sky, with a thin bright
  // refraction rim at its edge.
  float disc = smoothstep(R, R * uSunEdge, d);
  float breakup = 0.12 + 1.1 * pow(cells, 1.3) + 0.6 * cells2;
  float rimLine = exp(-pow((d - R * 0.975) / (R * 0.035), 2.0)) * (0.5 + 0.8 * cells);
  float core = disc * mix(1.0, breakup, uSunBreak) + rimLine * 0.6 * uSunBreak;
  // Outer shimmering fringe (patches of light around the window).
  float fringe = smoothstep(R * 2.2, R * 0.8, d) * cells * 0.6;
  // Soft glow halo.
  float halo = exp(-d * d / (R * R * 3.5)) * 0.3 + exp(-d * d / (R * R * 18.0)) * 0.14;
  float flare = 1.0 + 1.6 * uFlare;
  float v = (core * 0.55 * uSunCore + fringe * 0.9 * uSunCore + halo * 0.4) * flare;
  vec3 c = mix(uTop, uSunCol, clamp(core * 0.8 + 0.2, 0.0, 1.0)) * v;
  fragColor = vec4(c, 0.0);
}
`;

/** Final pass: half-float scene → soft clip → grain + ±1/255 dither → 8-bit. */
export const FINAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform float uLoopFrame;
uniform float uGrain;
uniform float uFlipY;
uniform float uCA;
in vec2 vUV;
out vec4 fragColor;
${GLSL_FINAL}
void main() {
  vec2 uv = vec2(vUV.x, uFlipY > 0.5 ? 1.0 - vUV.y : vUV.y);
  // Mild lateral chromatic aberration toward the frame edges (dome-port lens).
  vec2 px = 1.0 / vec2(textureSize(uScene, 0));
  vec2 ca = (uv - 0.5) * uCA * px * vec2(textureSize(uScene, 0)).y / 720.0;
  vec3 c = vec3(texture(uScene, uv + ca).r, texture(uScene, uv).g, texture(uScene, uv - ca).b);
  c = softClip(c);
  c = grainAndDither(c, gl_FragCoord.xy, uLoopFrame, uGrain);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
