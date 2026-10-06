// Shared GLSL snippets.

// Integer hash (PCG-ish). Identical results on every run; used for grain,
// dither and procedural patterns.
export const GLSL_HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash13u(uvec3 p) {
  return float(pcg(p.x ^ pcg(p.y ^ pcg(p.z)))) / 4294967295.0;
}
float hash12i(ivec2 p) {
  return float(pcg(uint(p.x) ^ pcg(uint(p.y) + 0x9e3779b9u))) / 4294967295.0;
}
`;

// Anti-aliased line helper: distance d (in pattern units), derivative fw,
// half-width w in pixels. Returns coverage, faded to the mean coverage where
// the pattern gets denser than a few pixels (prevents moire / crawling).
export const GLSL_AALINE = /* glsl */ `
float aaLine(float coord, float halfWidthPx) {
  float fw = max(fwidth(coord), 1e-5);
  float d = abs(fract(coord - 0.5) - 0.5) / fw;      // distance to line in px
  float cov = 1.0 - smoothstep(halfWidthPx - 0.5, halfWidthPx + 0.5, d);
  float meanCov = clamp(2.0 * halfWidthPx * fw, 0.0, 1.0); // average over a period
  // spacing in pixels = 1/fw. Fade to mean when spacing < 3px.
  float fade = smoothstep(2.5, 6.0, 1.0 / fw);
  return mix(meanCov, cov, fade);
}
`;
