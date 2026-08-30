import { LungVariant } from "./variants";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Cosine ease with zero velocity at both ends, so the ramps join the hold and
 * the trough without a visible kick.
 */
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u));

/**
 * How far into a breath we are, 0 (fully exhaled) to 1 (fully inhaled).
 *
 * The rhythm is deliberately asymmetric — a faster inhale, a brief hold, a
 * longer exhale. A symmetric sine reads as a machine, not a body.
 *
 * The "strained" variant additionally stutters on two of its seven breaths:
 * the inhale pauses partway up, then completes. The pause is absorbed by
 * compressing the remainder of that cycle, so the cycle still ends exactly
 * where it started and the 420-frame loop stays closed.
 */
export const breathAmount = (frame: number, variant: LungVariant): number => {
  const { cycleFrames, inhale, hold, catches } = variant.breath;
  const index = Math.floor(frame / cycleFrames);
  let f = frame - index * cycleFrames;

  const stutter = catches.find((c) => c.breath === index);
  if (stutter) {
    const { at, frames } = stutter;
    if (f >= at + frames) {
      f = at + (f - at - frames) * ((cycleFrames - at) / (cycleFrames - at - frames));
    } else if (f >= at) {
      f = at;
    }
  }

  const t = f / cycleFrames;
  if (t < inhale) return ease(t / inhale);
  if (t < inhale + hold) return 1;
  return 1 - ease((t - inhale - hold) / (1 - inhale - hold));
};

export type BreathTransform = {
  amount: number;
  scaleX: number;
  scaleY: number;
  /** Applied to the lobes and the tree inside them. */
  transform: string;
  /** Exactly undoes `transform` — used to hold particles still. */
  inverseTransform: string;
};

/**
 * The expansion is not a uniform scale. X grows more than Y (the ribs swing
 * outward), and the origin sits at the trachea fork, so the top stays pinned
 * and the lower edges travel furthest — the diaphragm dropping.
 */
export const breathTransform = (
  frame: number,
  variant: LungVariant,
  origin: { x: number; y: number },
): BreathTransform => {
  const amount = breathAmount(frame, variant);
  const scaleX = 1 + (variant.breath.scaleX - 1) * amount;
  const scaleY = 1 + (variant.breath.scaleY - 1) * amount;
  const about = (sx: number, sy: number) =>
    `translate(${origin.x} ${origin.y}) scale(${sx} ${sy}) translate(${-origin.x} ${-origin.y})`;
  return {
    amount,
    scaleX,
    scaleY,
    transform: about(scaleX, scaleY),
    inverseTransform: about(1 / scaleX, 1 / scaleY),
  };
};
