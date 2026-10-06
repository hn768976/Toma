import { Vector2 } from "three";

/**
 * Uniforms shared by every material of a look (same object references, so a
 * single update per frame reaches all of them).
 *
 * Depth of field is defined resolution-independently: the circle of confusion
 * is a fraction of frame height, so 720p and 4K renders look identical.
 *   coc(d) = min(aperture * max(|d - focus| - focusRange, 0) / d * (d < focus ? nearMul : 1), maxCoc)
 */
export const makeShared = () => ({
  uResolution: { value: new Vector2(1280, 720) },
  uTime: { value: 0 },
  uFrame: { value: 0 },
  uFocus: { value: 10 },
  uFocusRange: { value: 0 },
  uAperture: { value: 0.01 },
  uNearMul: { value: 1 },
  uMaxCoc: { value: 0.02 },
});

export type Shared = ReturnType<typeof makeShared>;

export const GLSL_COMMON = /* glsl */ `
uniform vec2 uResolution;
uniform float uTime;
uniform float uFrame;
uniform float uFocus;
uniform float uFocusRange;
uniform float uAperture;
uniform float uNearMul;
uniform float uMaxCoc;

float cocPx(float d) {
  float x = max(abs(d - uFocus) - uFocusRange, 0.0) / max(d, 1e-3);
  x *= d < uFocus ? uNearMul : 1.0;
  return min(x * uAperture, uMaxCoc) * uResolution.y;
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;
