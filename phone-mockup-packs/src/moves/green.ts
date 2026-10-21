import {
  DEG,
  easeInCubic,
  easeInOutSine,
  easeOutSettle,
  lerp,
  lerp3,
  progress,
  travel,
  Vec3,
} from "../anim";
import { CameraState, defaultCamera, floating, Move, MoveCtx, offX, offY, PhoneState } from "./types";
import { pushIntoScreen } from "./graphite";

// ---------- Pack 4: one continuous trio take, match-cut between segments ----------

type TrioSlot = { pos: Vec3; yaw: number };
const TRIO_ROW: TrioSlot[] = [
  { pos: [-1.2, 0, -0.35], yaw: -48 * DEG }, // side (not edge-on, so the bezel stays visible for keying)
  { pos: [0, 0, 0.12], yaw: 0 }, // front
  { pos: [1.2, 0, -0.35], yaw: 160 * DEG }, // back
];
const TRIO_STACK: Vec3[] = [
  [-0.1, 0, -0.25],
  [0, 0, 0.12],
  [0.1, 0, -0.5],
];

const trioPhones = (ctx: MoveCtx, xSpread: number, yawAdd: number, rise = 1): PhoneState[] =>
  TRIO_ROW.map((s, i) => {
    const pos = lerp3(TRIO_STACK[i], s.pos, xSpread);
    const pos2: Vec3 = [pos[0], pos[1] - (1 - rise) * offY(ctx.stage, pos[2], 1.1), pos[2]];
    return floating(ctx, pos2, [0, s.yaw + yawAdd * (i === 1 ? 1 : 0.8), 0], i + 1, 0.8);
  });

const trioSpread: Move = (ctx) => {
  const { f, stage } = ctx;
  const rise = easeOutSettle(progress(f, 0, 38));
  const spread = easeOutSettle(progress(f, 44, 52));
  return { camera: defaultCamera(stage), phones: trioPhones(ctx, spread, 0, rise) };
};

const trioTurn: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const t = progress(f, 20, L - 40);
  // 0 -> +30 -> 0 degrees, eased at every turn.
  const yaw = 30 * DEG * Math.sin(Math.PI * easeInOutSine(t));
  return { camera: defaultCamera(stage), phones: trioPhones(ctx, 1, yaw) };
};

const trioClose: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const t = easeInOutSine(progress(f, 0, L));
  const phones = trioPhones(ctx, 1 + 0.26 * t, 0);
  const camera: CameraState = {
    pos: [0, 0, lerp(stage.dist, stage.dist * 0.8, t)],
    target: [0, 0, 0],
    fov: stage.fov,
  };
  return { camera, phones };
};

// ---------- Pack 5 ----------

const dropIn: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const pos = travel(f, L, [0, offY(stage, 0, 1.2), 0], [0, 0, 0], null, { enter: 34 });
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, 0, 0], 1)] };
};

const floatTurn: Move = (ctx) => {
  const { f, L, stage } = ctx;
  // Continues from dropIn's resting phone, then leaves to the right.
  const pos = travel(f, L, [0, 0, 0], [0, 0, 0], [offX(stage, 0, 0.9), 0, 0], { enter: 1, exit: 28 });
  const t = progress(f, 6, L - 50);
  const yaw = -20 * DEG * Math.sin(2 * Math.PI * easeInOutSine(t));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 1)] };
};

const frontAndBack: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const back: Vec3 = [-0.36, 0.1, -0.5];
  const front: Vec3 = [0.24, -0.06, 0];
  const pb = travel(f, L, [-offX(stage, back[2]), back[1], back[2]], back, [-offX(stage, back[2]), back[1], back[2]], { enter: 40, exit: 28, exitDelay: 5 });
  const pf = travel(f, L, [offX(stage), front[1], 0], front, [offX(stage), front[1], 0], { enter: 40, exit: 28, delay: 6 });
  return {
    camera: defaultCamera(stage),
    phones: [floating(ctx, pb, [0, 196 * DEG, 3 * DEG], 2), floating(ctx, pf, [0, -12 * DEG, -2 * DEG], 3)],
  };
};

const pairLean: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage, 0, 1.2);
  const lean = easeOutSettle(progress(f, 30, 44)) * (1 - easeInOutSine(progress(f, L - 60, 30)));
  const phones = [-1, 1].map((s, i) => {
    const base: Vec3 = [s * 0.44, 0, -0.1 * i];
    const pos = travel(f, L, [base[0], -oy, base[2]], base, [base[0], oy, base[2]], { enter: 40, exit: 28, delay: i * 5, exitDelay: (1 - i) * 5 });
    const roll = -s * lerp(2, 11, lean) * DEG;
    const x = pos[0] - s * 0.06 * lean;
    return floating(ctx, [x, pos[1], pos[2]], [0, -s * 16 * DEG, roll], i + 4);
  });
  return { camera: defaultCamera(stage), phones };
};

const closeCrop: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const camera: CameraState = { pos: [0, 0.42, 1.95], target: [0, 0.42, 0], fov: stage.fov };
  const oy = 2.4;
  const pos = travel(f, L, [0, -oy, 0], [0, 0, 0], [0, oy + 0.6, 0], { enter: 44, exit: 30 }, [0, 0.03, 0]);
  return { camera, phones: [floating(ctx, pos, [0, -10 * DEG, 0], 5)] };
};

const diagonalPair: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const a: Vec3 = [-0.46, 0.02, 0];
  const b: Vec3 = [0.46, -0.02, -0.05];
  const d: Vec3 = [offX(stage, 0, 0.6), offY(stage, 0, 0.6), 0];
  const pa = travel(f, L, [a[0] - d[0], a[1] - d[1], a[2]], a, [a[0] + d[0], a[1] + d[1], a[2]], { enter: 42, exit: 28, exitDelay: 5 });
  const pb = travel(f, L, [b[0] + d[0], b[1] + d[1], b[2]], b, [b[0] - d[0], b[1] - d[1], b[2]], { enter: 42, exit: 28, delay: 6 });
  return {
    camera: defaultCamera(stage),
    phones: [floating(ctx, pa, [0, 10 * DEG, 0], 6), floating(ctx, pb, [0, -10 * DEG, 0], 7)],
  };
};

const tumbleLand: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const inP = easeOutSettle(progress(f, 0, 56));
  const outP = easeInCubic(progress(f, L - 30, 28));
  const start: Vec3 = [0.9, offY(stage, 0, 1.6), -0.3];
  const mid: Vec3 = [0, 0, 0];
  const end: Vec3 = [-offX(stage, 0, 0.9), 0, 0];
  const pos = lerp3(lerp3(start, mid, inP), end, outP);
  const rot: Vec3 = [lerp(-1.5 * Math.PI, 0, inP), lerp(0.4, 0, inP), lerp(0.9, 0, inP)];
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, rot, 8)] };
};

const backReveal: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const pos = travel(f, L, [offX(stage), 0, 0], [0, 0, 0], [0, -offY(stage), 0], { enter: 40, exit: 28 });
  const yaw = Math.PI * easeInOutSine(progress(f, 48, 40)) + Math.PI * easeInOutSine(progress(f, 112, 40));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 9)] };
};

export const GREEN_MOVES: Record<string, Move> = {
  trioSpread,
  trioTurn,
  trioClose,
  dropIn,
  floatTurn,
  frontAndBack,
  pairLean,
  closeCrop,
  diagonalPair,
  tumbleLand,
  backReveal,
  pushIntoScreen,
};
