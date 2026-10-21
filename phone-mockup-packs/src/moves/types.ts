import { BackgroundId } from "../data";
import { DEG, float, Vec3 } from "../anim";

export type PhoneState = {
  pos: Vec3;
  rot: Vec3; // Euler XYZ, radians. rot[1] = PI shows the back.
  scale?: number;
};

export type CameraState = {
  pos: Vec3;
  target: Vec3;
  fov: number;
};

export type Shot = {
  camera: CameraState;
  phones: PhoneState[];
};

// Studio framing per background: vertical FOV, camera distance, and the
// resulting half-extents of the frame at z = 0 (in phone units: 1.6 = phone height).
export type Stage = {
  fov: number;
  dist: number;
  hh: number;
  hw: number;
};

export type MoveCtx = {
  f: number; // frame within the segment
  L: number; // segment length
  g: number; // global frame in the pack
  n: number; // phone count from packs.json
  params: Record<string, number>;
  stage: Stage;
};

export type Move = (ctx: MoveCtx) => Shot;

const makeStage = (fov: number, dist: number): Stage => {
  const hh = dist * Math.tan((fov * DEG) / 2);
  return { fov, dist, hh, hw: (hh * 16) / 9 };
};

export const STAGES: Record<BackgroundId, Stage> = {
  // Long lens, near-orthographic like a flat product board.
  white: makeStage(16, 7.3),
  black: makeStage(28, 3.77),
  graphite: makeStage(32, 3.45),
  green: makeStage(28, 3.85),
};

export const defaultCamera = (stage: Stage): CameraState => ({
  pos: [0, 0, stage.dist],
  target: [0, 0, 0],
  fov: stage.fov,
});

// Off-screen distances that account for perspective at depth z.
export const offX = (stage: Stage, z = 0, margin = 0.75) =>
  (stage.hw + margin) * ((stage.dist - z) / stage.dist);
export const offY = (stage: Stage, z = 0, margin = 1.0) =>
  (stage.hh + margin) * ((stage.dist - z) / stage.dist);

// Adds the gentle hold float to a phone.
export const floating = (
  ctx: MoveCtx,
  pos: Vec3,
  rot: Vec3,
  seed: number,
  weight = 1,
  scale?: number,
): PhoneState => {
  const fl = float(ctx.g, seed, ctx.stage.hh * 2);
  return {
    pos: [pos[0], pos[1] + fl.y * weight, pos[2]],
    rot: [rot[0] + fl.rx * weight, rot[1], rot[2] + fl.rz * weight],
    scale,
  };
};
