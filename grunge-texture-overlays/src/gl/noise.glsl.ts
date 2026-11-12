/** Shared GLSL ES 3.00 noise helpers (integer hashes: identical on every run of the same GPU/driver). */
export const NOISE_GLSL = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uint hash3u(ivec3 p) {
  ivec3 q = p + ivec3(1048576); // keep positive: int->uint of negatives is not portable
  return pcg(uint(q.x) + pcg(uint(q.y) + pcg(uint(q.z))));
}
float hash3(ivec3 p) { return float(hash3u(p)) * (1.0 / 4294967296.0); }
vec2 hash3v(ivec3 p) {
  uint h = hash3u(p);
  return vec2(float(h & 0xffffu), float(h >> 16u)) * (1.0 / 65536.0);
}

// gradient noise, roughly in [-0.7, 0.7]
float gnoise(vec2 p, int s) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 ii = ivec2(i);
  float a = dot(hash3v(ivec3(ii, s)) * 2.0 - 1.0, f);
  float b = dot(hash3v(ivec3(ii + ivec2(1, 0), s)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash3v(ivec3(ii + ivec2(0, 1), s)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash3v(ivec3(ii + ivec2(1, 1), s)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// value noise in [0, 1]
float vnoise(vec2 p, int s) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hash3(ivec3(ii, s));
  float b = hash3(ivec3(ii + ivec2(1, 0), s));
  float c = hash3(ivec3(ii + ivec2(0, 1), s));
  float d = hash3(ivec3(ii + ivec2(1, 1), s));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT_OCT = mat2(0.80, 0.60, -0.60, 0.80);

// fractal gradient noise, roughly in [-1, 1]
float fbm(vec2 p, int s, int oct) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= oct) break;
    sum += amp * gnoise(p, s + i * 131);
    norm += amp;
    p = ROT_OCT * p * 2.03 + vec2(17.1, -9.3);
    amp *= 0.5;
  }
  return sum / norm * 1.6;
}

// ridged / rough variant in [0, 1]
float rough(vec2 p, int s, int oct) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= oct) break;
    sum += amp * abs(gnoise(p, s + i * 71)) * 1.6;
    norm += amp;
    p = ROT_OCT * p * 2.11 + vec2(-3.7, 11.9);
    amp *= 0.55;
  }
  return sum / norm;
}

// Grain thresholded by coverage: cov=0 -> exactly 0, cov=1 -> mostly 1; g is a grain value in ~[0,1].
float grit(float cov, float g, float soft) {
  return smoothstep(1.0 - cov - soft, 1.0 - cov + soft, g) * smoothstep(0.0, 0.04, cov);
}
// multi-scale paper/toner grain in ~[0,1]
float grain3(vec2 P, int s) {
  float g = 0.5 * vnoise(P * 380.0, s) + 0.3 * vnoise(P * 130.0, s + 1) + 0.2 * vnoise(P * 42.0, s + 2);
  return clamp((g - 0.5) * 2.4 + 0.5, 0.0, 1.0); // stretch to roughly uniform [0,1]
}

// Random round specks on a grid of cells. cell: cell size (height units); prob: chance a cell has a speck;
// rMin/rMax: radius (height units); px: pixel size (height units). Returns coverage * brightness.
float specks(vec2 p, float cell, float prob, float rMin, float rMax, float px, int s) {
  vec2 g = p / cell;
  ivec2 gi = ivec2(floor(g));
  float best = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 c = gi + ivec2(i, j);
      uint h = hash3u(ivec3(c, s));
      float hp = float(h & 0xffffu) / 65536.0;
      if (hp > prob) continue;
      vec2 o = hash3v(ivec3(c, s + 7));
      float hr = hash3(ivec3(c, s + 13));
      float hb = hash3(ivec3(c, s + 19));
      vec2 centre = (vec2(c) + o) * cell;
      float r = mix(rMin, rMax, hr * hr * hr);
      // slightly irregular: stretch along a random axis
      float ang = hb * 6.2831;
      vec2 d = p - centre;
      vec2 dr = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * d;
      dr.x *= mix(0.55, 1.8, fract(hb * 7.31));
      // irregular outline: modulate the radius with angle
      float th = atan(dr.y, dr.x);
      float dist = length(dr) * (1.0 + 0.1 * sin(th * 2.0 + hb * 40.0) + 0.08 * sin(th * 5.0 + hb * 17.0));
      float re = max(r, px * 0.6);
      float cov = 1.0 - smoothstep(re - px * 0.6, re + px * 0.6, dist);
      cov *= min(1.0, (r * r) / (re * re));
      best = max(best, cov * mix(0.45, 1.0, fract(hb * 13.7)));
    }
  }
  return best;
}
`;
