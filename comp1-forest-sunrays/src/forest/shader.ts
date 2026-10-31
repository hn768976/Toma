// Fragment shader for "Forest Sunrays": defocused foliage, sun haze, bokeh
// discs and two crepuscular lens streaks, all procedurally generated.
//
// Coordinate system used throughout (CPU + GPU):
//   p.x in [0, aspect]   (aspect = 16/9 = 1.7778), left -> right
//   p.y in [0, 1]        top -> bottom
// i.e. everything is measured in units of the frame height.

export const MAX_DISCS = 150;

export const FOREST_FRAG = /* glsl */ `#version 300 es
precision highp float;

#define MAX_DISCS ${MAX_DISCS}

uniform vec2  uRes;
uniform float uTime;
uniform float uFrame;
uniform float uExposure;             // measured light curve (see lightCurve.ts)
uniform int   uDiscCount;
uniform vec4  uDisc[MAX_DISCS];     // x, y, radius, alpha
uniform vec4  uDiscCol[MAX_DISCS];  // linear rgb, edge softness (fraction of r)

uniform vec2  uSun;                 // sun position (height units)
uniform float uSunPow;              // overall light intensity (breathing)
uniform vec4  uRayA;                // through-point x, y, angle (rad), intensity
uniform vec4  uRayB;
uniform vec4  uRayC;
uniform vec2  uRayW;                // width of ray A / ray B (C uses B)

// Palette (linear RGB)
uniform vec3 uBgTop;
uniform vec3 uBgLow;
uniform vec3 uBgSide;
uniform vec3 uHaze;
uniform vec3 uFoliage;
uniform vec3 uFoliage2;
uniform vec3 uRayCol;
uniform vec3 uSunCol;
uniform vec3 uLift;                 // shadow tint / lift
uniform float uSat;                 // final saturation multiplier

out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1, 0));
  float c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.13;
    a *= 0.5;
  }
  return s;
}

float blob(vec2 p, vec2 c, vec2 r) {
  vec2 q = (p - c) / r;
  return exp(-dot(q, q));
}

// Soft lens streak through point o, at angle a (0 = straight down).
// s is the signed perpendicular distance, t the distance along the streak.
float streak(vec2 p, vec4 R, float w, float chromaShift) {
  vec2 d = vec2(sin(R.z), cos(R.z));
  vec2 q = p - R.xy;
  float t = dot(q, d);
  float s = q.x * d.y - q.y * d.x + chromaShift;
  float ww = w * (1.0 + 0.55 * clamp(t + 0.1, 0.0, 1.4));
  float core = exp(-(s * s) / (ww * ww));
  float glow = exp(-abs(s) / (ww * 5.0)) * 0.22;
  // fade in from the haze at the top, decay towards the bottom of frame
  float along = smoothstep(-0.25, 0.05, t) * exp(-max(t, 0.0) * 0.55);
  return (core + glow) * along * R.w;
}

vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes.y;
  float t = uTime;

  // ---------- defocused background ----------
  float vy = smoothstep(-0.05, 1.05, p.y);
  vec3 col = mix(uBgTop, uBgLow, vy);
  col = mix(col, uBgSide, smoothstep(aspect * 0.62, aspect * 1.02, p.x) * 0.75);
  col = mix(col, uBgSide * 0.85, smoothstep(0.55, 1.0, p.y) * smoothstep(aspect * 0.8, aspect, p.x) * 0.6);

  // slow moving out-of-focus leaf masses
  vec2 drift = vec2(t * 0.012, -t * 0.006);
  float n1 = fbm(p * 1.7 + drift + 3.1);
  float n2 = fbm(p * 2.6 - drift * 1.3 + 11.7);
  float edgeW = 0.35 + 0.65 * smoothstep(0.25, 0.75, abs(p.x / aspect - 0.5) * 2.0 + p.y * 0.3);
  col = mix(col, uFoliage, smoothstep(0.48, 0.72, n1) * 0.42 * edgeW);
  col = mix(col, col * 0.52, smoothstep(0.42, 0.7, n2) * 0.7);
  float n3 = fbm(p * 3.4 + vec2(-t * 0.02, t * 0.01) + 23.0);
  col = mix(col, col * vec3(0.7, 0.85, 1.05), smoothstep(0.5, 0.7, n3) * 0.5);

  // fixed foliage masses that read in the reference
  col = mix(col, uFoliage, blob(p, vec2(aspect * 0.90, 0.30), vec2(0.17, 0.19)) * 0.85);
  col += uFoliage * 0.18 * blob(p, vec2(aspect * 0.91, 0.28), vec2(0.1, 0.11));
  col = mix(col, uFoliage, blob(p, vec2(aspect * 0.78, 0.55), vec2(0.12, 0.12)) * 0.35);
  col = mix(col, uFoliage2, blob(p, vec2(0.05, 0.92), vec2(0.22, 0.12)) * 0.65);
  col = mix(col, uFoliage2, blob(p, vec2(aspect * 0.55, 0.98), vec2(0.30, 0.10)) * 0.35);
  col = mix(col, uFoliage, blob(p, vec2(aspect * 0.10, 0.62), vec2(0.18, 0.18)) * 0.35);

  // shadow lift / tint
  col += uLift;

  // ---------- sun haze ----------
  vec2 sq = (p - uSun) * vec2(0.85, 1.0);
  float r2 = dot(sq, sq);
  float haze = exp(-r2 / 0.15) * 0.85 + exp(-r2 / 0.04) * 0.8 + exp(-r2 / 0.6) * 0.16;
  col += uHaze * haze * uSunPow;

  // ---------- bokeh discs ----------
  vec3 bokeh = vec3(0.0);
  for (int i = 0; i < MAX_DISCS; i++) {
    if (i >= uDiscCount) break;
    vec4 D = uDisc[i];
    vec2 dp = p - D.xy;
    float r = D.z;
    if (abs(dp.x) > r * 1.3 || abs(dp.y) > r * 1.3) continue;
    float d = length(dp);
    vec4 C = uDiscCol[i];
    float e = r * C.w;
    float m = 1.0 - smoothstep(r - e, r + e * 0.35, d);
    float rim = smoothstep(r - e * 2.2, r - e * 0.4, d);
    // faint onion-ring texture of real bokeh
    float tex = 0.94 + 0.06 * sin(d / r * 9.0 + float(i));
    bokeh += C.rgb * D.w * m * (0.9 + 0.16 * rim) * tex;
  }
  col += bokeh * uSunPow;

  // ---------- sun core ----------
  float core = exp(-r2 / 0.008) * 0.35 + exp(-r2 / 0.0015) * 0.25;
  col += uSunCol * core * uSunPow;

  // ---------- lens streaks (subtle chromatic fringing) ----------
  float cs = 0.0022;
  vec3 rays;
  rays.r = streak(p, uRayA, uRayW.x, cs) + streak(p, uRayB, uRayW.y, cs) + streak(p, uRayC, uRayW.y * 1.4, cs);
  rays.g = streak(p, uRayA, uRayW.x, 0.0) + streak(p, uRayB, uRayW.y, 0.0) + streak(p, uRayC, uRayW.y * 1.4, 0.0);
  rays.b = streak(p, uRayA, uRayW.x, -cs) + streak(p, uRayB, uRayW.y, -cs) + streak(p, uRayC, uRayW.y * 1.4, -cs);
  col += uRayCol * rays * uSunPow;

  // ---------- veiling glare + vignette ----------
  col += uHaze * 0.03;
  vec2 vq = (p - vec2(aspect * 0.5, 0.45)) / vec2(aspect * 0.75, 0.8);
  col *= 1.0 - 0.28 * smoothstep(0.35, 1.25, dot(vq, vq));

  // ---------- soft shoulder (keeps highlights from hard clipping) ----------
  vec3 hi = max(col - 0.78, 0.0);
  col = min(col, 0.78) + hi / (1.0 + hi * 1.6);

  // saturation
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);

  vec3 srgb = toSRGB(col) * uExposure;
  // temporal film grain / dither (prevents banding in H.264 gradients)
  float g = hash12(gl_FragCoord.xy + fract(uFrame * 0.6180339) * 917.0) - 0.5;
  srgb += g * (2.2 / 255.0);
  outColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;
