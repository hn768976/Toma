import * as THREE from "three";

/**
 * Shared GLSL for the "periodic world" looks (Circuit Horizon, AI Brain Chip).
 * A layout tile of length P is repeated K times along -z. The world slides
 * toward the camera by exactly P per loop, so frame 600 lays out exactly like
 * frame 0. Instances wrap behind the camera (out of view) and reappear at the
 * far end, where fog hides them completely.
 */
export const PERIODIC_GLSL = /* glsl */ `
uniform float uShift;    // 0..P, slides the world toward the camera
uniform float uWrap;     // K * P
uniform float uBehind;   // how far behind the camera an instance wraps
// zLocal in [0, K*P): distance ahead along the strip at shift 0.
float wrapZ(float zLocal) {
  float d = mod(zLocal - uShift, uWrap);
  return uBehind - d;
}
`;

/** Signed circle of confusion as a fraction of frame height (negative = near). */
export const COC_GLSL = /* glsl */ `
uniform float uFocus;    // focus distance (view-space units)
uniform float uCocK;     // CoC at infinity, fraction of frame height
uniform float uCocMax;
float cocOf(float viewDepth) {
  return clamp(uCocK * (1.0 - uFocus / max(viewDepth, 1e-3)), -uCocMax, uCocMax);
}
`;

export interface PeriodicUniforms {
  uShift: THREE.IUniform<number>;
  uWrap: THREE.IUniform<number>;
  uBehind: THREE.IUniform<number>;
  uFocus: THREE.IUniform<number>;
  uCocK: THREE.IUniform<number>;
  uCocMax: THREE.IUniform<number>;
}

export const periodicUniforms = (wrap: number, behind: number, focus: number, cocK: number, cocMax: number): PeriodicUniforms => ({
  uShift: { value: 0 },
  uWrap: { value: wrap },
  uBehind: { value: behind },
  uFocus: { value: focus },
  uCocK: { value: cocK },
  uCocMax: { value: cocMax },
});
