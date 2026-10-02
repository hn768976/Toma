// Shared GLSL snippets.

/**
 * Camera-facing ribbon expansion with a minimum on-screen width. Lines thinner
 * than `minPx` (fraction of frame height) are widened and dimmed by the same
 * factor, which keeps sub-pixel lines smooth instead of shimmering, at any
 * output resolution. Needs: attribute vec3 aTangent; attribute float aSide.
 */
export const ribbonVertex = /* glsl */ `
uniform float uViewH;      // drawing buffer height in px
uniform float uMinPx;      // minimum width, fraction of frame height
varying float vWidthFade;
vec3 ribbonExpand(vec3 center, vec3 tangent, float side, float width) {
  vec4 wc = modelMatrix * vec4(center, 1.0);
  vec3 tw = normalize(mat3(modelMatrix) * tangent);
  vec3 toCam = normalize(cameraPosition - wc.xyz);
  vec3 s = normalize(cross(tw, toCam));
  vec4 clip = projectionMatrix * viewMatrix * wc;
  float pxW = width * projectionMatrix[1][1] / clip.w * 0.5;   // in frame heights
  float k = max(1.0, uMinPx / max(pxW, 1e-6));
  vWidthFade = 1.0 / k;
  return wc.xyz + s * side * width * k * 0.5;
}
`;
