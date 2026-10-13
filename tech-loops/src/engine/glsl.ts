/** Shared GLSL. Every random-looking value in a shader comes from an integer hash of
 *  position (and, for grain, of frame % 600), so frames are reproducible. */

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uint pcg3(uvec3 v) { return pcg(v.x ^ pcg(v.y ^ pcg(v.z))); }
float hash1(uvec3 v) { return float(pcg3(v)) * (1.0 / 4294967296.0); }
float hash21(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  return float(pcg(q.x ^ pcg(q.y))) * (1.0 / 4294967296.0);
}
float hash31(vec3 p) {
  uvec3 q = uvec3(ivec3(floor(p)) + 32768);
  return hash1(q);
}
`;

/** Gradient-free value noise (3D), smooth and cheap; deterministic via the integer hash. */
export const NOISE = /* glsl */ `
${HASH}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1, 0, 0));
  float n010 = hash31(i + vec3(0, 1, 0));
  float n110 = hash31(i + vec3(1, 1, 0));
  float n001 = hash31(i + vec3(0, 0, 1));
  float n101 = hash31(i + vec3(1, 0, 1));
  float n011 = hash31(i + vec3(0, 1, 1));
  float n111 = hash31(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm3(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 3.7, 9.2); a *= 0.5; }
  return s / 0.9375;
}
`;

export const COLOR = /* glsl */ `
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;
