// Shared GLSL snippets (GLSL ES 3.00 / WebGL2).
// Grain and dither are a fixed integer hash of pixel position and frame:
// identical on every run, every thread, every machine.
export const HASH_GLSL = /* glsl */ `
uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
// Uniform [0,1) from integer pixel coords, frame and a channel salt.
float hash3(uvec2 p, uint frame, uint salt) {
  uint h = pcgHash(p.x + pcgHash(p.y + pcgHash(frame * 4u + salt)));
  return float(h) * (1.0 / 4294967296.0);
}
// Triangular-PDF dither, range (-1/255, +1/255).
vec3 ditherTPDF(uvec2 p, uint frame) {
  vec3 a = vec3(hash3(p, frame, 1u), hash3(p, frame, 2u), hash3(p, frame, 3u));
  vec3 b = vec3(hash3(p, frame, 4u), hash3(p, frame, 5u), hash3(p, frame, 6u));
  return (a + b - 1.0) / 255.0;
}
// Monochrome film grain, zero-mean, amplitude amp (fraction of full scale).
float grain(uvec2 p, uint frame, float amp) {
  float g = hash3(p, frame, 7u) + hash3(p, frame, 8u) - 1.0; // triangular -1..1
  return g * amp;
}
`;
