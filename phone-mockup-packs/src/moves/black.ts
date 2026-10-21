import {
  DEG,
  easeInCubic,
  easeInOutSine,
  easeOutSettle,
  lerp,
  progress,
  thereAndBack,
  travel,
  Vec3,
} from "../anim";
import { defaultCamera, floating, Move, offX, offY, PhoneState } from "./types";

const threeViews: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage);
  const ox = offX(stage, 0, 0.9);
  const slots: { x: number; yaw: number; exitTo: Vec3 }[] = [
    { x: -1.02, yaw: 8 * DEG, exitTo: [-1.02 - ox, 0, 0] },
    { x: 0, yaw: -78 * DEG, exitTo: [0, -oy, 0] },
    { x: 1.02, yaw: 172 * DEG, exitTo: [1.02 + ox, 0, 0] },
  ];
  const phones = slots.map((s, i) => {
    const pos = travel(f, L, [s.x, -oy, 0], [s.x, 0, 0], s.exitTo, { enter: 38, exit: 30, delay: i * 6 }, [0, 0.02, 0]);
    return floating(ctx, pos, [0, s.yaw, 0], i + 1);
  });
  return { camera: defaultCamera(stage), phones };
};

const centreHold: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage);
  const pos = travel(f, L, [0.35, -oy, 0], [0, 0, 0], [0, oy, 0], { enter: 42, exit: 28 });
  const yaw = lerp(-55 * DEG, 0, easeOutSettle(progress(f, 0, 50)));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 2)] };
};

const slideRight: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const ox = offX(stage);
  const x = stage.hw * 0.48;
  const pos = travel(f, L, [-ox, 0, 0], [x, 0, 0], [ox + 0.4, 0, 0], { enter: 46, exit: 28 }, [0.04, 0, 0]);
  const yaw = lerp(-14 * DEG, -6 * DEG, easeOutSettle(progress(f, 0, 50)));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 3)] };
};

const PAIR_FRONT: Vec3 = [0.12, -0.04, 0];
const PAIR_BACK: Vec3 = [0.6, 0.16, -0.62];

const pairOverlap: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const ox = offX(stage, 0, 0.8);
  const front = travel(f, L, [-ox, -0.04, 0], PAIR_FRONT, [PAIR_FRONT[0], -offY(stage), 0], { enter: 40, exit: 28, exitDelay: 4 });
  const back = travel(
    f,
    L,
    [offX(stage, PAIR_BACK[2]) + 0.4, PAIR_BACK[1], PAIR_BACK[2]],
    PAIR_BACK,
    [PAIR_BACK[0], -offY(stage, PAIR_BACK[2]), PAIR_BACK[2]],
    { enter: 40, exit: 28, delay: 34 },
  );
  return {
    camera: defaultCamera(stage),
    phones: [floating(ctx, front, [0, -8 * DEG, 0], 1), floating(ctx, back, [0, -8 * DEG, 0], 2)],
  };
};

const pairSwap: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage, -0.6, 1.1);
  const enterOff: Vec3 = [0, -oy, 0];
  const exitOff: Vec3 = [0, oy, 0];
  const t = easeInOutSine(progress(f, 62, 70));
  const bump = thereAndBack(progress(f, 62, 70));
  // A (front) eases back and left; B (back) swings out right and comes forward.
  const aBase: Vec3 = [lerp(PAIR_FRONT[0], PAIR_BACK[0] - 0.9, t) - bump * 0.35, lerp(PAIR_FRONT[1], PAIR_BACK[1], t), lerp(PAIR_FRONT[2], PAIR_BACK[2], t)];
  const bBase: Vec3 = [lerp(PAIR_BACK[0], PAIR_FRONT[0] + 0.2, t) + bump * 0.75, lerp(PAIR_BACK[1], PAIR_FRONT[1], t), lerp(PAIR_BACK[2], PAIR_FRONT[2], t) + bump * 0.25];
  const enterP = easeOutSettle(progress(f, 0, 40));
  const exitP = easeInCubic(progress(f, L - 30, 28));
  const offset = (base: Vec3, k: number): Vec3 => [
    base[0] + enterOff[0] * (1 - enterP) + exitOff[0] * exitP,
    base[1] + enterOff[1] * (1 - easeOutSettle(progress(f, k, 40))) + exitOff[1] * easeInCubic(progress(f, L - 30 - k, 28)),
    base[2],
  ];
  const yaw = -8 * DEG + bump * 14 * DEG;
  return {
    camera: defaultCamera(stage),
    phones: [floating(ctx, offset(aBase, 0), [0, yaw, 0], 1), floating(ctx, offset(bBase, 5), [0, -yaw, 0], 2)],
  };
};

// Brick wall: three staggered columns of phones sliding up through the frame.
const brickWall: Move = (ctx) => {
  const { f, L, n, stage } = ctx;
  const cols = 3;
  const rows = Math.ceil(n / cols);
  const pitchX = 0.86;
  const pitchY = 1.78;
  const z = -0.15;
  const span = rows * pitchY;
  const oy = offY(stage, z, 0.3);
  // Wall enters from below, settles (with overshoot), drifts, and exits up.
  const startY = -oy - span / 2;
  const endY = oy + span / 2;
  const holdY = -0.1;
  const y = travel(f, L, [0, startY, 0], [0, holdY, 0], [0, endY, 0], { enter: 52, exit: 40 }, [0, 0.35, 0])[1];
  const phones: PhoneState[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - 1) * pitchX;
    const stagger = c === 1 ? pitchY / 2 : 0;
    const py = (r - (rows - 1) / 2) * pitchY + stagger - pitchY / 4;
    phones.push(floating(ctx, [x, py + y, z], [0, 0, 0], i, 0.4));
  }
  return { camera: defaultCamera(stage), phones };
};

// Rows of phones lying at 35 degrees, rows scrolling diagonally.
const tiltedGrid: Move = (ctx) => {
  const { f, L, n, stage } = ctx;
  const angle = 35 * DEG;
  const cols = 5;
  const rows = Math.ceil(n / cols);
  const u: Vec3 = [Math.cos(angle), Math.sin(angle), 0]; // along a row (phone's width axis)
  const v: Vec3 = [-Math.sin(angle), Math.cos(angle), 0]; // across rows (phone's height axis)
  const pitchU = 0.86;
  const pitchV = 1.76;
  const z = -0.9;
  // The whole lattice slides in along the diagonal, drifts, and leaves.
  const far = 7.0;
  const k = travel(f, L, [far, 0, 0], [0, 0, 0], [-far, 0, 0], { enter: 50, exit: 40 }, [-0.6, 0, 0])[0];
  const phones: PhoneState[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // Alternate rows scroll against each other.
    const rowScroll = (r % 2 === 0 ? 1 : -1) * 0.35 * easeInOutSine(progress(f, 0, L));
    const a = (c - (cols - 1) / 2) * pitchU + (r % 2) * pitchU * 0.5 + rowScroll;
    const b = (r - (rows - 1) / 2) * pitchV;
    // k > 0 is off to the bottom right, k < 0 off to the top left.
    const x = u[0] * a + v[0] * b + 0.85 * k;
    const y = u[1] * a + v[1] * b - 0.53 * k;
    phones.push(floating(ctx, [x + 0.7, y - 0.2, z], [0, 0, angle], i, 0.3));
  }
  return { camera: defaultCamera(stage), phones };
};

const lineupFive: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const slots = [
    { x: -1.62, z: -1.25, yaw: 26 * DEG, order: 2 },
    { x: -0.88, z: -0.52, yaw: 12 * DEG, order: 1 },
    { x: 0, z: 0, yaw: 0, order: 0 },
    { x: 0.88, z: -0.52, yaw: -12 * DEG, order: 1 },
    { x: 1.62, z: -1.25, yaw: -26 * DEG, order: 2 },
  ];
  const phones = slots.map((s, i) => {
    const oy = offY(stage, s.z, 1.1);
    const pos = travel(f, L, [s.x, -oy, s.z], [s.x, 0, s.z], [s.x, -oy, s.z], { enter: 40, exit: 28, delay: s.order * 5, exitDelay: (2 - s.order) * 5 });
    return floating(ctx, pos, [0, s.yaw, 0], i, 0.7);
  });
  return { camera: defaultCamera(stage), phones };
};

const closeFloat: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const z = 0.55;
  const ox = offX(stage, z, 0.9);
  const pos = travel(f, L, [ox, 0, z], [0, 0, z], null, { enter: 46 });
  const yaw = lerp(-30 * DEG, 22 * DEG, easeInOutSine(progress(f, 10, L - 10)));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 6)] };
};

export const BLACK_MOVES: Record<string, Move> = {
  threeViews,
  centreHold,
  slideRight,
  pairOverlap,
  pairSwap,
  brickWall,
  tiltedGrid,
  lineupFive,
  closeFloat,
};
