import { mulberry32 } from "../random";
import { FIELD_RADIUS, POST_HEIGHT } from "./constants";

export type Vec3 = [number, number, number];

export type Segment = { from: Vec3; to: Vec3 };

export type Piece = {
  // Segments in the piece's local space; local origin is the hinge point.
  segments: Segment[];
  origin: Vec3;
  // Pieces with a hinge fold over around a ground-level axis over time.
  hinge: null | {
    axis: Vec3; // unit axis (x or z)
    maxAngle: number; // radians
    period: number; // seconds
    phase: number; // 0..1
  };
};

const DIRS: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const add = (a: Vec3, b: Vec3, s = 1): Vec3 => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
  a[2] + b[2] * s,
];

const perpendicular = (d: Vec3): Vec3 => (d[0] !== 0 ? [0, 0, 1] : [1, 0, 0]);

// Builds a polyline (list of corner points) and turns it into bar segments.
const polyline = (points: Vec3[]): Segment[] => {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push({ from: points[i], to: points[i + 1] });
  }
  return out;
};

export const generatePieces = (seed: number): Piece[] => {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const pieces: Piece[] = [];
  const R = FIELD_RADIUS;
  const h = POST_HEIGHT;

  for (let gx = -R; gx < R; gx++) {
    for (let gz = -R; gz < R; gz++) {
      if (rand() > 0.74) continue;

      const d = pick(DIRS);
      const p = perpendicular(d);
      const side = rand() < 0.5 ? 1 : -1;
      const span = rand() < 0.7 ? 1 : 2;
      const o: Vec3 = [0, 0, 0];
      const top0 = add(o, [0, h, 0]);
      const top1 = add(top0, d, span);
      const foot1 = add(top1, [0, -h, 0]);
      const kind = rand();

      let points: Vec3[];
      let extra: Segment[] = [];
      if (kind < 0.3) {
        // Classic gate: up, across, down.
        points = [o, top0, top1, foot1];
      } else if (kind < 0.56) {
        // Gate with a corner on top: up, across, turn, down.
        const top2 = add(top1, p, side);
        points = [o, top0, top1, top2, add(top2, [0, -h, 0])];
      } else if (kind < 0.66) {
        // Closed frame: gate plus a bar lying on the floor.
        points = [o, top0, top1, foot1, o];
      } else if (kind < 0.78) {
        // "H" frame: two posts joined by a mid rail and a top rail.
        points = [o, top0, top1, foot1];
        extra = [{ from: add(o, [0, h * 0.5, 0]), to: add(foot1, [0, h * 0.5, 0]) }];
      } else if (kind < 0.9) {
        // Floor-level "L" with a single post.
        const c = add(o, d, span);
        points = [add(c, p, side), c, o, top0];
      } else {
        // Hanging bracket: post, top rail, short drop.
        points = [o, top0, top1, add(top1, [0, -h * 0.5, 0])];
      }

      const folds = rand() < 0.075;
      pieces.push({
        segments: [...polyline(points), ...extra],
        origin: [gx + (rand() < 0.5 ? 0 : 0.5), 0, gz],
        hinge: folds
          ? {
              axis: d[0] !== 0 ? [1, 0, 0] : [0, 0, 1],
              maxAngle: (Math.PI / 2) * (rand() < 0.5 ? 1 : -1),
              period: 3 + rand() * 3.5,
              phase: rand(),
            }
          : null,
      });
    }
  }
  return pieces;
};
