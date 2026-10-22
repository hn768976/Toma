import { DURATION_IN_FRAMES } from "./constants";

// Camera path measured from the reference, as cubics in normalised time
// t = frame / (duration - 1). Coefficients are t^3..t^0.
//   logScale, rotDeg: from ECC registration of star-free (median-filtered)
//     frames in 100-frame steps, cross-checked with SIFT matches on stars.
//     Stars and nebula move together (no parallax): 1.0x -> ~1.56x,
//     0 -> ~-11.4 deg (image space, y down).
//   qx, qy: world point at the centre of the screen (frame-height units,
//     y down), solved per frame so the core lands where the reference's
//     magenta core centroid is.
type Path = {
  logScale: number[];
  rotDeg: number[];
  qx: number[];
  qy: number[];
};

const PATH: Path = {
  logScale: [0.07166, -0.06379, 0.43448, 0],
  rotDeg: [-3.14587, 3.0493, -11.34189, 0],
  qx: [0.04492, -0.29697, 0.22847, 0.00441],
  qy: [0.05052, 0.15014, -0.2528, -0.01939],
};

const cubic = (c: number[], t: number) =>
  ((c[0] * t + c[1]) * t + c[2]) * t + c[3];

export type CameraState = {
  zoom: number;
  rotationRad: number;
  centerX: number;
  centerY: number;
};

export const getCamera = (frame: number): CameraState => {
  const path = PATH;
  const t = Math.min(1, Math.max(0, frame / (DURATION_IN_FRAMES - 1)));
  return {
    zoom: Math.exp(cubic(path.logScale, t)),
    rotationRad: (cubic(path.rotDeg, t) * Math.PI) / 180,
    centerX: cubic(path.qx, t),
    centerY: cubic(path.qy, t),
  };
};

// Screen -> world: world = center + (1 / zoom) * R(-rotation) * screen.
// Returned column-major for a GLSL mat2.
export const screenToWorldMatrix = (cam: CameraState): Float32Array => {
  const c = Math.cos(cam.rotationRad) / cam.zoom;
  const s = Math.sin(cam.rotationRad) / cam.zoom;
  return new Float32Array([c, -s, s, c]);
};
