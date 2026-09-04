import type { Board } from "./geometry";
import { makeRng, range } from "./rng";

export type Pulse = {
  /** Index into board.traces. */
  t: number;
  /** Whole traversals of the path per loop — this is what makes the loop seamless. */
  k: number;
  /** Position along the path at frame 0, as a fraction of the path length. */
  phase: number;
  /** Tail length in width units. */
  tail: number;
  /** Overall brightness multiplier. */
  gain: number;
  /** Pale-white variant instead of the trace hue. */
  white: boolean;
};

/**
 * Pulse speed is expressed as an integer number of traversals per loop, so
 * every pulse is back exactly where it started at frame `durationInFrames`.
 * Path lengths differ widely, so equal `k` values still read as different
 * speeds on screen.
 */
const SPEEDS = [1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 7] as const;

export const buildPulses = (
  board: Board,
  seed: number,
  count: number,
  whiteChance: number,
): Pulse[] => {
  const rng = makeRng(seed);
  const n = board.traces.length;
  const pulses: Pulse[] = [];

  // Rank traces so the long ones carry most of the traffic, and leave a good
  // share of the board dark for the whole loop.
  const order = board.traces
    .map((t, i) => ({ i, key: t.len * range(rng, 0.35, 1) }))
    .sort((a, b) => b.key - a.key);
  const busy = order.slice(0, Math.min(n, Math.round(count * 0.85)));

  // Routes escaping a package pin are what light the chip combs, and they are
  // rarely the longest traces on the board — so reserve traffic for them
  // rather than leaving it to the length ranking.
  const pinIdx: number[] = [];
  for (let i = 0; i < n; i++) if (board.traces[i].fromPin) pinIdx.push(i);
  for (let i = pinIdx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pinIdx[i], pinIdx[j]] = [pinIdx[j], pinIdx[i]];
  }
  const reserved = Math.min(
    Math.round(count * 0.42),
    pinIdx.length * 2,
    count,
  );

  for (let p = 0; p < count; p++) {
    let pickIdx: number;
    if (p < reserved && pinIdx.length > 0) {
      pickIdx = pinIdx[p % pinIdx.length];
    } else {
      const q = p - reserved;
      pickIdx =
        q < busy.length
          ? busy[q].i
          : // Remaining pulses double up on already-busy traces.
            busy[Math.floor(rng() * busy.length)].i;
    }
    const tr = board.traces[pickIdx];
    pulses.push({
      t: pickIdx,
      k: SPEEDS[Math.floor(rng() * SPEEDS.length)],
      phase: rng(),
      tail: Math.min(tr.len * 0.9, range(rng, 0.1, 0.42)),
      gain: range(rng, 0.55, 1),
      white: rng() < whiteChance,
    });
  }
  return pulses;
};
