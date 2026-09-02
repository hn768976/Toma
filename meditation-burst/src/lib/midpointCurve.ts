import { rnd } from "./rand";

/**
 * Recursive midpoint displacement along a 1-D parameter.
 *
 * Returns `2^depth + 1` offsets interpolating `startOffset` ->
 * `endOffset`, with each inserted midpoint pushed off the straight line
 * by a seeded amount that halves (times `roughness`) at every level.
 * Low `scale` values give sinuous curves; high ones give jagged ones.
 */
export const midpointDisplace = (
  seed: string,
  depth: number,
  length: number,
  scale: number,
  roughness: number,
  startOffset: number,
  endOffset: number,
): Float64Array => {
  const count = (1 << depth) + 1;
  const out = new Float64Array(count);
  out[0] = startOffset;
  out[count - 1] = endOffset;
  let step = count - 1;
  let amp = length * scale;
  let level = 0;
  while (step > 1) {
    const half = step >> 1;
    for (let i = half; i < count; i += step) {
      const mid = (out[i - half] + out[i + half]) / 2;
      out[i] = mid + (rnd(`${seed}:${level}:${i}`) * 2 - 1) * amp;
    }
    step = half;
    amp *= roughness;
    level++;
  }
  return out;
};
