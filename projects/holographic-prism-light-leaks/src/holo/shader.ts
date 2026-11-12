// WebGL 2 fragment shader that synthesises a holographic / prismatic light-leak
// field: a few large overlapping colour washes, spectral streaks with one crisp
// caustic edge that converge on a wandering light source, caustic crescents,
// hot white flares and soft shadow bands over a mauve base.
//
// uMode 0 = flat, screen-aligned camera (Version 1 - matches the reference)
// uMode 1 = low-angle perspective tracking shot across the foil (Version 2)

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform int   uMode;
uniform vec4  uCamA;   // flat: pan.x, pan.y, rotation, zoom | persp: cam.x, cam.y, height, yaw
uniform vec4  uCamB;   // persp: pitch, roll, focal, fogDensity

out vec4 outColor;

const float TAU = 6.28318530718;
const float LIGHT_GAIN = 2.0;

// Element tiling: every element lives in a periodic tile and is evaluated at its
// nearest periodic image. Each element's contribution is exactly zero beyond a
// reach that is <= half the tile period, so the infinite plane (needed by the
// tracking camera of Version 2) is seamless by construction.
const vec2 P_WASH = vec2(2.6, 1.8);   // wash reach <= 0.9
const vec2 P_STREAK = vec2(2.4, 1.6); // streak reach <= 0.75
const vec2 P_SMALL = vec2(2.4, 1.6);  // crescents / flares, reach <= 0.75

// ---- hashes (sin-free, stable on every GPU / SwiftShader) ----
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

// Smooth visible-light spectrum: 0 = red ... 1 = violet
vec3 spectrum(float x) {
  x = clamp(x, 0.0, 1.0);
  vec4 z = (vec4(x) - vec4(0.12, 0.96, 0.45, 0.72)) / vec4(0.20, 0.13, 0.22, 0.20);
  vec4 e = exp(-z * z);
  return vec3(e.x + 0.3 * e.y, 0.68 * e.z, e.w + 0.28 * e.y) * 1.15;
}

// C1-smooth window that is exactly 0 at distance >= E
float win(float d, float E) { return 1.0 - smoothstep(0.55 * E, E, d); }

struct Field { vec3 light; float dark; float white; };

vec2 wrapq(vec2 q, vec2 P) { return q - P * floor(q / P + 0.5); }
vec2 rot2(vec2 q, float a) { float c = cos(a); float s = sin(a); return vec2(c * q.x + s * q.y, -s * q.x + c * q.y); }

// One recycling element slot: it lives for T seconds, then respawns elsewhere
// with new random parameters. Slots of a role are phase-staggered so the
// number of visible elements stays steady.
struct Slot { float ph; float T; vec4 h1; vec4 h2; vec4 h3; };
Slot slot(float id, float idx, float n, float t, float Tmin, float Tspan) {
  vec4 h0 = hash42(vec2(id * 1.731 + 0.37, 7.7));
  Slot s;
  s.T = Tmin + Tspan * h0.x;
  float lt = t / s.T + (idx + 0.35 * h0.y) / n;
  float g = floor(lt);
  s.ph = lt - g;
  vec2 k = vec2(id * 1.731 + 0.37, g * 1.117 + 0.53);
  s.h1 = hash42(k + vec2(3.1, 11.7));
  s.h2 = hash42(k * 1.37 + vec2(17.3, 5.9));
  s.h3 = hash42(k * 0.73 + vec2(41.1, 23.3));
  return s;
}
float bell(float ph) { float s = sin(3.14159265 * ph); return s * s; }
float plateau(float ph) { return smoothstep(0.0, 0.35, ph) * (1.0 - smoothstep(0.65, 1.0, ph)); }
// Stratified placement: slot j always respawns inside its own cell of a
// gx x gy grid over the tile, so coverage stays even in space and time.
vec2 placeAt(Slot s, vec2 P, float vmax, float j, vec2 g) {
  vec2 cell = vec2(mod(j, g.x), floor(j / g.x));
  vec2 p = (cell + 0.1 + 0.8 * s.h1.xy) / g - 0.5;
  return p * P + (s.h1.zw - 0.5) * 2.0 * vmax * (s.ph - 0.5) * s.T;
}

// Large, smeared, overlapping colour washes (1-4 dominate the frame at once).
// Some are cut by a crisp prism edge with an RGB fringe, some carry a blown-out
// white core.
void washes(inout Field F, vec2 uv, float t, float fp) {
  for (int i = 0; i < 16; i++) {
    Slot s = slot(float(i), float(i), 16.0, t, 3.5, 2.5);
    vec2 q = wrapq(uv - placeAt(s, P_WASH, 0.10, mod(float(i) * 7.0, 16.0), vec2(4.0, 4.0)), P_WASH);
    float rx = 0.30 + 0.15 * s.h2.x;
    float d = length(q);
    float E = 2.0 * rx;                      // <= 0.9 = P_WASH.y / 2
    if (d >= E) continue;
    float ry = rx * (0.35 + 0.45 * s.h2.y);
    vec2 r = rot2(q, s.h2.z * TAU + (s.h2.w - 0.5) * 0.25 * (s.ph - 0.5) * s.T);
    vec2 e = r / vec2(rx, ry);
    float I = exp(-dot(e, e) * 1.05) * win(d, E) * plateau(s.ph) * (0.38 + 0.32 * s.h3.y);
    I *= 0.55 + 0.75 * vnoise(vec2(e.x * 0.8, e.y * 5.0) + s.h3.zw * 40.0); // smeared striations
    vec3 cut = vec3(1.0);
    if (s.h1.w < 0.4) {
      // crisp prism edge across the wash, brightest right at the edge
      float cp = (s.h2.w - 0.5) * 0.8 * ry;
      float sg = s.h3.z < 0.5 ? 1.0 : -1.0;
      float y = (r.y - cp + 0.5 * (s.h1.z - 0.5) * r.x * r.x / rx) * sg; // gently curved edge
      float bs = 0.005 + 1.2 * fp;
      float fr = 0.006 + 0.006 * s.h3.w;
      cut = 0.3 + 0.7 * vec3(smoothstep(-bs, bs, y + fr), smoothstep(-bs, bs, y), smoothstep(-bs, bs, y - fr));
      I *= 1.0 + 0.7 * exp(-y * y / (0.0016 + 0.03 * ry * ry));
    }
    float k = s.h3.x;
    vec3 c;
    if (k < 0.10) c = vec3(0.24, 0.08, 1.0);         // violet
    else if (k < 0.18) c = vec3(0.05, 0.30, 1.0);    // blue
    else if (k < 0.41) c = vec3(1.0, 0.16, 0.08);    // red-orange
    else if (k < 0.55) c = vec3(1.0, 0.42, 0.06);    // orange
    else if (k < 0.63) c = vec3(1.0, 0.80, 0.12);    // yellow
    else if (k < 0.69) c = vec3(0.20, 0.90, 0.25);   // green
    else if (k < 0.73) c = vec3(0.10, 0.80, 0.70);   // teal
    else if (k < 0.81) { F.dark += I * 2.0; continue; } // shadow
    else c = spectrum(0.5 + 0.42 * clamp(r.x / rx, -1.2, 1.2)); // rainbow sheet
    F.light += c * cut * I;
    if (s.h3.w > 0.78) F.white += exp(-dot(e, e) * 6.0) * I * cut.g * 1.2; // blown-out core
  }
}

// Spectral streaks: dispersed light bands with one crisp caustic edge and one
// soft edge. Most point at a slowly wandering light source -> converging rays.
void streaks(inout Field F, vec2 uv, float t, float fp) {
  vec2 S = vec2(-0.78 + 0.35 * sin(t * 0.21), 0.36 + 0.22 * sin(t * 0.27 + 1.0));
  for (int i = 0; i < 12; i++) {
    Slot s = slot(float(i) + 10.0, float(i), 12.0, t, 2.2, 2.3);
    vec2 c = placeAt(s, P_STREAK, 0.12, mod(float(i) * 5.0, 12.0), vec2(4.0, 3.0));
    vec2 q = wrapq(uv - c, P_STREAK);
    if (dot(q, q) >= 0.5625) continue;       // reach 0.75 <= P_STREAK.y / 2
    float a;
    if (s.h2.x < 0.7) {
      vec2 toS = c - S; // continuous in time (a wrapped vector can jump)
      a = atan(toS.y, toS.x) + (s.h2.y - 0.5) * 0.5;
    } else {
      a = s.h2.y * TAU + (s.h3.y - 0.5) * 0.5 * (s.ph - 0.5) * s.T;
    }
    vec2 r = rot2(q, a);
    float Lh = 0.28 + 0.34 * s.h2.z;               // <= 0.62
    float w = 0.022 + 0.13 * s.h2.w * s.h2.w;      // <= 0.152
    float curv = (s.h3.z - 0.5) * 0.5;             // bend <= 0.1
    float side = s.h3.w < 0.5 ? 1.0 : -1.0;
    float xs = (r.y + curv * r.x * r.x) * side;    // sharp edge at xs = -w/2
    float bs = 0.0045 + 0.008 * s.h1.w + 1.2 * fp; // crisp caustic edge
    float bsoft = 0.25 * w + 0.03 * s.h3.y;        // defocused edge
    float m = smoothstep(-0.5 * w - bs, -0.5 * w + bs, xs)
            * (1.0 - smoothstep(0.5 * w - bsoft, 0.5 * w + bsoft, xs));
    float along = win(abs(r.x), Lh);
    along *= mix(1.0, smoothstep(-Lh, 0.4 * Lh, r.x), 0.65); // brighter toward the source
    float I = m * along * bell(s.ph) * (0.75 + 0.45 * s.h1.y);
    I *= 0.6 + 0.6 * vnoise(vec2(r.x * 3.0, xs * 30.0) + s.h2.xy * 50.0); // striations
    float hx = clamp((xs + 0.5 * w) / (w + bsoft), 0.0, 1.0);
    float k = s.h3.x;
    vec3 c3;
    if (k < 0.62) c3 = mix(spectrum(s.h1.z < 0.5 ? hx : 1.0 - hx), vec3(0.9, 0.8, 0.9), 0.12);
    else if (k < 0.70) c3 = vec3(1.0, 0.82, 0.88);
    else if (k < 0.88) c3 = vec3(1.0, 0.30 + 0.25 * hx, 0.08);
    else c3 = vec3(0.15, 0.25, 1.0);
    F.light += c3 * I;
    if (s.h1.z < 0.55) {
      // thin bright caustic line on the sharp edge
      float e = (xs + 0.5 * w) / (0.007 + 1.5 * fp);
      float rim = exp(-e * e) * along * bell(s.ph) * (0.007 / (0.007 + 1.5 * fp));
      F.light += vec3(1.0, 0.85, 0.92) * rim * 0.35;
      F.white += rim * 0.15;
    }
  }
}

// Caustic crescents with a crisp bright outer rim, and hot white flares.
void accents(inout Field F, vec2 uv, float t, float fp) {
  for (int i = 0; i < 1; i++) {
    Slot s = slot(float(i) + 20.0, float(i), 1.0, t, 3.0, 2.5);
    vec2 q = wrapq(uv - placeAt(s, P_SMALL, 0.08, 0.0, vec2(1.0)), P_SMALL);
    float R = 0.07 + 0.14 * s.h2.x;
    if (length(q) > 2.0 * R + 0.05) continue;
    float a = s.h2.z * TAU + (s.h2.w - 0.5) * 0.4 * (s.ph - 0.5) * s.T;
    vec2 off = vec2(cos(a), sin(a)) * R * (0.25 + 0.3 * s.h2.y);
    float bs = 0.005 + 1.2 * fp;
    vec2 qs = rot2(q, a) * vec2(1.0, 1.0 / (0.55 + 0.4 * s.h3.w)); // elliptical arcs
    vec2 os = rot2(off, a) * vec2(1.0, 1.0 / (0.55 + 0.4 * s.h3.w));
    float d1 = length(qs) - R;
    float d2 = length(qs - os) - R;
    float m = (1.0 - smoothstep(-bs, bs, d1)) * smoothstep(-0.35 * R, 0.1 * R, d2);
    float e = d1 / (0.006 + 1.5 * fp);
    float rim = exp(-e * e) * smoothstep(-0.1 * R, 0.35 * R, d2);
    float life = bell(s.ph) * (0.7 + 0.4 * s.h3.y);
    bool wh = s.h3.x < 0.7;
    vec3 c = wh ? vec3(1.0, 0.86, 0.9) : spectrum(clamp(0.5 + 0.6 * qs.y / R, 0.0, 1.0));
    F.light += c * (m * 0.5 + rim * 0.25) * life;
    F.white += rim * life * (wh ? 0.3 : 0.06);
  }
  for (int i = 0; i < 6; i++) {
    Slot s = slot(float(i) + 30.0, float(i), 6.0, t, 2.0, 2.0);
    vec2 q = wrapq(uv - placeAt(s, P_SMALL, 0.08, mod(float(i) * 5.0, 6.0), vec2(3.0, 2.0)), P_SMALL);
    float d = length(q);
    if (d >= 0.7) continue;
    float rad = 0.035 + 0.06 * s.h2.x;
    vec2 e = rot2(q, s.h2.z * TAU) / vec2(rad * (1.0 + 1.6 * s.h2.y), rad);
    float dd = dot(e, e);
    float life = bell(s.ph) * win(d, 0.7) * (0.8 + 0.5 * s.h3.y);
    F.white += (exp(-dd * 1.1) * 1.6 + exp(-dd * 0.3) * 0.25) * life; // blooming hot core
    F.light += vec3(1.0, 0.66, 0.62) * exp(-dd * 0.12) * life * 0.35; // bloom
  }
}

Field evalField(vec2 uv, float t, float fp) {
  Field F;
  F.light = vec3(0.0);
  F.dark = 0.0;
  F.white = 0.0;
  // gentle domain warp: refractions are never perfectly straight
  vec2 w = vec2(vnoise(uv * 2.1 + vec2(t * 0.4, 3.7)), vnoise(uv * 2.1 + vec2(8.3, -t * 0.36))) - 0.5;
  uv += w * 0.035;
  washes(F, uv, t, fp);
  streaks(F, uv, t, fp);
  accents(F, uv, t, fp);
  return F;
}

vec3 shade(vec2 uv, float t, float fp) {
  Field F = evalField(uv, t, fp);
  float n = fbm(uv * 0.9 + vec2(t * 0.05, -t * 0.03));
  // darker maroon-mauve base
  vec3 base = mix(vec3(0.09, 0.065, 0.085), vec3(0.30, 0.24, 0.29), smoothstep(0.3, 0.72, n));
  base *= 1.0 - 0.62 * clamp(F.dark, 0.0, 1.0);
  vec3 light = 1.0 - exp(-F.light * LIGHT_GAIN);   // soft-clip the additive light
  // hue-preserving combine: strong light mostly replaces the base
  float lw = max(light.r, max(light.g, light.b));
  vec3 col = base * (1.0 - 0.75 * lw) + light;
  col = 1.0 - exp(-col * 1.75);                     // filmic shoulder
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = max(mix(vec3(luma), col, 1.3), 0.0);        // restore saturation lost in the shoulder
  // soft highlight roll-off for the specular glows (no flat clipped centres)
  col = mix(col, vec3(1.0, 0.97, 0.96), (1.0 - exp(-F.white * 1.6)) * 0.92);
  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;   // y in [-0.5, 0.5]
  float t = uTime;
  vec3 col;

  if (uMode == 0) {
    float r = uCamA.z;
    vec2 pr = vec2(cos(r) * p.x - sin(r) * p.y, sin(r) * p.x + cos(r) * p.y);
    vec2 uv = pr / uCamA.w + uCamA.xy;
    vec2 fw = fwidth(uv);
    col = shade(uv, t, max(fw.x, fw.y));
  } else {
    // Perspective camera gliding low over an infinite holographic sheet (z = 0).
    float pitch = uCamB.x;
    float roll = uCamB.y;
    float focal = uCamB.z;
    vec2 pr = vec2(cos(roll) * p.x - sin(roll) * p.y, sin(roll) * p.x + cos(roll) * p.y);
    float yaw = uCamA.w;
    vec3 fwd = vec3(sin(yaw) * cos(pitch), cos(yaw) * cos(pitch), -sin(pitch));
    vec3 right = normalize(vec3(cos(yaw), -sin(yaw), 0.0));
    vec3 up = cross(right, fwd);
    vec3 dir = normalize(fwd * focal + right * pr.x + up * pr.y);
    vec3 cam = vec3(uCamA.x, uCamA.y, uCamA.z);
    vec3 haze = vec3(0.36, 0.30, 0.35);
    // derivatives are taken before the (non-uniform) horizon branch
    float s = -cam.z / min(dir.z, -0.0005);
    vec2 uv = (cam.xy + dir.xy * s) * 0.55;
    vec2 fw = fwidth(uv);
    float fp = min(max(fw.x, fw.y), 0.15);
    if (dir.z > -0.0005) {
      col = haze;
    } else {
      col = shade(uv, t, fp);
      float fog = 1.0 - exp(-max(s - 0.6, 0.0) * uCamB.w);
      col = mix(col, haze, clamp(fog, 0.0, 0.95));
    }
  }

  // subtle lens vignette
  float v = smoothstep(1.25, 0.35, length(p * vec2(0.9, 1.25)));
  col *= mix(0.72, 1.0, v);

  // triangular dither to avoid banding in the soft gradients
  float dth = hash12(gl_FragCoord.xy + fract(t) * 91.7) + hash12(gl_FragCoord.yx * 1.37 + 4.1) - 1.0;
  col += dth * 1.5 / 255.0;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
