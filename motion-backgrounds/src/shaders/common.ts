/**
 * Shared GLSL building blocks.
 *
 * Every time-dependent term in these shaders is driven through sin/cos of
 * `TAU * n * uPhase` where `n` is an integer and `uPhase` runs 0 -> 1 across the
 * composition. That makes the whole field exactly periodic, so the last frame
 * flows back into the first with no visible seam.
 */
export const GLSL_COMMON = /* glsl */ `
const float TAU = 6.28318530718;

// Cheap hash used only for the final dither pass.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Triangular-PDF dither. H.264 quantises hard in flat gradient regions, so a
// sub-LSB noise floor is what keeps these large soft ramps free of banding.
vec3 dither(vec3 col, vec2 fragCoord, float phase) {
  float a = hash21(fragCoord + phase * 311.7);
  float b = hash21(fragCoord.yx + phase * 517.3 + 19.1);
  return col + ((a + b) - 1.0) * (1.6 / 255.0);
}

// Filmic-ish shoulder. Keeps the specular ridges from clipping to flat white.
vec3 tonemap(vec3 x) {
  return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
}

vec3 toGamma(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

vec3 toLinear(vec3 c) {
  return pow(max(c, 0.0), vec3(2.2));
}
`;
