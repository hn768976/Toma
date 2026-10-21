/** Shared GLSL (ES 3.00) helpers. Integer hashes keep noise exact and repeatable. */
export const GLSL_PRELUDE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;     // backing-store size in pixels
uniform float uK;      // backing pixels per 4K pixel
uniform int uFrame;    // current frame
out vec4 outColor;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uint hashU(uint a, uint b, uint c) { return pcg(a ^ pcg(b ^ pcg(c))); }
float hash3i(ivec3 p) {
  return float(hashU(uint(p.x + 65536), uint(p.y + 65536), uint(p.z + 65536)) >> 8) / 16777216.0;
}
float hash2i(ivec2 p, int s) { return hash3i(ivec3(p, s)); }
float hash1i(int a, int s) { return hash3i(ivec3(a, s, 977)); }

// Value noise on an integer lattice; z is an integer "seed slice".
float vnoise(vec2 p, int z) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hash2i(ii, z), b = hash2i(ii + ivec2(1, 0), z);
  float c = hash2i(ii + ivec2(0, 1), z), d = hash2i(ii + ivec2(1, 1), z);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// 3D value noise (continuous in all three axes).
float vnoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  ivec3 q = ivec3(i);
  float n000 = hash3i(q), n100 = hash3i(q + ivec3(1,0,0));
  float n010 = hash3i(q + ivec3(0,1,0)), n110 = hash3i(q + ivec3(1,1,0));
  float n001 = hash3i(q + ivec3(0,0,1)), n101 = hash3i(q + ivec3(1,0,1));
  float n011 = hash3i(q + ivec3(0,1,1)), n111 = hash3i(q + ivec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm(vec2 p, int z) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p, z + i * 17); p = p * 2.03 + 11.7; a *= 0.5; }
  return s / 0.96875;
}
// Noise that loops: the time axis is a circle of radius r in noise space.
float loopNoise3(vec2 p, float phase, float r) {
  float a = 6.28318530718 * phase;
  return vnoise3(vec3(p.x + r * cos(a), p.y, r * sin(a) + 37.0));
}
// Pixel position in 4K units (y down, matching Canvas 2D).
vec2 px4k() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uK; }
`;
