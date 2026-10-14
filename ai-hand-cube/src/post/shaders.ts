// Shared GLSL snippets for the post pipeline (GLSL ES 3.0).

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Integer hash of pixel position + frame: deterministic, no Math.random().
export const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  uint h = pcg(p.x + pcg(p.y + pcg(p.z)));
  return float(h) / 4294967295.0;
}
`;

// Circle of confusion in pixels from a positive view distance.
export const COC = /* glsl */ `
uniform float uFocus;      // focus distance (world units)
uniform float uNearK;      // CoC scale in front of the focus plane (fraction of height)
uniform float uFarK;       // CoC scale behind the focus plane
uniform float uMaxCoc;     // max CoC (fraction of height)
uniform float uHeightPx;   // full-res height in px
float cocPx(float z) {
  float c = z < uFocus ? uNearK * (uFocus / z - 1.0) : uFarK * (1.0 - uFocus / z);
  return min(c, uMaxCoc) * uHeightPx;
}
`;
