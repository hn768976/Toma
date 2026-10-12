// GLSL snippets shared by the three.js and PixiJS final passes.
// Grain and dither are fixed formulas of (pixel, frame % 600) — no Math.random.

export const GLSL_HASH = /* glsl */ `
uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
// Uniform [0,1) from integer pixel + loop frame + channel salt.
float hash3(uvec2 p, uint f, uint salt) {
  return float(pcgHash(p.x + pcgHash(p.y + pcgHash(f * 7u + salt)))) / 4294967296.0;
}
`;

/**
 * Final 8-bit output stage:
 *   - film grain: zero-mean triangular noise, amplitude uGrain (≈ peak-to-peak
 *     fraction of full scale), slightly weighted toward mid-tones;
 *   - ±1/255 triangular dither so the 8-bit quantiser never makes steps.
 */
export const GLSL_FINAL = /* glsl */ `
${GLSL_HASH}
vec3 grainAndDither(vec3 c, vec2 fragCoord, float loopFrame, float grainAmt) {
  uvec2 ip = uvec2(fragCoord);
  uint f = uint(loopFrame);
  // Grain (monochrome, triangular PDF)
  float g = hash3(ip, f, 11u) + hash3(ip, f, 23u) - 1.0;
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  c += g * grainAmt * (0.8 + 0.7 * sqrt(clamp(luma, 0.0, 1.0)));
  // Dither ±1/255 per channel (triangular)
  vec3 d = vec3(
    hash3(ip, f, 101u) + hash3(ip, f, 102u),
    hash3(ip, f, 103u) + hash3(ip, f, 104u),
    hash3(ip, f, 105u) + hash3(ip, f, 106u)) - 1.0;
  return c + d / 255.0;
}
// Soft shoulder above 0.85 so additive highlights roll off instead of clipping.
vec3 softClip(vec3 c) {
  vec3 k = vec3(0.85);
  vec3 over = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
`;
