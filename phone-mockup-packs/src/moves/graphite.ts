import {
  DEG,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutSettle,
  glide,
  lerp,
  lerp3,
  progress,
  travel,
  Vec3,
} from "../anim";
import { CameraState, defaultCamera, floating, Move, MoveCtx, offX, offY, PhoneState, Shot } from "./types";

const spinReveal: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage);
  const pos = travel(f, L, [0, -oy, 0], [0, 0, 0], [0, -oy, 0], { enter: 40, exit: 28 });
  // Edge-on -> front, front -> back, back -> front.
  const yaw =
    lerp(-80 * DEG, 0, easeOutSettle(progress(f, 0, 44))) +
    Math.PI * easeInOutCubic(progress(f, 62, 52)) +
    Math.PI * easeInOutCubic(progress(f, 136, 52));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 1)] };
};

const tiltIn: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const inP = easeOutSettle(progress(f, 0, 48));
  const outP = easeInCubic(progress(f, L - 32, 30));
  const start: Vec3 = [offX(stage) + 0.3, 1.1, -0.4];
  const mid: Vec3 = [-0.15, 0, 0];
  const end: Vec3 = [-offX(stage) - 0.6, -0.6, -0.2];
  const pos = lerp3(lerp3(start, mid, inP), end, outP);
  const rot: Vec3 = [
    lerp(-62 * DEG, 0, inP) + lerp(0, 25 * DEG, outP),
    lerp(58 * DEG, 0, inP) + lerp(0, -50 * DEG, outP),
    lerp(28 * DEG, 0, inP) + lerp(0, 22 * DEG, outP),
  ];
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, rot, 2)] };
};

const diagonalFall: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const t = glide(progress(f, 0, L - 1));
  const start: Vec3 = [-offX(stage, 0, 0.35), offY(stage, 0, 0.75), 0.1];
  const end: Vec3 = [offX(stage, 0, 0.35), -offY(stage, 0, 0.75), -0.2];
  const pos = lerp3(start, end, t);
  const rot: Vec3 = [lerp(-18 * DEG, 12 * DEG, t), lerp(-40 * DEG, 45 * DEG, t), lerp(-42 * DEG, 24 * DEG, t)];
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, rot, 3, 0.5)] };
};

const floatingPair: Move = (ctx) => {
  const { f, L, stage } = ctx;
  // A tight overlapping cluster in the right half; the back phone sits higher.
  const a: Vec3 = [0.34, 0.0, 0.1];
  const b: Vec3 = [1.08, 0.24, -0.75];
  const pa = travel(f, L, [-offX(stage, a[2]) - 0.2, a[1] - 0.3, a[2]], a, [-offX(stage, a[2]) - 0.4, a[1] + 0.2, a[2]], { enter: 44, exit: 30 }, [0.06, 0.05, 0]);
  const pb = travel(f, L, [offX(stage, b[2]) + 0.4, b[1] + 0.3, b[2]], b, [offX(stage, b[2]) + 0.6, b[1] - 0.2, b[2]], { enter: 44, exit: 30, delay: 8, exitDelay: 4 }, [-0.05, -0.04, 0]);
  return {
    camera: defaultCamera(stage),
    phones: [floating(ctx, pa, [0, -28 * DEG, -6 * DEG], 1), floating(ctx, pb, [0, -30 * DEG, -5 * DEG], 2)],
  };
};

// Three phones pivot around a shared point below them, like a hand of cards.
const fanOfThree: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage, 0, 1.2);
  const pivotBase: Vec3 = [0.0, -0.78, 0];
  const pivot = travel(f, L, [pivotBase[0], pivotBase[1] - oy, 0], pivotBase, [pivotBase[0], pivotBase[1] - oy, 0], { enter: 40, exit: 30 });
  const fanOpen = easeOutSettle(progress(f, 46, 40));
  const fanClose = easeInOutSine(progress(f, L - 80, 40));
  const spread = fanOpen - fanClose;
  const phones: PhoneState[] = [-1, 0, 1].map((k, i) => {
    const roll = -k * 26 * DEG * spread;
    const arm = 0.7; // pivot sits near the bottom of each phone
    const x = pivot[0] - Math.sin(roll) * arm;
    const y = pivot[1] + Math.cos(roll) * arm;
    const z = k * 0.11;
    return floating(ctx, [x, y, z], [0, -k * 10 * DEG * spread, roll], i + 1, 0.5);
  });
  return { camera: defaultCamera(stage), phones };
};

const closeUpPan: Move = (ctx) => {
  const { f, L } = ctx;
  const t = glide(progress(f, 0, L - 1));
  const camera: CameraState = {
    pos: lerp3([-1.15, 0.95, 1.3], [0.85, 0.72, 1.15], t),
    target: lerp3([-0.95, 0.82, 0], [0.92, 0.76, 0], t),
    fov: 30,
  };
  const phone = floating(ctx, [0, 0.05, 0], [8 * DEG, -24 * DEG, 0], 4, 0.6);
  return { camera, phones: [phone] };
};

const pairFloat: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const a: Vec3 = [-0.52, 0.02, 0];
  const b: Vec3 = [0.6, -0.04, -0.55];
  const pa = travel(f, L, [a[0] - 0.6, -offY(stage), a[2]], a, [a[0] - 0.4, offY(stage), a[2]], { enter: 42, exit: 28 }, [0.08, 0.04, 0]);
  const pb = travel(f, L, [b[0] + 0.6, offY(stage, b[2]), b[2]], b, [b[0] + 0.4, -offY(stage, b[2]), b[2]], { enter: 42, exit: 28, delay: 6, exitDelay: 6 }, [-0.07, -0.03, 0]);
  const yawB = lerp(-30 * DEG, 150 * DEG, easeInOutSine(progress(f, 20, L - 30)));
  return {
    camera: defaultCamera(stage),
    phones: [floating(ctx, pa, [0, 12 * DEG, 5 * DEG], 1), floating(ctx, pb, [0, yawB, -4 * DEG], 2)],
  };
};

// The camera pushes into the screen until #00FF00 fills the frame. The final
// 30 frames hold the camera inside the screen's bounds (fully green).
export const pushIntoScreen = (ctx: MoveCtx): Shot => {
  const { f, L, stage } = ctx;
  const oy = offY(stage);
  const pos = travel(f, L, [0, -oy, 0], [0, 0, 0], null, { enter: 40 });
  const pushStart = 64;
  const pushEnd = L - 34;
  const push = easeInOutCubic(progress(f, pushStart, pushEnd - pushStart));
  // Fade the float out during the push so the last frames are rock steady.
  const w = 1 - easeInOutSine(progress(f, pushStart, pushEnd - pushStart));
  const phone = floating(ctx, pos, [0, 0, 0], 7, w);
  const finalZ = 0.16;
  const camera: CameraState = {
    pos: [0, lerp(0, -0.12, push), lerp(stage.dist, finalZ, push)],
    target: [0, lerp(0, -0.12, push), 0],
    fov: stage.fov,
  };
  return { camera, phones: [phone] };
};

export const GRAPHITE_MOVES: Record<string, Move> = {
  spinReveal,
  tiltIn,
  diagonalFall,
  floatingPair,
  fanOfThree,
  closeUpPan,
  pairFloat,
  pushIntoScreen,
};
