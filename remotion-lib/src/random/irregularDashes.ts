/**
 * irregularDashes.ts — dash patterns that do not read as a ladder.
 *
 * WHAT IT DOES
 *   Builds SVG dash arrays whose dash lengths and gap lengths both vary,
 *   and — separately — a segment list that additionally wanders
 *   perpendicular to the path.
 *
 * WHAT IT IS FOR
 *   `strokeDasharray="8 8"` is perfectly even, and evenness at this scale
 *   reads as manufactured: a ladder, a zip, a dotted UI border. Hand-cut
 *   or worn dashes vary in all three axes — length, gap, and lateral
 *   position. Varying only length still leaves the rungs aligned.
 *
 * TWO FUNCTIONS, BECAUSE SVG CANNOT DO THE THIRD AXIS
 *   irregularDashes()        -> number[] for strokeDasharray. Varies
 *                               length and gap. One attribute, works on
 *                               any existing <path>, no geometry needed.
 *   irregularDashSegments()  -> segments with a perpendicular offset.
 *                               strokeDasharray has no way to express
 *                               lateral wander, so achieving it requires
 *                               emitting each dash as its own path. Use
 *                               this only when the wander matters; it
 *                               costs one DOM node per dash.
 *
 * PARAMETERS (irregularDashes)
 *   pairs        how many dash/gap pairs to generate. The array cycles,
 *               so ~8 is plenty for any path length. Default 8.
 *   seed        integer; same seed => same pattern
 *   dash        mean dash length in px. Default 12.
 *   gap         mean gap length in px. Default 9.
 *   variance    0..1, how far each value may stray from its mean.
 *               Default 0.45. At 0 you get an even ladder again.
 *
 * PARAMETERS (irregularDashSegments) — as above, plus
 *   pathLength  total length of the path being dashed, in px. Get it from
 *               path.getTotalLength(), or from strokes/drawOn.ts.
 *   wander      max perpendicular offset in px. Default 1.5. Above ~3 the
 *               dashes stop reading as one line.
 *
 * GOTCHA
 *   An SVG dash array with an odd number of entries is silently doubled
 *   by the renderer, which re-introduces a repeat at twice the period.
 *   irregularDashes always returns an even-length array for this reason —
 *   do not slice the result.
 *
 * USAGE
 *   <path d={d} strokeDasharray={irregularDashes({ seed: 3 }).join(" ")} />
 */

import { seededRandom } from "./seededRandom";

export type IrregularDashesOptions = {
  seed: number;
  pairs?: number;
  dash?: number;
  gap?: number;
  variance?: number;
};

/**
 * Returns [dash, gap, dash, gap, ...] — always even-length, so the
 * pattern repeats at the length you expect.
 */
export const irregularDashes = ({
  seed,
  pairs = 8,
  dash = 12,
  gap = 9,
  variance = 0.45,
}: IrregularDashesOptions): number[] => {
  const out: number[] = [];
  for (let i = 0; i < pairs; i++) {
    const dJitter = (seededRandom(i, seed + 1) - 0.5) * 2 * variance;
    const gJitter = (seededRandom(i, seed + 30) - 0.5) * 2 * variance;
    out.push(Math.max(0.5, dash * (1 + dJitter)));
    out.push(Math.max(0.5, gap * (1 + gJitter)));
  }
  return out;
};

export type DashSegment = {
  /** Distance along the path where this dash starts, in px. */
  start: number;
  /** Length of this dash, in px. */
  length: number;
  /** Perpendicular offset to apply, in px; signed. */
  offset: number;
  index: number;
};

/**
 * Walks `pathLength` and emits one segment per dash, each with a lateral
 * offset. Feed each segment to a path sampler to get real coordinates:
 * sample the path at `start` and `start + length`, then displace both
 * points along the local normal by `offset`.
 */
export const irregularDashSegments = ({
  seed,
  pathLength,
  dash = 12,
  gap = 9,
  variance = 0.45,
  wander = 1.5,
}: IrregularDashesOptions & {
  pathLength: number;
  wander?: number;
}): DashSegment[] => {
  const segments: DashSegment[] = [];
  let cursor = 0;
  let i = 0;
  // Bounded so a pathological dash/gap of ~0 cannot spin forever.
  const maxSegments = 10000;
  while (cursor < pathLength && i < maxSegments) {
    const dJitter = (seededRandom(i, seed + 1) - 0.5) * 2 * variance;
    const gJitter = (seededRandom(i, seed + 30) - 0.5) * 2 * variance;
    const length = Math.max(0.5, dash * (1 + dJitter));
    const thisGap = Math.max(0.5, gap * (1 + gJitter));

    segments.push({
      index: i,
      start: cursor,
      length: Math.min(length, pathLength - cursor),
      offset: (seededRandom(i, seed + 60) - 0.5) * 2 * wander,
    });

    cursor += length + thisGap;
    i++;
  }
  return segments;
};
