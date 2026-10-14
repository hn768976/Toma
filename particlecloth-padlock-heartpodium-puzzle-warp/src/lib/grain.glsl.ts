// Shared final-pass GLSL: film grain + ±1/255 dither, both a fixed function of
// pixel position and loop frame (frame % 600). No Math.random anywhere.
export const GRAIN_GLSL = /* glsl */ `
float pcgHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// uLoopFrame: frame % 600 (so frame 600 reuses frame 0's grain exactly)
vec3 applyGrainDither(vec3 c, vec2 fragCoord, float loopFrame, float grain, float floorLuma, float blackGate) {
  vec2 o1 = vec2(fract(loopFrame * 0.61803398) * 977.0, fract(loopFrame * 0.41421356) * 613.0);
  vec2 o2 = vec2(fract(loopFrame * 0.73205080) * 419.0, fract(loopFrame * 0.23606797) * 829.0);
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // grain ~1.5%: luminance noise; optional fade to zero below floorLuma (~3%)
  float gGate = floorLuma > 0.0 ? smoothstep(floorLuma * 0.35, floorLuma, L) : 1.0;
  float g = (pcgHash(fragCoord + o1) - 0.5) * 2.0;
  c += g * grain * gGate;
  // triangular dither, ±1/255; optionally skipped on exact black so black stays 0
  float d = pcgHash(fragCoord + o2) + pcgHash(fragCoord.yx + o1 * 1.37) - 1.0;
  float dGate = blackGate > 0.0 ? smoothstep(0.0, 1.5 / 255.0, L) : 1.0;
  c += d * (1.0 / 255.0) * dGate;
  return c;
}
vec3 linearToSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;
