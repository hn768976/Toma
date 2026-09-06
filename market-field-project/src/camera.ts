import { CAMERA } from "./config";

/**
 * The camera.
 *
 * A real dolly, not a zoom: the scene is a repeating lattice of planes one
 * `cellDepth` apart, and the camera advances exactly one cell over the
 * composition. Plane i therefore ends the loop at the depth plane i-1 held
 * at the start, so frame 600 is frame 0 again — while, because depth enters
 * the projection as 1/d, planes at different depths still grow at different
 * rates. That difference is the parallax: the near chart swells and flies
 * past while the map, further back, creeps.
 *
 * `v` is depth in cell units, measured from the near plane. It decreases by
 * exactly 1 over the loop, which is what lets the fade window below be a
 * partition of unity: the visible planes' opacities always sum to 1, so
 * nothing pulses as they hand over.
 */

export type Plane = {
  /** Screen scale factor, applied about the vanishing point. */
  scale: number;
  opacity: number;
  /** Depth in cell units — larger is further away. */
  v: number;
  /** Defocus for this plane, as a fraction of frame width on screen. */
  dof: number;
};

/** Raised cosine over (center-1, center+1). Sums to 1 over integer shifts. */
const fadeWindow = (v: number) => {
  const d = v - CAMERA.windowCenter;
  if (d <= -1 || d >= 1) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * d));
};

/**
 * Defocus either side of the focal plane, hard in front and soft behind — a
 * plane sweeping past the lens blows out into a soft mass, while the one
 * fading in behind is only gently softened.
 */
const defocusAt = (v: number) => {
  const near = (CAMERA.focusDepth - v) / CAMERA.dofFalloff;
  if (near > 0) {
    return CAMERA.dofMaxBlur * Math.pow(Math.min(near, 1), CAMERA.dofNearExponent);
  }
  const far = (v - CAMERA.focusDepth) / CAMERA.dofFarFalloff;
  return CAMERA.dofFarBlur * Math.pow(Math.min(far, 1), CAMERA.dofFarExponent);
};

/** Perspective: scale is focal / depth, normalised to 1 at v = refV. */
export const scaleAtDepth = (v: number) =>
  (CAMERA.nearDepth + CAMERA.refV) / (CAMERA.nearDepth + v);

/**
 * The visible planes of one lattice, far to near (painter's order).
 *
 * `depthOffset` shifts a lattice further back in cell units — the map uses
 * it to sit behind the charts, which is what makes it grow more slowly.
 */
export const planesAt = (p: number, depthOffset = 0): Plane[] => {
  const planes: Plane[] = [];
  for (let i = -2; i <= CAMERA.cells; i++) {
    const v = i + 1 - p + depthOffset;
    const opacity = fadeWindow(v);
    if (opacity <= 0.001) continue;
    planes.push({ scale: scaleAtDepth(v), opacity, v, dof: defocusAt(v) });
  }
  return planes.sort((a, b) => b.v - a.v);
};

/** SVG transform that scales a full-frame layer about the vanishing point. */
export const planeTransform = (scale: number, width: number, height: number) => {
  const vx = width * CAMERA.vanishX;
  const vy = height * CAMERA.vanishY;
  return `translate(${vx.toFixed(2)} ${vy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${(-vx).toFixed(2)} ${(-vy).toFixed(2)})`;
};
