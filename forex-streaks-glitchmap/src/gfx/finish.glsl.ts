// Shared GLSL for the final pass: exact sRGB encode, triangular dither (+-1/255)
// and film grain. Both are fixed formulas of pixel position and the LOOP frame
// (frame % 600). There is no Math.random() and no temporal state.
export const GLSL_FINISH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  uint h = pcg(p.x + pcg(p.y + pcg(p.z)));
  return float(h) * (1.0 / 4294967296.0);
}
vec3 linearToSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// col: linear light. Returns display-encoded colour with dither and grain.
vec3 finish(vec3 col, vec2 fragCoord, float loopFrame, float grainAmount, float grainSize) {
  vec3 srgb = linearToSRGB(col);
  uvec2 gp = uvec2(floor(fragCoord / grainSize));
  uint fr = uint(loopFrame);
  float g = hash3(uvec3(gp, fr)) + hash3(uvec3(gp, fr + 977u)) - 1.0;       // triangular, [-1, 1]
  float luma = dot(srgb, vec3(0.299, 0.587, 0.114));
  float response = 0.35 + 0.65 * smoothstep(0.0, 0.5, luma);                // grain lives in the mid-tones
  srgb += g * grainAmount * response;
  uvec2 dp = uvec2(floor(fragCoord));
  float d = hash3(uvec3(dp, fr + 31u)) + hash3(uvec3(dp, fr + 1999u)) - 1.0; // triangular dither
  srgb += d * (1.0 / 255.0);
  return srgb;
}`;
