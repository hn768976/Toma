import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CAM_PITCH_DEG,
  CAM_VFOV_DEG,
  CAM_Y,
} from "./constants";

/**
 * A fixed, low perspective camera looking across the surface at a shallow
 * angle. The same numbers drive the three.js PerspectiveCamera and the CPU-side
 * projection used for culling, depth fade and pixel-accurate line widths, so
 * the two can never drift apart.
 */
export type Camera = {
  px: number;
  py: number;
  pz: number;
  /** Forward, right and up basis vectors. */
  fx: number;
  fy: number;
  fz: number;
  ux: number;
  uy: number;
  uz: number;
  tanHalfV: number;
  tanHalfH: number;
  fovDeg: number;
  pitchDeg: number;
};

export const CAMERA: Camera = (() => {
  const pitch = (CAM_PITCH_DEG * Math.PI) / 180;
  const tanHalfV = Math.tan((CAM_VFOV_DEG * Math.PI) / 360);
  return {
    px: 0,
    py: CAM_Y,
    pz: 0,
    // Looking toward -Z and down by `pitch`.
    fx: 0,
    fy: -Math.sin(pitch),
    fz: -Math.cos(pitch),
    // Right is (1, 0, 0), so up is forward rotated a quarter turn.
    ux: 0,
    uy: Math.cos(pitch),
    uz: -Math.sin(pitch),
    tanHalfV,
    tanHalfH: (tanHalfV * BASE_WIDTH) / BASE_HEIGHT,
    fovDeg: CAM_VFOV_DEG,
    pitchDeg: CAM_PITCH_DEG,
  };
})();
