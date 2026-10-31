import { mulberry32 } from "../random";
import {
  FIELD_RADIUS,
  LOOP_PERIOD_Z,
  POST_HEIGHT,
  ROW_PITCH,
} from "./constants";

export type Vec3 = [number, number, number];

export type Segment = { from: Vec3; to: Vec3 };

export type Piece = {
  // Segments in the piece's local space; the local origin is the base point
  // the piece scales/turns around.
  segments: Segment[];
  origin: Vec3;
  // A few frames periodically shrink away and grow back with a quarter turn.
  pulse: null | {
    cycles: number; // whole cycles per loop -> seamless
    phase: number; // 0..1
  };
};

const ROWS_PER_PERIOD = Math.round(LOOP_PERIOD_Z / ROW_PITCH);

// Hash of an integer pair -> deterministic PRNG, so the field is exactly
// periodic along Z (needed for the seamless loop).
const cellRand = (seed: number, i: number, j: number) =>
  mulberry32(
    (seed * 73856093) ^
      (i * 19349663) ^
      ((((j % ROWS_PER_PERIOD) + ROWS_PER_PERIOD) % ROWS_PER_PERIOD) *
        83492791),
  );

// The reference is a regular, staggered field of upright "Π" frames that all
// face the same way (top beam along X), with occasional connecting rails along
// Z at the top or on the floor.
export const generatePieces = (seed: number): Piece[] => {
  const pieces: Piece[] = [];
  const R = FIELD_RADIUS;
  const H = POST_HEIGHT;
  const rowsHalf = Math.ceil(R / ROW_PITCH);

  for (let j = -rowsHalf; j <= rowsHalf; j++) {
    const z = j * ROW_PITCH;
    // One PRNG per row (periodic in j): frames are laid out along X with
    // irregular gaps, so no screen-space columns line up.
    const rand = cellRand(seed, 0, j);
    let x = -R - rand() * 2;
    while (x < R) {
      const i = x;
      x += 1 + [0.5, 0.5, 1, 1, 1.5][Math.floor(rand() * 5)];
      if (rand() < 0.05) continue;
      const x0 = i;
      const span = 1;
      const kind = rand();
      const segs: Segment[] = [];
      const postL = rand() < 0.9;
      const postR = rand() < 0.9 || !postL;
      // Top beam along X.
      segs.push({ from: [0, H, 0], to: [span, H, 0] });
      if (postL) segs.push({ from: [0, 0, 0], to: [0, H, 0] });
      if (postR) segs.push({ from: [span, 0, 0], to: [span, H, 0] });

      if (kind < 0.36) {
        // Rail along -Z from a top corner (towards the previous row).
        const cx = rand() < 0.5 ? 0 : span;
        segs.push({ from: [cx, H, 0], to: [cx, H, -ROW_PITCH * 2] });
      } else if (kind < 0.54) {
        // Floor rail along Z from a foot.
        const cx = postL && rand() < 0.5 ? 0 : span;
        segs.push({ from: [cx, 0, 0], to: [cx, 0, ROW_PITCH * 2] });
      } else if (kind < 0.6) {
        // Mid rail: makes the "H"/"F" frames seen in the reference.
        segs.push({ from: [0, H * 0.5, 0], to: [span, H * 0.5, 0] });
      } else if (kind < 0.68) {
        // Closed rectangle.
        segs.push({ from: [0, 0, 0], to: [span, 0, 0] });
      }

      const animated = rand() < 0.07;
      // About a third of the frames are turned 90 degrees (beam along Z).
      const turned = rand() < 0.33;
      const place = (p: Vec3): Vec3 => {
        const lx = p[0] - span / 2;
        return turned ? [p[2], p[1], -lx] : [lx, p[1], p[2]];
      };
      pieces.push({
        segments: segs.map((s) => ({ from: place(s.from), to: place(s.to) })),
        origin: [x0 + span / 2, 0, z],
        pulse: animated
          ? { cycles: 1 + Math.floor(rand() * 2), phase: rand() }
          : null,
      });
    }
  }
  return pieces;
};
