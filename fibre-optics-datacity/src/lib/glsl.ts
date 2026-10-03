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
// Film grain with a mono part and an independent per-channel part. The
// per-channel part matters for delivery: in saturated dark blues most of the
// gradient lives in the 4:2:0 chroma planes, and mono-only grain leaves the
// chroma noise-free, which the H.264 encoder then flattens into contours.
vec3 grainRGB(uvec2 p, uint frame, float amp) {
  float m = grain(p, frame, amp * 0.75);
  // chroma part on 2x2 blocks so it survives 4:2:0 subsampling
  uvec2 q = p >> 1u;
  vec3 c = vec3(
    hash3(q, frame, 9u) + hash3(q, frame, 10u) - 1.0,
    hash3(q, frame, 11u) + hash3(q, frame, 12u) - 1.0,
    hash3(q, frame, 13u) + hash3(q, frame, 14u) - 1.0) * amp * 0.6;
  return vec3(m) + c;
}
`;
