// Shared GLSL for point sprites with per-point depth of field (three.js looks).
export const BOKEH_GLSL = /* glsl */ `
// Circle of confusion in pixels for a point at view distance dist.
float cocPx(float dist, float focus, float nearK, float farK, float res) {
  float x = focus / dist - 1.0;            // >0 near, <0 far
  return abs(x) * (x > 0.0 ? nearK : farK) * res;
}
`;
// Fragment: soft disc with slightly brighter rim; 'sharp' 0..1 blends to a
// tight gaussian core when in focus.
export const BOKEH_FRAG_GLSL = /* glsl */ `
float bokehShape(vec2 p, float sharp, float edgePx) {
  float r = length(p);                       // 0..1 across the sprite radius
  float disc = clamp((1.0 - r) * edgePx, 0.0, 1.0);
  float rim = 0.78 + 0.22 * smoothstep(0.55, 0.95, r);
  float core = exp(-r * r * 9.0);
  return mix(disc * rim, core, sharp);
}
`;
