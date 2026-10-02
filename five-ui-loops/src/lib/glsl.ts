// Shared GLSL (GLSL ES 3.00). Integer hashes: deterministic on every GPU and
// on SwiftShader; no time or random sources.
export const GLSL_HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3u(uvec3 p) {
  return float(pcg(p.x ^ pcg(p.y ^ pcg(p.z)))) * (1.0 / 4294967296.0);
}
// Triangular noise in [-1, 1] from pixel position + frame.
float tri(uvec3 p) {
  return hash3u(p) + hash3u(p + uvec3(7919u, 104729u, 1299709u)) - 1.0;
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;
