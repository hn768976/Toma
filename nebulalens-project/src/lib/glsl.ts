// Shared GLSL ES 3.00 chunks (WebGL2).
//
// All noise here is *periodic*: lattice coordinates are wrapped by an integer
// period, so a pattern slid by exactly one period is bit-identical to the
// unslid one. That is what makes every composition loop.

// three.js prepends "#version 300 es" (glslVersion: GLSL3), so chunks omit it.
export const GLSL_HEADER = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
`;

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uint hash2u(uvec2 v) { return pcg(v.x ^ pcg(v.y)); }
uint hash3u(uvec3 v) { return pcg(v.x ^ pcg(v.y ^ pcg(v.z))); }
float u2f(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
float hash12(ivec2 c, uint seed) { return u2f(hash3u(uvec3(uvec2(c), seed))); }
vec2 hash22(ivec2 c, uint seed) {
  uint h = hash3u(uvec3(uvec2(c), seed));
  return vec2(u2f(h), u2f(pcg(h)));
}
vec3 hash32(ivec2 c, uint seed) {
  uint h = hash3u(uvec3(uvec2(c), seed));
  uint h2 = pcg(h);
  return vec3(u2f(h), u2f(h2), u2f(pcg(h2)));
}
ivec2 wrapi(ivec2 c, ivec2 p) { return ((c % p) + p) % p; }
ivec3 wrapi3(ivec3 c, ivec3 p) { return ((c % p) + p) % p; }
`;

export const NOISE = /* glsl */ `
// Periodic 2D gradient noise, period 'per' lattice cells on each axis. ~[-1,1].
vec2 pgrad2(ivec2 c, ivec2 per, uint seed) {
  float a = 6.28318530718 * hash12(wrapi(c, per), seed);
  return vec2(cos(a), sin(a));
}
float pnoise2(vec2 p, ivec2 per, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  ivec2 c = ivec2(i);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(pgrad2(c, per, seed), f);
  float b = dot(pgrad2(c + ivec2(1, 0), per, seed), f - vec2(1.0, 0.0));
  float d = dot(pgrad2(c + ivec2(0, 1), per, seed), f - vec2(0.0, 1.0));
  float e = dot(pgrad2(c + ivec2(1, 1), per, seed), f - vec2(1.0, 1.0));
  return 1.4142 * mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}
// Periodic 3D gradient noise.
vec3 pgrad3(ivec3 c, ivec3 per, uint seed) {
  uint h = hash3u(uvec3(wrapi3(c, per)) ^ uvec3(seed, seed * 7u, seed * 13u));
  float z = u2f(h) * 2.0 - 1.0;
  float a = 6.28318530718 * u2f(pcg(h));
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), r * sin(a), z);
}
float pnoise3(vec3 p, ivec3 per, uint seed) {
  vec3 i = floor(p);
  vec3 f = p - i;
  ivec3 c = ivec3(i);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(pgrad3(c, per, seed), f);
  float n100 = dot(pgrad3(c + ivec3(1, 0, 0), per, seed), f - vec3(1, 0, 0));
  float n010 = dot(pgrad3(c + ivec3(0, 1, 0), per, seed), f - vec3(0, 1, 0));
  float n110 = dot(pgrad3(c + ivec3(1, 1, 0), per, seed), f - vec3(1, 1, 0));
  float n001 = dot(pgrad3(c + ivec3(0, 0, 1), per, seed), f - vec3(0, 0, 1));
  float n101 = dot(pgrad3(c + ivec3(1, 0, 1), per, seed), f - vec3(1, 0, 1));
  float n011 = dot(pgrad3(c + ivec3(0, 1, 1), per, seed), f - vec3(0, 1, 1));
  float n111 = dot(pgrad3(c + ivec3(1, 1, 1), per, seed), f - vec3(1, 1, 1));
  float x00 = mix(n000, n100, u.x);
  float x10 = mix(n010, n110, u.x);
  float x01 = mix(n001, n101, u.x);
  float x11 = mix(n011, n111, u.x);
  return 1.15 * mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}
`;

// Final pass shared by all eight compositions: ~1% monochrome grain from a
// fixed hash of (pixel, loop frame), faded out below 3% luminance, then a
// ±1/255 blue-noise dither (fresh offset each frame) before 8-bit quantisation.
export const GRAIN_DITHER = /* glsl */ `
uniform sampler2D uBlue;
uniform float uFrame;
vec3 grainDither(vec3 c, ivec2 px) {
  c = max(c, vec3(0.0));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  int f = int(uFrame + 0.5);
  float g = u2f(hash3u(uvec3(uvec2(px), uint(f) + 977u))) * 2.0 - 1.0;
  c += g * 0.01 * smoothstep(0.0, 0.03, lum);
  uint ho = pcg(uint(f) * 2654435761u + 11u);
  ivec2 o = ivec2(int(ho & 63u), int((ho >> 8u) & 63u));
  float bnR = texelFetch(uBlue, (px + o) & 63, 0).r;
  float bnG = texelFetch(uBlue, (px + o + ivec2(21, 43)) & 63, 0).r;
  float bnB = texelFetch(uBlue, (px + o + ivec2(47, 9)) & 63, 0).r;
  float keepBlack = smoothstep(0.0, 0.004, lum);
  c += (vec3(bnR, bnG, bnB) - 0.5) * (2.0 / 255.0) * keepBlack;
  return c;
}
`;
