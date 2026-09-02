import { seededSequence } from "./random";

/**
 * Generates a ring of rounded arc segments separated by gaps, where both the
 * segment lengths and the gap sizes are irregular — a ring of equal segments
 * reads as a dial or a loading spinner rather than a piece of instrumentation.
 *
 * Optionally promotes chosen indices to "long" segments; giving two of them
 * opposite positions on the circle gives the ring an axis.
 */

export type ArcSegment = {
  index: number;
  /** Start angle in radians, before any rotation is applied. */
  start: number;
  /** Angular length in radians. */
  length: number;
  /** True for the promoted long segments. */
  long: boolean;
};

export const brokenArcRing = ({
  count,
  seed,
  /** Segment length variation, as a multiple of the mean. */
  lengthJitter = 0.55,
  /** Gap size variation, as a multiple of the mean. */
  gapJitter = 0.7,
  /** Share of the circle given over to gaps. */
  gapShare = 0.3,
  /** Indices promoted to long segments. */
  longIndices = [],
  /** How much longer a promoted segment is than an ordinary one. */
  longFactor = 2.6,
}: {
  count: number;
  seed: string;
  lengthJitter?: number;
  gapJitter?: number;
  gapShare?: number;
  longIndices?: readonly number[];
  longFactor?: number;
}): ArcSegment[] => {
  const rng = seededSequence(seed);
  const longSet = new Set(longIndices);

  const segWeights: number[] = [];
  const gapWeights: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = 1 + (rng.next() - 0.5) * 2 * lengthJitter;
    segWeights.push(Math.max(0.2, base) * (longSet.has(i) ? longFactor : 1));
    gapWeights.push(Math.max(0.2, 1 + (rng.next() - 0.5) * 2 * gapJitter));
  }

  const segTotal = segWeights.reduce((a, b) => a + b, 0);
  const gapTotal = gapWeights.reduce((a, b) => a + b, 0);
  const segBudget = Math.PI * 2 * (1 - gapShare);
  const gapBudget = Math.PI * 2 * gapShare;

  const segments: ArcSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const length = (segWeights[i] / segTotal) * segBudget;
    segments.push({ index: i, start: cursor, length, long: longSet.has(i) });
    cursor += length + (gapWeights[i] / gapTotal) * gapBudget;
  }
  return segments;
};
