// Shared GLSL for thin additive ribbons with analytic AA and per-vertex
// defocus: a defocused line gets wider by its circle of confusion and loses
// brightness in proportion, so the energy is conserved (a cheap, exact DoF
// for additive lines and dots, where depth-buffer DoF cannot work).
export const DEFOCUS_GLSL = /* glsl */ `
uniform vec2 uRes;        // drawing-buffer size in px
uniform float uFocus;     // view distance in focus
uniform float uAperture;  // CoC at infinity, fraction of frame height
uniform float uMaxCoc;    // clamp, fraction of frame height
float cocPx(float z) {
  return min(abs(1.0 - uFocus / max(z, 1e-3)) * uAperture, uMaxCoc) * uRes.y;
}
`;

// Expands a centre-line vertex to one side of a ribbon.
// Returns the clip position; writes vDist (signed px from centre), vHalf.
export const RIBBON_GLSL = /* glsl */ `
varying float vDist;
varying float vHalf;
varying float vEnergy;
vec4 ribbon(vec3 p0, vec3 p1, float side, float halfWidthPx) {
  vec4 v0 = modelViewMatrix * vec4(p0, 1.0);
  vec4 c0 = projectionMatrix * v0;
  vec4 c1 = projectionMatrix * (modelViewMatrix * vec4(p1, 1.0));
  vec2 s0 = c0.xy / c0.w * 0.5 * uRes;
  vec2 s1 = c1.xy / c1.w * 0.5 * uRes;
  vec2 d = s1 - s0;
  d = length(d) > 1e-6 ? normalize(d) : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  float coc = cocPx(-v0.z);
  float hw = halfWidthPx + 0.5 * coc;
  float hq = max(hw, 0.5);
  float wq = hq + 1.0;
  c0.xy += n * side * wq / (0.5 * uRes) * c0.w;
  vDist = side * wq;
  vHalf = hq;
  vEnergy = halfWidthPx / hq;
  return c0;
}
`;

export const RIBBON_FRAG_GLSL = /* glsl */ `
varying float vDist;
varying float vHalf;
varying float vEnergy;
float ribbonCoverage() {
  // box-filtered core; soft shoulders for defocused (wide) lines
  float a = abs(vDist);
  float hard = clamp(vHalf + 0.5 - a, 0.0, 1.0);
  float soft = 1.0 - smoothstep(vHalf * 0.35, vHalf + 0.5, a);
  return mix(hard, soft, smoothstep(1.5, 4.0, vHalf)) * vEnergy;
}
`;
