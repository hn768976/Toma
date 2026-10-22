import { DURATION_IN_FRAMES } from "./constants";

// Camera paths measured from the reference with frame-to-frame tracking,
// then fitted with cubics in normalised time t = frame / (duration - 1).
// Coefficients are t^3..t^0.
//
// The reference is a 2.5D move: the star field (tracked with sparse optical
// flow on point features) pushes in faster than the nebula and its clouds
// (tracked with ECC on a star-free, median-filtered image). Each layer gets
// its own path so the parallax matches.
//   logScale: ln(zoom)
//   rotDeg:   image rotation in degrees (y-down image space)
//   qx, qy:   world point at the centre of the screen, in units of the
//             frame height, y pointing down
type Path = {
  logScale: number[];
  rotDeg: number[];
  qx: number[];
  qy: number[];
};

// Nebula + clouds: 1.0x -> ~1.60x, 0 -> ~-11.0 deg.
const NEBULA_PATH: Path = {
  logScale: [-0.112, 0.23155, 0.35224, 0],
  rotDeg: [-9.43233, 16.3931, -18.22179, 0],
  qx: [0.05461, -0.29074, 0.21041, 0],
  qy: [-0.03353, 0.25744, -0.25297, 0],
};

// Star field: 1.0x -> ~1.93x, 0 -> ~-15.7 deg.
const STAR_PATH: Path = {
  logScale: [-0.13821, 0.20702, 0.58702, 0],
  rotDeg: [0.77635, -3.90002, -12.77712, 0],
  qx: [0.08621, -0.31558, 0.20284, 0],
  qy: [-0.10902, 0.36499, -0.28417, 0],
};

const cubic = (c: number[], t: number) =>
  ((c[0] * t + c[1]) * t + c[2]) * t + c[3];

export type CameraState = {
  zoom: number;
  rotationRad: number;
  centerX: number;
  centerY: number;
};

const evaluate = (path: Path, frame: number): CameraState => {
  const t = Math.min(1, Math.max(0, frame / (DURATION_IN_FRAMES - 1)));
  return {
    zoom: Math.exp(cubic(path.logScale, t)),
    rotationRad: (cubic(path.rotDeg, t) * Math.PI) / 180,
    centerX: cubic(path.qx, t),
    centerY: cubic(path.qy, t),
  };
};

export const getNebulaCamera = (frame: number) => evaluate(NEBULA_PATH, frame);
export const getStarCamera = (frame: number) => evaluate(STAR_PATH, frame);

// Screen -> world: world = center + (1 / zoom) * R(-rotation) * screen.
// Returned column-major for a GLSL mat2.
export const screenToWorldMatrix = (cam: CameraState): Float32Array => {
  const c = Math.cos(cam.rotationRad) / cam.zoom;
  const s = Math.sin(cam.rotationRad) / cam.zoom;
  return new Float32Array([c, -s, s, c]);
};
