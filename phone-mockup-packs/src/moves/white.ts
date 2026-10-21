import { DEG, easeInOutSine, progress, travel, Vec3 } from "../anim";
import { defaultCamera, floating, Move, MoveCtx, offX, offY, Shot } from "./types";

// Staggered brick stack: one column of two phones, one column of one phone
// offset by half a phone height.
const brickLayout = (mirror: boolean): Vec3[] => {
  const s = mirror ? -1 : 1;
  return [
    [(-0.42 - 0.78) * s, 0.86, 0],
    [(-0.42 - 0.78) * s, -0.86, 0],
    [(0.42 - 0.72) * s, -0.02, 0],
  ];
};

const brick = (ctx: MoveCtx, fromSide: -1 | 1, holdToEnd: boolean, mirror: boolean): Shot => {
  const { f, L, stage } = ctx;
  const layout = brickLayout(mirror);
  const ox = offX(stage, 0, 0.6) + 0.9;
  const phones = layout.map((p, i) => {
    const from: Vec3 = [p[0] + fromSide * ox, p[1], p[2]];
    const to: Vec3 | null = holdToEnd ? null : [p[0] - fromSide * ox, p[1], p[2]];
    // Stagger: the column nearest the far side leads.
    const order = fromSide < 0 ? (p[0] > 0 ? 0 : 1 + i) : p[0] > 0 ? i : 2;
    const pos = travel(f, L, from, p, to, { enter: 36, exit: 28, delay: order * 5, exitDelay: (2 - order) * 5 }, [0, 0.03, 0]);
    return floating(ctx, pos, [0, 0, 0], i + 1, 0.6);
  });
  return { camera: defaultCamera(stage), phones };
};

const brickStack: Move = (ctx) => brick(ctx, -1, false, false);
const brickStackReturn: Move = (ctx) => brick(ctx, 1, true, true);

const singlePass: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const ox = offX(stage, 0, 0.6);
  const pos = travel(f, L, [ox, 0, 0], [0, 0, 0], [-ox, 0, 0], { enter: 38, exit: 30 });
  const turnT = progress(f, 50, L - 50 - 45);
  const yaw = 15 * DEG * Math.sin(Math.PI * easeInOutSine(turnT));
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, yaw, 0], 4)] };
};

const rise: Move = (ctx) => {
  const { f, L, stage } = ctx;
  const oy = offY(stage, 0, 0.95);
  const pos = travel(f, L, [0, -oy, 0], [0, 0, 0], [0, -oy, 0], { enter: 40, exit: 30 }, [0, 0.02, 0]);
  return { camera: defaultCamera(stage), phones: [floating(ctx, pos, [0, 0, 0], 5)] };
};

export const WHITE_MOVES: Record<string, Move> = {
  brickStack,
  singlePass,
  rise,
  brickStackReturn,
};
