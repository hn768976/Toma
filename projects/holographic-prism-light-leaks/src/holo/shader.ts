// WebGL 2 fragment shader that synthesises a blurred holographic / prismatic
// light-leak field: broad violet / magenta / rainbow washes, a dense layer of
// small defocused prism shards with RGB-split edges, soft shadow bands and
// white specular glows drifting over a mauve base.
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

// Seam-safety rule for both cell layers: a shape's anchor sits at least 0.3
// cells inside its own cell and drifts by at most m, and its contribution is
// exactly zero beyond reach E, with E + m <= 1.3 * CELL. No shape outside the
// evaluated 3x3 neighbourhood can then touch the pixel, so nothing is ever cut
// off with a hard edge.
const float CELL_A = 0.9;    // large soft colour washes + white specular glows
const float REACH_A = 1.0;   // drift <= 0.06 -> 1.06 <= 1.17
const float CELL_B = 0.46;   // dense defocused prism shards ("pills")
const float REACH_B = 0.54;  // drift <= 0.05 -> 0.59 <= 0.598

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
  return vec3(e.x + 0.5 * e.y, 0.68 * e.z, e.w + 0.28 * e.y) * 1.15;
}

// C1-smooth window that is exactly 0 at distance >= E
float win(float d, float E) { return 1.0 - smoothstep(0.55 * E, E, d); }

float capsule(vec2 q, float hl, float r) {
  return length(vec2(max(abs(q.x) - hl, 0.0), q.y)) - r;
}

struct Field { vec3 light; float dark; float white; };

// Large, slow layer: broad colour washes, soft arcs, shadow bands, white glows.
void layerA(inout Field F, vec2 uv, float t) {
  vec2 baseCell = floor(uv / CELL_A);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 cell = baseCell + vec2(float(dx), float(dy));
      for (int k = 0; k < 2; k++) {
        vec2 sd = cell + vec2(float(k) * 17.13, float(k) * 3.71);
        vec4 h0 = hash42(sd);
        if (h0.w < 0.22) continue;                       // bare mauve gaps
        float T = 2.4 + 2.6 * h0.x;
        float lt = t / T + h0.y;
        float g = floor(lt);
        float ph = lt - g;
        vec4 h1 = hash42(sd + g * vec2(7.31, 13.17));
        vec4 h2 = hash42(sd + g * vec2(29.7, 3.3) + 11.0);
        float a = h2.x * TAU + (h2.y - 0.5) * 0.5 * (ph - 0.5) * T;
        vec2 c = (cell + 0.3 + 0.4 * h1.xy) * CELL_A
               + vec2(cos(a), sin(a)) * 0.06 * (2.0 * ph - 1.0);
        vec2 q0 = uv - c;
        float d = length(q0);
        if (d >= REACH_A) continue;
        vec4 h3 = hash42(sd + g * vec2(5.1, 41.9) + 23.0);
        float life = sin(3.14159265 * ph);
        life *= life * win(d, REACH_A);
        float ca = cos(a);
        float sa = sin(a);
        vec2 q = vec2(ca * q0.x + sa * q0.y, -sa * q0.x + ca * q0.y);
        float kind = h3.y;

        if (k == 1 && h0.z < 0.30) {
          // large defocused white specular glow (soft roll-off, no plateau)
          float rad = 0.07 + 0.07 * h2.w;
          vec2 e = q / vec2(rad * (1.0 + 0.9 * h2.z), rad);
          float dd = dot(e, e);
          F.white += exp(-dd * dd * 0.35) * life * (0.8 + 0.5 * h3.w);
          F.light += vec3(1.0, 0.5, 0.75) * exp(-dd * 0.25) * life * 0.10;
          continue;
        }

        float curv = (h2.z - 0.5) * 1.1;
        float wid = 0.08 + 0.12 * h2.w;
        float L = 0.16 + 0.20 * h3.x;
        float x = (q.y + curv * q.x * q.x) / wid;
        float qa = q.x / L;
        float I = exp(-(x * x * 0.8 + qa * qa)) * life;
        if (kind < 0.40) {
          float dir = h3.z < 0.5 ? 1.0 : -1.0;
          float hx = 0.06 + 0.8 * fract(h1.w * 7.13) + dir * x * 0.17;
          F.light += spectrum(hx) * I * 0.75;
        } else if (kind < 0.62) {
          F.light += mix(vec3(0.30, 0.12, 1.0), vec3(0.12, 0.22, 1.0), h1.z) * I * 0.8;
        } else if (kind < 0.78) {
          F.light += mix(vec3(0.95, 0.12, 0.55), vec3(0.95, 0.10, 0.22), h1.z) * I * 0.75;
        } else if (kind < 0.86) {
          F.light += vec3(1.0, 0.36, 0.12) * I * 0.6;
        } else {
          F.dark += I * 1.2;
        }
      }
    }
  }
}

// Dense layer of small defocused prism shards ("pills") with RGB-split edges.
void layerB(inout Field F, vec2 uv, float t, float fp, float salt, float skip) {
  vec2 baseCell = floor(uv / CELL_B);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 cell = baseCell + vec2(float(dx), float(dy));
      for (int k = 0; k < 2; k++) {
        vec2 sd = cell + vec2(float(k) * 31.7 + salt, float(k) * 5.3 - salt);
        vec4 h0 = hash42(sd);
        if (h0.w < skip) continue;
        float T = 1.8 + 2.4 * h0.x;
        float lt = t / T + h0.y;
        float g = floor(lt);
        float ph = lt - g;
        vec4 h1 = hash42(sd + g * vec2(7.31, 13.17));
        vec4 h2 = hash42(sd + g * vec2(29.7, 3.3) + 11.0);
        float a = h2.x * TAU + (h2.y - 0.5) * 0.8 * (ph - 0.5) * T;
        vec2 c = (cell + 0.3 + 0.4 * h1.xy) * CELL_B
               + vec2(cos(a), sin(a)) * 0.05 * (2.0 * ph - 1.0);
        vec2 q0 = uv - c;
        if (dot(q0, q0) >= REACH_B * REACH_B) continue;
        vec4 h3 = hash42(sd + g * vec2(5.1, 41.9) + 23.0);
        float ca = cos(a);
        float sa = sin(a);
        vec2 q = vec2(ca * q0.x + sa * q0.y, -sa * q0.x + ca * q0.y);

        float hl = 0.04 + 0.16 * h2.z;
        float r = 0.038 + 0.05 * h2.w;
        // defocus (+ pixel footprint so distant shards never alias), capped so
        // the reach hl + r + b + fringe <= 0.20 + 0.095 + 0.2 + 0.02 < REACH_B
        float b = min(0.045 + 0.05 * h3.x + 1.3 * fp, 0.2);
        float energy = r / (r + 1.5 * fp);
        vec2 o = vec2(0.0, 0.008 + 0.012 * h3.z);           // prism fringe offset
        float mR = 1.0 - smoothstep(-b, b, capsule(q - o, hl, r));
        float mG = 1.0 - smoothstep(-b, b, capsule(q, hl, r));
        float mB = 1.0 - smoothstep(-b, b, capsule(q + o, hl, r));
        if (mR + mG + mB < 0.001) continue;
        vec3 m = vec3(mR, mG, mB);
        float life = sin(3.14159265 * ph);
        life *= life * energy;
        float I = life * (0.6 + 0.6 * h3.w);
        float kind = h3.y;
        if (kind < 0.50) {
          // dispersed rainbow streak: hue runs along the shard and across it
          float dir = h1.z < 0.5 ? 1.0 : -1.0;
          float hx = 0.03 + 0.8 * pow(fract(h1.w * 5.37), 1.3)
                   + dir * (q.x / (hl + r)) * 0.28 + q.y / r * 0.08;
          F.light += spectrum(hx) * m * I;
        } else if (kind < 0.66) {
          F.light += mix(vec3(0.30, 0.13, 1.0), vec3(0.10, 0.25, 1.0), h1.z) * m * I;
        } else if (kind < 0.81) {
          F.light += mix(vec3(1.0, 0.12, 0.50), vec3(1.0, 0.10, 0.18), h1.z) * m * I;
        } else if (kind < 0.91) {
          F.light += vec3(1.0, 0.30, 0.08) * m * I;
        } else if (kind < 0.94) {
          F.light += vec3(0.12, 0.80, 1.0) * m * I * 0.8;
        } else {
          // white bokeh shard with coloured edges
          F.light += m * I * 0.9;
          F.white += mG * mG * I * 0.55;
        }
      }
    }
  }
}

Field evalField(vec2 uv, float t, float fp) {
  Field F;
  F.light = vec3(0.0);
  F.dark = 0.0;
  F.white = 0.0;
  // gentle domain warp: refractions are never perfectly straight
  vec2 w = vec2(vnoise(uv * 2.1 + vec2(t * 0.21, 3.7)), vnoise(uv * 2.1 + vec2(8.3, -t * 0.19))) - 0.5;
  uv += w * 0.06;
  layerA(F, uv, t);
  // two depths of shards drifting at different rates -> parallax
  layerB(F, uv + vec2(0.035, -0.015) * t, t, fp, 0.0, 0.50);
  layerB(F, uv * 1.35 + vec2(-0.03, 0.02) * t + 5.0, t, fp * 1.35, 71.0, 0.62);
  return F;
}

vec3 shade(vec2 uv, float t, float fp) {
  Field F = evalField(uv, t, fp);
  float n = fbm(uv * 0.9 + vec2(t * 0.05, -t * 0.03));
  // darker maroon-mauve base
  vec3 base = mix(vec3(0.08, 0.05, 0.07), vec3(0.34, 0.26, 0.32), smoothstep(0.3, 0.72, n));
  base *= 1.0 - 0.62 * clamp(F.dark, 0.0, 1.0);
  vec3 light = 1.0 - exp(-F.light * LIGHT_GAIN);   // soft-clip the additive light
  // hue-preserving combine: strong light mostly replaces the base
  float lw = max(light.r, max(light.g, light.b));
  vec3 col = base * (1.0 - 0.55 * lw) + light;
  col = 1.0 - exp(-col * 1.75);                     // filmic shoulder
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
