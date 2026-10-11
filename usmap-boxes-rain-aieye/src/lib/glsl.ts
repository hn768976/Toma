// Shared GLSL. Grain and dither are a fixed integer hash of pixel position and the
// looped frame number, so they are identical in every render thread.
export const HASH_GLSL = /* glsl */ `
uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  uint h = pcgHash(p.x ^ pcgHash(p.y ^ pcgHash(p.z)));
  return float(h) / 4294967295.0;
}
// Triangular-distributed noise in [-1, 1] from pixel + frame + channel salt.
float triNoise(vec2 fragCoord, float frame, uint salt) {
  uvec3 p = uvec3(uint(fragCoord.x), uint(fragCoord.y), uint(frame) * 4u + salt);
  float a = hash3(p);
  float b = hash3(p + uvec3(7919u, 104729u, 1u));
  return a + b - 1.0;
}
// Apply grain (amplitude, sRGB units) and +-1/255 dither. Call last.
vec3 grainDither(vec3 c, vec2 fragCoord, float frame, float grain) {
  float g = triNoise(fragCoord, frame, 1u);
  c += g * grain * (0.6 + 0.4 * (1.0 - abs(c - 0.5) * 2.0));
  c.r += triNoise(fragCoord, frame, 2u) / 255.0;
  c.g += triNoise(fragCoord, frame, 3u) / 255.0;
  c.b += triNoise(fragCoord, frame, 5u) / 255.0;
  return c;
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
