// Shared GLSL snippets.

// Blue-noise dither for gradient backgrounds. `uBnOffset` is derived from
// `frame % period` only, so the pattern loops with the composition.
export const BG_DITHER_GLSL = /* glsl */ `
uniform sampler2D uBlueNoise;
uniform vec3 uBnOffset; // xy: integer pixel offset, z: golden-ratio value shift
float bgDither(vec2 fragCoord) {
  vec2 p = mod(floor(fragCoord) + uBnOffset.xy, 64.0);
  float n = texture2D(uBlueNoise, (p + 0.5) / 64.0).r;
  return fract(n + uBnOffset.z) - 0.5; // [-0.5, 0.5)
}
`;

// Integer hash (PCG-style) – deterministic film grain from pixel position and
// frame. WebGL2 / GLSL3 has full uint support.
export const HASH_GLSL = /* glsl */ `
uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 v) {
  return float(pcgHash(v.x + pcgHash(v.y + pcgHash(v.z)))) / 4294967295.0;
}
`;

export const COLOR_GLSL = /* glsl */ `
vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
vec3 srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}
`;
