/** Shared GLSL: integer hashes (bit-exact everywhere), periodic noise, dither, grain. */
export const GLSL_COMMON = /* glsl */ `
#define TAU 6.283185307179586
#define PI 3.141592653589793

uint hashU(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16; return x;
}
float hash1(uint x) { return float(hashU(x) >> 8) * (1.0 / 16777216.0); }
float hash2i(ivec2 p, uint s) {
  return hash1(uint(p.x) * 1597334677u ^ hashU(uint(p.y) * 3812015801u ^ s));
}
float hash3i(ivec3 p, uint s) {
  return hash1(uint(p.x) * 1597334677u ^ hashU(uint(p.y) * 3812015801u ^ hashU(uint(p.z) * 2798796415u ^ s)));
}
vec3 grad3(ivec3 p, uint s) {
  float a = hash3i(p, s) * TAU;
  float z = hash3i(p, s ^ 0x9e3779b9u) * 2.0 - 1.0;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), r * sin(a), z);
}
int wrapi(int v, int m) { int r = v % m; return r < 0 ? r + m : r; }
/* Gradient noise, periodic in z with integer period pz. Range ~[-1,1]. */
float pnoise(vec3 x, int pz, uint s) {
  vec3 i = floor(x); vec3 f = x - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec3 b = ivec3(i);
  int z0 = wrapi(b.z, pz), z1 = wrapi(b.z + 1, pz);
  float n000 = dot(grad3(ivec3(b.x, b.y, z0), s), f - vec3(0,0,0));
  float n100 = dot(grad3(ivec3(b.x+1, b.y, z0), s), f - vec3(1,0,0));
  float n010 = dot(grad3(ivec3(b.x, b.y+1, z0), s), f - vec3(0,1,0));
  float n110 = dot(grad3(ivec3(b.x+1, b.y+1, z0), s), f - vec3(1,1,0));
  float n001 = dot(grad3(ivec3(b.x, b.y, z1), s), f - vec3(0,0,1));
  float n101 = dot(grad3(ivec3(b.x+1, b.y, z1), s), f - vec3(1,0,1));
  float n011 = dot(grad3(ivec3(b.x, b.y+1, z1), s), f - vec3(0,1,1));
  float n111 = dot(grad3(ivec3(b.x+1, b.y+1, z1), s), f - vec3(1,1,1));
  return 1.6 * mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
                   mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
/* fBm, periodic in z: octave k samples z*2^k with period pz*2^k. */
float pfbm(vec3 x, int pz, int oct, uint s) {
  float a = 0.5, sum = 0.0, norm = 0.0;
  for (int k = 0; k < 6; k++) {
    if (k >= oct) break;
    sum += a * pnoise(x, pz, s + uint(k) * 101u);
    norm += a; a *= 0.5; x = vec3(x.xy * 2.03 + vec2(17.1, 9.3), x.z * 2.0); pz *= 2;
  }
  return sum / norm;
}
/* 1D value noise periodic with integer period p (smooth). */
float vnoise1p(float x, int p, uint s) {
  float i = floor(x); float f = x - i; f = f * f * (3.0 - 2.0 * f);
  int a = wrapi(int(i), p), b = wrapi(int(i) + 1, p);
  return mix(hash1(uint(a) * 747796405u ^ s), hash1(uint(b) * 747796405u ^ s), f);
}
/* Triangular-PDF dither of +-1/255 and film grain, from pixel + looped frame only. */
float ditherTri(vec2 fc, uint fr) {
  ivec2 p = ivec2(fc);
  return (hash3i(ivec3(p, int(fr)), 0x1234u) + hash3i(ivec3(p, int(fr)), 0x5678u) - 1.0) / 255.0;
}
float grainN(vec2 fc, uint fr) {
  ivec2 p = ivec2(fc);
  return hash3i(ivec3(p, int(fr)), 0xabcdu) + hash3i(ivec3(p, int(fr)), 0x4321u) - 1.0;
}
/* Exact loop phases from integer frame arithmetic (uFI = animation frame, uPI = period). */
uniform int uFI;
uniform int uPI;
float phaseK(int k) { return float((uFI * k) % uPI) / float(uPI); }         // fract(k * t)
float zLoop(int pz) { return float((uFI * pz) % (uPI * pz)) / float(uPI); }  // pz * t, wrapped at pz
int cycleK(int k, int half_) { return ((uFI * k * 2 + half_ * uPI) / (2 * uPI)) % k; } // floor(k*t + half_/2) mod k
vec3 srgb2lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 lin2srgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
`;

export const hexToVec = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
