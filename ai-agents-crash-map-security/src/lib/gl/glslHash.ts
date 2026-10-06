// Integer hash shared by shaders: deterministic on every GPU/ANGLE backend.
export const GLSL_HASH = /* glsl */ `
uint pcgU(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hashF(float a, float b) {
  uint h = pcgU(uint(int(a)) * 1973u + pcgU(uint(int(b)) * 9277u + 26699u));
  return float(h & 0xffffffu) / 16777216.0;
}
float hashF3(float a, float b, float c) {
  uint h = pcgU(uint(int(a)) * 1973u + pcgU(uint(int(b)) * 9277u + pcgU(uint(int(c)) * 26699u + 7u)));
  return float(h & 0xffffffu) / 16777216.0;
}
`;
