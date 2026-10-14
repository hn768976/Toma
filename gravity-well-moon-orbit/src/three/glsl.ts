/** Shared GLSL snippets. All noise is hash-based (no textures, no randomness). */

export const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3u(uvec3 p) {
  return float(pcg(p.x ^ pcg(p.y ^ pcg(p.z)))) / 4294967295.0;
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
`;

/** Smooth 3D value noise + fbm. */
export const NOISE = /* glsl */ `
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = hash13(i + vec3(0.0, 0.0, 0.0));
  float b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0));
  float d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0));
  float f1 = hash13(i + vec3(1.0, 0.0, 1.0));
  float g = hash13(i + vec3(0.0, 1.0, 1.0));
  float h = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
             mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float fbm(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p = p * 2.03 + vec3(17.1, 9.2, 4.7);
    a *= 0.5;
  }
  return s;
}
`;

/**
 * Well height: y = -A / sqrt(r^2 + c^2) for the main well, plus an optional
 * second, smaller travelling well (the Moon's or Earth's own dip).
 */
export const WELL = /* glsl */ `
uniform float uWellA;
uniform float uWellC;
uniform vec3 uDip;      // x, z, depth A2
uniform float uDipC;
float wellHeight(vec2 p) {
  float y = -uWellA * inversesqrt(dot(p, p) + uWellC * uWellC);
  vec2 d = p - uDip.xy;
  y -= uDip.z * inversesqrt(dot(d, d) + uDipC * uDipC);
  return y;
}
`;
