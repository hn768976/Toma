// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { random } from "remotion";
import { makeNoise1D, sampleNoise1D } from "./noiseField";

/**
 * TornEdge — the irregular outline of a hand-torn piece of newsprint.
 *
 * A tear is irregular at two scales at once, and getting only one of them is
 * what makes a "torn paper" effect read as a decorative zigzag border:
 *
 *   · a LOW-frequency undulation, a gentle wander of ~15px amplitude with a
 *     wavelength of several hundred pixels, which gives the edge its overall
 *     wobble;
 *   · a HIGH-frequency ripple of a few pixels every ~30px on top of that;
 *   · plus sparse NICKS — single-sample spikes where the fibre gave way
 *     suddenly. These are the sharp detail; without them the edge is merely
 *     wavy.
 *
 * Sides can individually be torn or cut straight, so a clipping can be torn
 * on all four sides or on two or three with the rest guillotined.
 */

export type Side = "top" | "right" | "bottom" | "left";
export type TornSides = { top: boolean; right: boolean; bottom: boolean; left: boolean };

export type Point = { x: number; y: number };

export type TearPath = {
  points: Point[];
  /**
   * tornSegment[i] is true when the segment from points[i] to points[i+1]
   * lies on a torn side. The fibre highlight is stroked only along those
   * runs — a cut edge has no fibre core.
   */
  tornSegment: boolean[];
};

export type TearOptions = {
  seed: string;
  w: number;
  h: number;
  torn: TornSides;
  /** Amplitude of the slow undulation, in px. */
  ampLow?: number;
  /** Amplitude of the fine ripple, in px. */
  ampHigh?: number;
  /** Amplitude of the sparse sharp nicks, in px. */
  ampNick?: number;
  /** Probability that any one sample becomes a nick. */
  nickChance?: number;
  /** px covered by one cell of the slow undulation. */
  wavelengthLow?: number;
  /** px covered by one cell of the fine ripple. */
  wavelengthHigh?: number;
  /** Distance between samples along the edge, in px. */
  step?: number;
};

const SIDES: Side[] = ["top", "right", "bottom", "left"];

/**
 * Amplitude is tapered towards each corner so a torn side meeting a cut side
 * does not produce an obvious step. It is tapered to 0.35, not to zero — a
 * real tear still has some movement right up to the corner.
 */
const cornerTaper = (u: number): number => {
  const ramp = 0.06;
  const edge = Math.min(u, 1 - u) / ramp;
  const t = Math.max(0, Math.min(1, edge));
  return 0.35 + 0.65 * (t * t * (3 - 2 * t));
};

export const buildTearPath = (opts: TearOptions): TearPath => {
  const {
    seed,
    w,
    h,
    torn,
    ampLow = 16,
    ampHigh = 4.5,
    ampNick = 11,
    nickChance = 0.11,
    wavelengthLow = 520,
    wavelengthHigh = 34,
    step = 4,
  } = opts;

  const points: Point[] = [];
  const tornSegment: boolean[] = [];

  for (let s = 0; s < SIDES.length; s++) {
    const side = SIDES[s];
    const isTorn = torn[side];
    const horizontal = side === "top" || side === "bottom";
    const length = horizontal ? w : h;

    // Walk each side from its start corner towards the next one. u = 1 is
    // left to the following side so corners are not emitted twice.
    if (!isTorn) {
      points.push(cornerOf(side, w, h));
      tornSegment.push(false);
      continue;
    }

    const low = makeNoise1D(`${seed}:${side}:low`, 128);
    const high = makeNoise1D(`${seed}:${side}:high`, 256);
    const cellsLow = length / wavelengthLow;
    const cellsHigh = length / wavelengthHigh;
    const samples = Math.max(2, Math.round(length / step));

    for (let i = 0; i < samples; i++) {
      const u = i / samples;
      const slow = (sampleNoise1D(low, u * cellsLow) - 0.5) * 2 * ampLow;
      const fine = (sampleNoise1D(high, u * cellsHigh) - 0.5) * 2 * ampHigh;
      const nick =
        random(`${seed}:${side}:nick:${i}`) < nickChance
          ? (random(`${seed}:${side}:nickamp:${i}`) - 0.48) * 2 * ampNick
          : 0;
      const offset = (slow + fine + nick) * cornerTaper(u);
      points.push(pointOn(side, w, h, u, offset));
      tornSegment.push(true);
    }
  }

  return { points, tornSegment };
};

const cornerOf = (side: Side, w: number, h: number): Point => {
  if (side === "top") return { x: 0, y: 0 };
  if (side === "right") return { x: w, y: 0 };
  if (side === "bottom") return { x: w, y: h };
  return { x: 0, y: h };
};

/** `offset` is positive outwards from the rectangle. */
const pointOn = (side: Side, w: number, h: number, u: number, offset: number): Point => {
  if (side === "top") return { x: u * w, y: -offset };
  if (side === "right") return { x: w + offset, y: u * h };
  if (side === "bottom") return { x: w - u * w, y: h + offset };
  return { x: -offset, y: h - u * h };
};

export const tracePath = (ctx: CanvasRenderingContext2D, path: TearPath, dx: number, dy: number): void => {
  const p = path.points;
  ctx.beginPath();
  ctx.moveTo(p[0].x + dx, p[0].y + dy);
  for (let i = 1; i < p.length; i++) {
    ctx.lineTo(p[i].x + dx, p[i].y + dy);
  }
  ctx.closePath();
};

/**
 * The fibre edge: a pale band a few pixels wide, sitting *inside* the tear and
 * following its contour exactly. Real torn paper exposes the unprinted fibre
 * core along the tear, and this detail sells the effect more than the shape of
 * the tear itself.
 *
 * It is drawn by stroking the tear at twice the intended width while the
 * context is clipped to the paper, so only the inner half survives. Only torn
 * runs are stroked; cut edges get nothing.
 */
export const strokeFibreEdge = (
  ctx: CanvasRenderingContext2D,
  path: TearPath,
  dx: number,
  dy: number,
  color: string,
  width: number,
): void => {
  const p = path.points;
  const n = p.length;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  let i = 0;
  while (i < n) {
    if (!path.tornSegment[i]) {
      i++;
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(p[i].x + dx, p[i].y + dy);
    let j = i;
    while (j < n && path.tornSegment[j]) {
      const next = p[(j + 1) % n];
      ctx.lineTo(next.x + dx, next.y + dy);
      j++;
    }
    ctx.stroke();
    i = j;
  }
  ctx.restore();
};

/**
 * Loose fibres projecting a few pixels beyond the tear. Drawn outside the clip
 * so they break the silhouette.
 */
export const strokeFibreWhiskers = (
  ctx: CanvasRenderingContext2D,
  path: TearPath,
  dx: number,
  dy: number,
  seed: string,
  color: string,
): void => {
  const p = path.points;
  const n = p.length;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    if (!path.tornSegment[i]) continue;
    if (random(`${seed}:whisker:${i}`) > 0.02) continue;
    const a = p[i];
    const b = p[(i + 1) % n];
    // Outward normal of this segment.
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = ty / len;
    const ny = -tx / len;
    const reach = 3 + random(`${seed}:whiskerlen:${i}`) * 7;
    ctx.beginPath();
    ctx.moveTo(a.x + dx, a.y + dy);
    ctx.lineTo(a.x + dx + nx * reach, a.y + dy + ny * reach);
    ctx.stroke();
  }
  ctx.restore();
};
