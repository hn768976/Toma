// Boil timing. Everything derives from the frame number.

/** Frames each drawn variant is held ("on threes"). */
export const HOLD_FRAMES = 3;
/** Number of drawn variants. 4 x 3 = 12-frame cycle, which divides the 300-frame loop. */
export const VARIANTS = 4;

export const variantAt = (frame: number) => Math.floor(frame / HOLD_FRAMES) % VARIANTS;

/**
 * Gentle drift: +/-0.5% of frame height bob and +/-1 degree tilt.
 * The brief asked for drift on twos, but on twos it would move the picture on frames where
 * the boil holds (2, 3, 4 in a row), so the drawing would change every frame for stretches.
 * Stepping it with the boil holds keeps every change on the 3-frame grid.
 */
export const DRIFT_BOB = 0.005;
export const DRIFT_TILT_DEG = 1;

export type Drift = { dy: number; rot: number };

/**
 * Whole cosine cycles per loop so frame 0 and frame `loop` match.
 * `phase` and `cycles` are per doodle, so a frame full of doodles doesn't move in lockstep.
 */
export const driftAt = (
  frame: number,
  loop: number,
  frameHeight: number,
  phase: number,
  cycles: [number, number],
): Drift => {
  const t = Math.floor(frame / HOLD_FRAMES) * HOLD_FRAMES; // stepped with the boil
  const a = (2 * Math.PI * t) / loop;
  return {
    dy: DRIFT_BOB * frameHeight * Math.cos(a * cycles[0] + phase),
    rot: ((DRIFT_TILT_DEG * Math.PI) / 180) * Math.cos(a * cycles[1] + phase * 1.7 + 1.1),
  };
};
