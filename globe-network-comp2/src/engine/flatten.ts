/**
 * Shared GLSL: "flattens" the globe around the current point of interest.
 * Sphere points are re-mapped with an azimuthal-equidistant projection centred
 * on `uCenter`, then bent with a gentle curvature (`uCurv`, 0.5 = real sphere).
 * With uFlat = 0 the globe is left as a true sphere (used for the orbital
 * pull-back in V2).
 * Result: the camera flies over a slightly curved map (as in the reference)
 * instead of seeing the globe's limb. Every layer (earth, dots, arcs) uses the
 * same mapping so they stay registered.
 */
export const FLATTEN_GLSL = /* glsl */ `
uniform vec3 uCenter;
uniform float uCurv;
uniform float uFlat; // 1 = flattened map, 0 = true sphere
vec3 flattenPos(vec3 p) {
  if (uFlat < 0.5) return p;
  float r = length(p);
  vec3 N = p / r;
  float c = dot(N, uCenter);
  vec3 d = N - uCenter * c;
  float dl = length(d);
  float th = atan(dl, c);              // precise even for tiny angles
  vec3 dir = dl > 1e-7 ? d / dl : vec3(0.0);
  return uCenter * (r - uCurv * th * th) + dir * th;
}
float flatAngle(vec3 p) {
  if (uFlat < 0.5) return 0.0;
  vec3 N = normalize(p);
  return atan(length(N - uCenter * dot(N, uCenter)), dot(N, uCenter));
}
// rotate v by the rotation that takes unit vector N onto uCenter
vec3 toFlatFrame(vec3 v, vec3 N) {
  if (uFlat < 0.5) return v;
  vec3 ax = cross(N, uCenter);
  float s = length(ax);
  if (s < 1e-7) return v;
  vec3 k = ax / s;
  float c = dot(N, uCenter);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
`;
