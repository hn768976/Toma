import { MAX_FLYBY } from "./flyby";
import { PALETTE_KEYS } from "./palettes";

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Procedural Helix nebula. All structure lives in "world" space: units of
// the first frame's height, origin at the first frame's centre, y down. The
// camera maps screen -> world, so the push-in reveals finer noise octaves
// rather than blurring a bitmap.
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform mat2 uCam; // screen -> world
uniform vec2 uCamCenter;
uniform float uTime;
uniform float uPx; // world units per pixel
uniform float uStarSize;  // keeps star discs from ballooning during the push-in
uniform vec3 uPal[${PALETTE_KEYS.length}];
uniform vec4 uFly[${MAX_FLYBY}];

out vec4 outColor;

#define SPACE uPal[0]
#define CLOUD uPal[1]
#define FOG uPal[2]
#define SHELL uPal[3]
#define SHELL_HI uPal[4]
#define GAP uPal[5]
#define RING_EDGE uPal[6]
#define RING_HOT uPal[7]
#define RING_TINT uPal[8]
#define CORE_OUTER uPal[9]
#define CORE_INNER uPal[10]
#define FLARE uPal[15]

const float TAU = 6.28318530718;

// ---------------------------------------------------------------- hashing
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(ivec2 c, int seed) {
  return vec3(pcg3d(uvec3(ivec3(c, seed)))) * (1.0 / 4294967295.0);
}

// ---------------------------------------------------------- gradient noise
vec2 grad(ivec2 c, int seed) {
  float a = hash3(c, seed).x * TAU;
  return vec2(cos(a), sin(a));
}
float gnoise(vec2 p, int seed) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i, seed), f);
  float b = dot(grad(i + ivec2(1, 0), seed), f - vec2(1.0, 0.0));
  float c = dot(grad(i + ivec2(0, 1), seed), f - vec2(0.0, 1.0));
  float d = dot(grad(i + ivec2(1, 1), seed), f - vec2(1.0, 1.0));
  return 1.4 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Octave count is limited to what the current pixel size can resolve, so
// 1080p renders skip octaves only a 4K frame would show.
float fbm(vec2 p, float freq, int seed) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  p *= freq;
  for (int i = 0; i < 9; i++) {
    if (freq > 0.35 / uPx) break;
    sum += amp * gnoise(p, seed + i * 17);
    norm += amp;
    p = r * p * 2.03 + vec2(1.7, 9.2);
    freq *= 2.03;
    amp *= 0.52;
  }
  return sum / max(norm, 1e-4);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// Radial filaments: noise that varies with direction but barely with radius.
float streaks(vec2 n, float r, float k, int seed) {
  vec2 dir = n / max(r, 1e-5);
  float s = gnoise(dir * k + vec2(r * 3.1, -r * 2.3), seed);
  s += 0.5 * gnoise(dir * k * 2.3 + vec2(-r * 5.0, r * 4.0), seed + 3);
  return s / 1.5;
}

// ------------------------------------------------------------------ stars
vec3 starColor(float h) {
  if (h < 0.40) return uPal[11];
  if (h < 0.68) return uPal[12];
  if (h < 0.92) return uPal[13];
  return uPal[14];
}

vec3 starLayer(vec2 w, float cell, int seed, float density, float rMin, float rMax,
               float gain, float haloGain) {
  vec2 g = w / cell;
  ivec2 id = ivec2(floor(g));
  vec2 f = fract(g);
  vec3 h = hash3(id, seed);
  if (h.z > density) return vec3(0.0);
  vec3 h2 = hash3(id, seed + 1);
  vec2 pos = 0.25 + 0.5 * h.xy;
  float d = length(f - pos) * cell;
  float rad = mix(rMin, rMax, h2.x * h2.x * h2.x) * uStarSize;
  float pr = max(rad, uPx * 0.75);
  float energy = (rad * rad) / (pr * pr);
  float twinkle = 0.82 + 0.18 * sin(uTime * (1.0 + 3.0 * h2.y) + h2.z * TAU);
  float core = exp(-(d * d) / (pr * pr)) * energy;
  float halo = haloGain * exp(-d / (rad * 3.5 + uPx));
  return starColor(h2.y) * (core + halo) * gain * twinkle * (0.45 + 0.55 * h2.z);
}

// Domain-warped fbm: lumpy, cloud-like clumps rather than straight fibres.
float clumps(vec2 p, float freq, int seed) {
  vec2 q = vec2(fbm(p, freq * 0.5, seed), fbm(p + vec2(5.2, 1.3), freq * 0.5, seed + 5));
  return fbm(p + 0.6 * q / freq, freq, seed + 9);
}

// --------------------------------------------------------------- nebula
vec3 nebula(vec2 w) {
  // Background: navy space with blue clouds concentrated in a diagonal band
  // running from lower-left to upper-right, a large cloud mass over the
  // upper-left and a deep, star-filled void on the right.
  float band = dot(w, normalize(vec2(0.40, 1.0))) + 0.17;
  float bandMask = exp(-band * band / (0.42 * 0.42));
  float c1 = fbm(w, 1.6, 11);
  float c2 = fbm(w + vec2(3.1, -1.7), 4.0, 23);
  vec2 ul = w - vec2(-0.6, -0.3);
  float upperLeft = exp(-dot(ul, ul) / (0.45 * 0.45));
  float rightVoid = smoothstep(0.45, 0.85, w.x) * smoothstep(-0.55, -0.15, w.y);
  vec2 ll = w - vec2(-0.5, 0.38);
  float lowerLeft = exp(-dot(ll, ll) / (0.35 * 0.35));
  float clouds = smoothstep(-0.15, 0.55, c1 + 0.4 * bandMask + 0.7 * upperLeft - 0.1 - 0.5 * rightVoid - 0.35 * lowerLeft);
  vec3 col = mix(SPACE, CLOUD * 0.85, clouds * clouds);
  col += CLOUD * 0.3 * smoothstep(-0.1, 0.6, c2) * clouds;
  float fogAmt = bandMask * smoothstep(-0.15, 0.45, fbm(w + 7.3, 2.2, 31)) * (1.0 - rightVoid);
  col = mix(col, FOG * (0.6 + 0.35 * c2), fogAmt * 0.55);
  col += CLOUD * 0.12 * bandMask * smoothstep(0.0, 0.5, c1) * (1.0 - rightVoid);
  col *= 0.65 + 0.35 * smoothstep(0.95, 0.25, abs(band));

  vec2 core = vec2(0.003, -0.021);
  vec2 n = w - core;
  float r = length(n);
  float grain = fbm(w + 4.2, 40.0, 61);
  float speck = fbm(w + 9.1, 120.0, 63);
  float lump = clumps(w + 2.7, 9.0, 71);
  // Space immediately around the nebula is darker navy than the far clouds.
  col *= mix(0.62, 1.0, smoothstep(0.3, 0.75, r));

  // Outer helix shell: a large ellipse offset to the upper-left plus a
  // second loop sweeping out to the left.
  vec2 e2 = rot(-0.30) * (w - vec2(-0.05, -0.03)) / vec2(0.50, 0.45);
  float r2 = length(e2);
  vec2 e3 = rot(0.35) * (w - vec2(-0.47, -0.08)) / vec2(0.36, 0.40);
  float r3 = length(e3);
  float shellTex = 0.55 + 0.45 * clumps(w + 1.3, 4.0, 41);
  float shell = exp(-pow((r2 - 0.93) / 0.14, 2.0)) * (0.9 + 0.5 * fbm(e2 * 2.0, 1.0, 43)) + smoothstep(0.98, 0.45, r2) * 0.2;
  float loop = exp(-pow((r3 - 0.9) / 0.15, 2.0)) * smoothstep(0.4, -0.5, e3.x) * 0.85;
  float shellAmt = (shell + loop) * shellTex * (0.9 + 0.3 * grain);
  shellAmt *= 1.0 - 0.45 * lowerLeft;
  col = mix(col, SHELL, clamp(shellAmt, 0.0, 1.0) * 0.8);
  // Thin, offset outer arc of the second loop, visible on the left.
  vec2 e4 = rot(-0.2) * (w - vec2(-0.1, -0.01)) / vec2(0.64, 0.52);
  float arc = exp(-pow((length(e4) - 1.0) / 0.05, 2.0)) * smoothstep(-0.2, -0.6, e4.x);
  col += SHELL_HI * arc * shellTex * 0.25;
  col += SHELL_HI * max(shellAmt - 0.7, 0.0) * 0.6;
  col += SHELL_HI * exp(-pow((r2 - 0.97) / 0.05, 2.0)) * shellTex * 0.07;

  // Inner bright ring: tilted ellipse, lumpy and grainy, with only a faint
  // radial grain. Its inner bright band reaches in close to the core.
  vec2 e = rot(-0.26) * (w - vec2(-0.009, 0.013)) / vec2(0.305, 0.27);
  float re = length(e);
  float ea = atan(e.y, e.x);
  float sFine = streaks(n, r, 90.0, 53);
  float sMid = streaks(n, r, 24.0, 59);
  float width = re < 1.0 ? 0.42 : 0.2;
  float ring = exp(-pow((re - 1.0) / width, 2.0));
  float inner = exp(-pow((re - 0.5) / 0.11, 2.0)) * 0.6;
  float side = 0.75 + 0.15 * cos(ea - 2.6) + 0.35 * fbm(vec2(cos(ea), sin(ea)) * 1.6, 1.0, 67);
  float fib = 0.78 + 0.3 * lump + 0.14 * sFine + 0.1 * sMid + 0.25 * grain + 0.18 * speck;
  float ringAmt = (ring + inner * (0.6 + 0.6 * lump)) * side * fib;

  // Annulus between the core and the ring: lavender-blue, not a dark void.
  float gapAmt = smoothstep(0.85, 0.45, re) * smoothstep(0.07, 0.14, r);
  vec3 gapCol = GAP * (0.85 + 0.3 * lump + 0.25 * speck + 0.35 * sFine);
  col = mix(col, gapCol, gapAmt * 0.7);

  vec3 ringCol = mix(RING_EDGE, RING_HOT, smoothstep(0.4, 1.1, ringAmt));
  ringCol = mix(ringCol, RING_TINT, smoothstep(0.88, 1.15, re) * 0.55);
  col = mix(col, ringCol * 1.25, 0.85 * smoothstep(0.05, 0.9, ringAmt));
  col = mix(col, RING_TINT, 0.2 * ring * smoothstep(0.0, 0.6, lump));
  float bloom = exp(-pow((re - 1.0) / 0.45, 2.0)) * side;
  col += RING_EDGE * bloom * 0.34;
  col += RING_HOT * max(speck, 0.0) * ring * side * 0.3;

  // Central glow with a ragged rim and a purple surround.
  float rc = r * (1.0 + 0.12 * streaks(n, r, 40.0, 71) + 0.15 * lump);
  col = mix(col, CORE_OUTER * 0.4, smoothstep(0.18, 0.115, rc) * 0.6);
  float glow = exp(-pow(rc / 0.109, 3.0));
  vec3 coreCol = mix(CORE_OUTER, CORE_INNER, exp(-pow(r / 0.08, 2.0)));
  col = mix(col, coreCol, glow * 0.95);
  col += CORE_INNER * exp(-pow(r / 0.03, 2.0)) * 0.25;

  // A few faint sparks drifting outward inside the core.
  float ang = atan(n.y, n.x);
  float sectors = 180.0;
  float sid = floor((ang / TAU + 0.5) * sectors);
  vec3 hs = hash3(ivec2(int(sid), 7), 83);
  if (hs.z < 0.1) {
    float sa = (sid + 0.5) / sectors * TAU - TAU * 0.5;
    float lateral = abs(sin(ang - sa)) * r;
    float pr = 0.02 + 0.1 * fract(hs.x + uTime * (0.01 + 0.02 * hs.y));
    float along = (r - pr) / 0.004;
    float spark = exp(-along * along) * exp(-pow(lateral / max(0.0012, uPx), 2.0));
    col += FLARE * spark * 0.15 * smoothstep(0.12, 0.06, pr);
  }

  // Stars: a dense fine multicoloured field, medium stars, and sparse
  // bright glints with halos. The nebula carries extra specks.
  float neb = clamp(ringAmt, 0.0, 1.0);
  col += starLayer(w, 0.006, 97, 0.35, 0.0007, 0.0013, 0.45, 0.0);
  col += starLayer(w + 0.5, 0.009, 101, 0.2 + 0.5 * neb, 0.0009, 0.0018, 0.6, 0.0);
  col += starLayer(w + 0.37, 0.024, 113, 0.55, 0.0016, 0.0034, 0.9, 0.0);
  col += starLayer(w + 0.71, 0.06, 127, 0.5, 0.0025, 0.005, 1.0, 0.12);
  col += starLayer(w + 0.13, 0.2, 139, 0.45, 0.004, 0.007, 1.2, 0.4);
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  p.y = -p.y;
  vec2 w = uCamCenter + uCam * p;

  vec3 col = nebula(w);

  // Foreground motes, positioned in screen space.
  for (int i = 0; i < ${MAX_FLYBY}; i++) {
    vec4 m = uFly[i];
    if (m.w <= 0.0) continue;
    float d = length(p - m.xy);
    float disc = smoothstep(m.z, m.z * 0.35, d);
    float glow = exp(-d / (m.z * 1.5));
    col = mix(col, FLARE, disc * m.w);
    col += FLARE * glow * m.w * 0.18;
  }

  // Soft shoulder so highlights roll off instead of clipping hard.
  col = col / (1.0 + max(col - 0.85, 0.0) * 0.6);
  // Pull saturation back toward the reference's photographic look.
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 0.86);
  // Dither against banding in the dark gradients.
  vec3 dn = hash3(ivec2(frag), 997) - 0.5;
  col += dn / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
