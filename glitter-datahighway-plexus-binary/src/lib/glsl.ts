// GLSL snippets shared by the three.js and PixiJS pipelines (GLSL ES 3.00).

/** Final-pass finish: linear -> sRGB, vignette, grain, dither. */
export const FINISH_GLSL = /* glsl */ `
float pcgHash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return float(v.x & 0x00ffffffu) / 16777216.0;
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Soft shoulder: linear in the darks, rolls off towards 1.
vec3 softClip(vec3 c, float knee) {
  vec3 over = max(c - knee, 0.0);
  return min(c, knee) + (1.0 - knee) * (1.0 - exp(-over / (1.0 - knee)));
}
// pixel = integer pixel coordinate; loopFrame = frame % 600.
// grain: amplitude (0.015 = 1.5%); grainFloor: luminance below which grain fades (0 = never).
vec3 finish(vec3 lin, vec2 uv, vec2 pixel, float loopFrame, float vignette, float grain, float grainFloor) {
  float r = length((uv - 0.5) * vec2(1.0, 0.82));
  lin *= mix(1.0, smoothstep(0.95, 0.25, r), vignette);
  vec3 s = linearToSrgb(lin);
  uvec3 seed = uvec3(uvec2(pixel), uint(loopFrame));
  float g = pcgHash(seed) + pcgHash(seed + uvec3(7u, 131u, 601u)) - 1.0; // triangular, -1..1
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float gAmt = grain * (grainFloor > 0.0 ? smoothstep(grainFloor * 0.5, grainFloor * 1.5, l) : 1.0);
  s += g * gAmt * (0.35 + 0.65 * l);
  float d = pcgHash(seed + uvec3(911u, 17u, 3u)) + pcgHash(seed + uvec3(23u, 999u, 77u)) - 1.0;
  s += d / 255.0;
  return clamp(s, 0.0, 1.0);
}
`;
