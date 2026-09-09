import {DURATION, type Version} from '../config';
import {rnd, rndInt, wrap} from '../rand';

export type Span = {
  /** First frame of the span, already rotated into the loop. */
  start: number;
  length: number;
  /** Seed for this span's own properties. */
  id: number;
  occupied: boolean;
};

/**
 * A lane is a slot that holds at most one artifact at a time. Its timeline is
 * an exact integer partition of the loop into `minSpans`-`maxSpans` spans,
 * rotated by a per-lane offset so lanes never all start together at frame 0.
 *
 * Because the partition tiles the loop exactly and every lane is independent of
 * the absolute frame number, lifespans close over the seam with no cross-fade,
 * and concurrency can never exceed the lane count — which is what keeps the
 * artifact counts inside the brief without ever culling a live artifact
 * mid-life (which would read as a pop).
 */
export const laneSpans = (
  v: Version,
  lane: number,
  minSpans: number,
  maxSpans: number,
  occupancy: number,
  salt: number,
): Span[] => {
  const n = rndInt(minSpans, maxSpans, v.seed, lane, salt, 0x5c01);
  const weights: number[] = [];
  let total = 0;
  for (let j = 0; j < n; j++) {
    const wj = 0.55 + rnd(v.seed, lane, j, salt, 0x5c02);
    weights.push(wj);
    total += wj;
  }

  const offset = Math.floor(rnd(v.seed, lane, salt, 0x5c03) * DURATION);
  const spans: Span[] = [];
  let acc = 0;
  let prev = 0;
  for (let j = 0; j < n; j++) {
    acc += weights[j];
    const bound =
      j === n - 1
        ? DURATION
        : Math.max(prev + 1, Math.round((acc / total) * DURATION));
    spans.push({
      start: wrap(prev + offset, DURATION),
      length: bound - prev,
      id: lane * 9973 + j,
      occupied: rnd(v.seed, lane, j, salt, 0x5c04) < occupancy,
    });
    prev = bound;
  }
  return spans;
};

export const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
