import { Vector3 } from "three";

/**
 * The camera is a pure function of time: a constant-speed lateral traverse
 * across the plane with a very slight descent. It never returns, and there is
 * no orbit — the surface detail simply reprojects as the camera passes it.
 */
export const CAMERA = {
  fov: 38,
  near: 0.5,
  far: 900,
  startX: -13,
  startY: 60,
  z: 100,
  /** World units per second. */
  driftRate: 1.3,
  descentRate: 0.225,
  targetZ: -60,
} as const;

export type CameraState = {
  pos: Vector3;
  target: Vector3;
  dir: Vector3;
  right: Vector3;
  up: Vector3;
  tanHalfFov: number;
};

const WORLD_UP = new Vector3(0, 1, 0);

export const cameraState = (time: number): CameraState => {
  const x = CAMERA.startX + CAMERA.driftRate * time;
  const y = CAMERA.startY - CAMERA.descentRate * time;
  const pos = new Vector3(x, y, CAMERA.z);
  const target = new Vector3(x, 0, CAMERA.targetZ);
  const dir = target.clone().sub(pos).normalize();
  const right = dir.clone().cross(WORLD_UP).normalize();
  const up = right.clone().cross(dir).normalize();
  return {
    pos,
    target,
    dir,
    right,
    up,
    tanHalfFov: Math.tan((CAMERA.fov * Math.PI) / 360),
  };
};

/**
 * Place a point relative to the frame: `rightFrac` and `upFrac` are fractions
 * of the half-frame at distance `depth`, so framing survives any output size.
 */
export const placeInFrame = (
  state: CameraState,
  depth: number,
  rightFrac: number,
  upFrac: number,
  aspect: number,
): Vector3 => {
  const halfH = depth * state.tanHalfFov;
  const halfW = halfH * aspect;
  return state.pos
    .clone()
    .addScaledVector(state.dir, depth)
    .addScaledVector(state.right, rightFrac * halfW)
    .addScaledVector(state.up, upFrac * halfH);
};

/** Half the frame height, in world units, at a given distance. */
export const halfHeightAt = (state: CameraState, depth: number) =>
  depth * state.tanHalfFov;

/**
 * Project a world point to normalised screen coordinates (0..1, y down).
 * Used to sit the DOM bloom layers exactly over what they are blooming.
 */
export const projectToScreen = (
  world: Vector3,
  state: CameraState,
  aspect: number,
) => {
  const rel = world.clone().sub(state.pos);
  const z = rel.dot(state.dir);
  if (z <= 1e-4) return { x: 0.5, y: 0.5, scale: 0 };
  const ndcX = rel.dot(state.right) / z / (state.tanHalfFov * aspect);
  const ndcY = rel.dot(state.up) / z / state.tanHalfFov;
  return {
    x: (ndcX + 1) / 2,
    y: (1 - ndcY) / 2,
    /** Fraction of frame height that one world unit covers at this depth. */
    scale: 1 / (2 * z * state.tanHalfFov),
  };
};
