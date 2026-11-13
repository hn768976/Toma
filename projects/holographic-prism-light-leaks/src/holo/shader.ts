// WebGL 2 fragment shader that synthesises a holographic / prismatic light-leak
// field: large overlapping colour washes, soft out-of-focus prism bars and
// bokeh blobs - each carrying a spectral gradient and chromatic fringes - hot
// white flares, soft shadow bands and light film grain over a mauve base.
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
const float LIGHT_GAIN = 1.5;

// Element tiling: every element lives in a periodic tile and is evaluated at its
// nearest periodic image. Each element's contribution is exactly zero beyond a
// reach that is <= half the tile period, so the infinite plane (needed by the
// tracking camera of Version 2) is seamless by construction.
const vec2 P_WASH = vec2(2.6, 1.8);   // wash reach <= 0.9
const vec2 P_STREAK = vec2(2.4, 1.6); // streak reach <= 0.75
const vec2 P_SMALL = vec2(2.4, 1.6);  // orbs / flares, reach <= 0.7

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

// Normalised spectral colour (full brightness at every hue)
vec3 spec(float x) {
  vec3 c = spectrum(x);
  c /= max(max(c.r, c.g), max(c.b, 0.35));
  return mix(c, vec3(0.95, 0.82, 0.9), 0.08);   // slightly milky, like light through frosted foil
}
// Palette: centre position on the spectrum for a hash value (-1 = white)
float hueOf(float k) {
  if (k < 0.26) return 0.10;   // red-orange
  if (k < 0.44) return 0.19;   // orange
  if (k < 0.54) return 0.29;   // yellow
  if (k < 0.60) return -1.0;   // pinkish white
  if (k < 0.65) return 0.45;   // green (narrower share)
  if (k < 0.80) return 0.70;   // blue
  if (k < 0.87) return 0.84;   // violet
  return 0.5;                  // full rainbow
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
// Each carries a spectral gradient; some carry a blown-out white core.
void washes(inout Field F, vec2 uv, float t, float fp) {
  for (int i = 0; i < 16; i++) {
    Slot s = slot(float(i), float(i), 16.0, t, 2.6, 1.9);
    vec2 q = wrapq(uv - placeAt(s, P_WASH, 0.15, mod(float(i) * 7.0, 16.0), vec2(4.0, 4.0)), P_WASH);
    float rx = 0.24 + 0.14 * s.h2.x;
    float d = length(q);
    float E = 2.0 * rx;                      // <= 0.9 = P_WASH.y / 2
    if (d >= E) continue;
    float ry = rx * (0.35 + 0.45 * s.h2.y);
    vec2 r = rot2(q, s.h2.z * TAU + (s.h2.w - 0.5) * 0.4 * (s.ph - 0.5) * s.T);
    vec2 e = r / vec2(rx, ry);
    float I = exp(-dot(e, e) * 1.05) * win(d, E) * plateau(s.ph) * (0.30 + 0.26 * s.h3.y);
    I *= 0.7 + 0.45 * vnoise(vec2(e.x * 0.6, e.y * 2.2) + s.h3.zw * 40.0); // smeared, uneven
    float k = s.h3.x;
    float h0;
    if (k < 0.07) h0 = 0.84;          // violet
    else if (k < 0.18) h0 = 0.70;     // blue
    else if (k < 0.40) h0 = 0.10;     // red-orange
    else if (k < 0.53) h0 = 0.19;     // orange
    else if (k < 0.61) h0 = 0.29;     // yellow
    else if (k < 0.71) h0 = 0.45;     // green
    else if (k < 0.73) h0 = 0.56;     // teal
    else if (k < 0.81) { F.dark += I * 2.0; continue; } // shadow
    else h0 = -1.0;                   // full rainbow sheet
    // dispersion: the hue runs across the wash like light through a prism
    float u = clamp((s.h1.w < 0.5 ? e.x : e.y) * 0.45, -0.6, 0.6);
    vec3 c = h0 < 0.0 ? spec(0.5 + 0.8 * u) : spec(h0 + (0.25 + 0.3 * s.h1.z) * u);
    F.light += c * I;
    if (s.h3.w > 0.78) F.white += exp(-dot(e, e) * 6.0) * I * 1.2; // blown-out core
  }
}

// Soft out-of-focus prism bars: fat rounded bands of light whose hue runs
// across or along the band (dispersion). Each colour channel's copy is also
// displaced along the band normal, giving rainbow fringes on the soft edges.
void bars(inout Field F, vec2 uv, float t, float fp) {
  for (int i = 0; i < 10; i++) {
    Slot s = slot(float(i) + 10.0, float(i), 10.0, t, 1.8, 1.8);
    vec2 c = placeAt(s, P_STREAK, 0.22, mod(float(i) * 3.0, 10.0), vec2(5.0, 2.0));
    vec2 q = wrapq(uv - c, P_STREAK);
    float dq = length(q);
    if (dq >= 0.75) continue;                       // reach 0.75 <= P_STREAK.y / 2
    float a = s.h2.y * TAU + (s.h3.y - 0.5) * 0.8 * (s.ph - 0.5) * s.T;
    vec2 r = rot2(q, a);
    float Lh = 0.08 + 0.18 * s.h2.z;                // half length <= 0.26
    float w = 0.05 + 0.10 * s.h2.w;                 // half width  <= 0.15
    float curv = (s.h3.z - 0.5) * 0.7;
    float xs = r.y + curv * r.x * r.x;
    float soft = 0.42 * w + 0.014;                  // defocused edge
    float disp = 0.22 * w + 0.008;                  // chromatic displacement
    float ax = 0.4 * max(abs(r.x) - Lh, 0.0);      // ends smeared 2.5x longer (tapered)
    vec3 m;
    for (int ch = 0; ch < 3; ch++) {
      float y = xs + disp * (float(ch) - 1.0);
      float d = length(vec2(ax, y)) - w;
      m[ch] = 1.0 - smoothstep(-soft, soft, d);
    }
    float life = bell(s.ph) * win(dq, 0.75) * (0.42 + 0.32 * s.h1.y);
    life *= 0.75 + 0.5 * vnoise(vec2(r.x * 2.2, xs * 4.0) + s.h2.xy * 50.0); // uneven brightness
    float h0 = hueOf(s.h3.x);
    float span = s.h3.x >= 0.87 ? 0.9 : 0.35 + 0.3 * s.h2.x;
    float u = s.h1.z < 0.5 ? clamp(xs / w, -1.0, 1.0) * 0.5 : clamp(r.x / (Lh + w), -1.0, 1.0) * 0.5;
    vec3 body = h0 < 0.0 ? vec3(1.0, 0.8, 0.86) : spec(h0 + span * u);
    F.light += mix(body, vec3(1.0), 0.06) * m * life;
    if (s.h1.x > 0.85) F.white += m.g * exp(-xs * xs / (0.15 * w * w)) * life * 0.5; // hot centre line
  }
}

// Round out-of-focus blobs (bokeh) with a slight chromatic offset.
void orbs(inout Field F, vec2 uv, float t, float fp) {
  for (int i = 0; i < 6; i++) {
    Slot s = slot(float(i) + 20.0, float(i), 6.0, t, 1.6, 1.8);
    vec2 q = wrapq(uv - placeAt(s, P_SMALL, 0.15, mod(float(i) * 5.0, 6.0), vec2(3.0, 2.0)), P_SMALL);
    float dq = length(q);
    if (dq >= 0.6) continue;
    float R = 0.06 + 0.12 * s.h2.x;                 // <= 0.18
    float asp = 1.0 + 0.8 * s.h2.y;
    float ang = s.h2.z * TAU;
    vec2 o = vec2(cos(ang + 1.3), sin(ang + 1.3)) * R * 0.18;
    float soft = 0.35 * R;
    vec3 m;
    for (int ch = 0; ch < 3; ch++) {
      vec2 qq = rot2(q + o * (float(ch) - 1.0), ang) * vec2(1.0, asp);
      m[ch] = 1.0 - smoothstep(R - soft, R + soft, length(qq));
    }
    float life = bell(s.ph) * win(dq, 0.6) * (0.32 + 0.3 * s.h1.y);
    float h0 = hueOf(s.h3.x);
    float u = clamp(dot(q, vec2(cos(ang), sin(ang))) / R, -1.0, 1.0) * 0.5;
    vec3 body = h0 < 0.0 ? vec3(1.0, 0.9, 0.85) : spec(h0 + (0.5 + 0.4 * s.h2.w) * u);
    F.light += mix(body, vec3(1.0), 0.08) * m * life;
    if (s.h3.w > 0.85) F.white += m.g * life * 0.4;
  }
}

// Hot blooming white flares.
void flares(inout Field F, vec2 uv, float t, float fp) {
  for (int i = 0; i < 4; i++) {
    Slot s = slot(float(i) + 30.0, float(i), 4.0, t, 1.6, 1.6);
    vec2 q = wrapq(uv - placeAt(s, P_SMALL, 0.12, mod(float(i) * 3.0, 4.0), vec2(2.0, 2.0)), P_SMALL);
    float d = length(q);
    if (d >= 0.7) continue;
    float rad = 0.04 + 0.065 * s.h2.x;
    vec2 e = rot2(q, s.h2.z * TAU) / vec2(rad * (1.0 + 1.6 * s.h2.y), rad);
    float dd = dot(e, e);
    float life = bell(s.ph) * win(d, 0.7) * (0.8 + 0.5 * s.h3.y);
    F.white += (exp(-dd * 1.1) * 2.1 + exp(-dd * 0.3) * 0.3) * life; // blooming hot core
    F.light += vec3(1.0, 0.66, 0.62) * exp(-dd * 0.12) * life * 0.35; // bloom
  }
}

Field evalField(vec2 uv, float t, float fp) {
  Field F;
  F.light = vec3(0.0);
  F.dark = 0.0;
  F.white = 0.0;
  // gentle domain warp: refractions are never perfectly straight
  vec2 w = vec2(vnoise(uv * 2.1 + vec2(t * 0.6, 3.7)), vnoise(uv * 2.1 + vec2(8.3, -t * 0.54))) - 0.5;
  uv += w * 0.035;
  washes(F, uv, t, fp);
  bars(F, uv, t, fp);
  orbs(F, uv, t, fp);
  flares(F, uv, t, fp);
  return F;
}

vec3 shade(vec2 uv, float t, float fp) {
  Field F = evalField(uv, t, fp);
  float n = fbm(uv * 0.9 + vec2(t * 0.05, -t * 0.03));
  // darker maroon-mauve base
  vec3 base = mix(vec3(0.06, 0.045, 0.06), vec3(0.24, 0.19, 0.23), smoothstep(0.3, 0.72, n));
  base *= 1.0 - 0.62 * clamp(F.dark, 0.0, 1.0);
  vec3 light = 1.0 - exp(-F.light * LIGHT_GAIN);   // soft-clip the additive light
  // hue-preserving combine: strong light mostly replaces the base
  float lw = max(light.r, max(light.g, light.b));
  vec3 col = base * (1.0 - 0.75 * lw) + light;
  col = 1.0 - exp(-col * 1.75);                     // filmic shoulder
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = max(mix(vec3(luma), col, 1.22), 0.0);        // restore saturation lost in the shoulder
  // soft highlight roll-off for the specular glows (no flat clipped centres)
  col = mix(col, vec3(1.0, 0.98, 0.97), (1.0 - exp(-F.white * 1.6)) * 0.97);
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
  col *= mix(0.8, 1.0, v);

  // triangular dither to avoid banding in the soft gradients
  float dth = hash12(gl_FragCoord.xy + fract(t) * 91.7) + hash12(gl_FragCoord.yx * 1.37 + 4.1) - 1.0;
  col += dth * 1.5 / 255.0;
  // light film grain, refreshed every frame
  float gl = dot(col, vec3(0.299, 0.587, 0.114));
  float gr = hash12(gl_FragCoord.xy * 0.731 + fract(t * 7.13) * 517.0) + hash12(gl_FragCoord.yx * 1.13 + fract(t * 3.71) * 211.0) - 1.0;
  col += gr * 0.016 * (0.6 + 0.8 * gl);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
