import { hash, rand } from "./rand";

export const FPS = 30;
export const DURATION_IN_FRAMES = 600;
export const TAU = Math.PI * 2;

/** Wrap into the loop so frame 600 is literally frame 0. */
export const loopFrame = (frame: number): number =>
  ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;

/**
 * The beat of the clip: a low simmer punctuated by six violent bursts.
 * Every burst sits well inside the loop so none of them straddles frame 0.
 */
type Burst = { start: number; length: number; power: number };

export const BURSTS: Burst[] = [
  { start: 58, length: 5, power: 0.86 },
  { start: 147, length: 8, power: 1 },
  { start: 236, length: 4, power: 0.72 },
  { start: 330, length: 9, power: 1 },
  { start: 421, length: 5, power: 0.8 },
  { start: 508, length: 7, power: 0.95 },
];

const MICRO_SEED = 9173;
const SHAPE_SEED = 2237;

/**
 * Continuous across the loop point: every term is a sine with an integer
 * number of cycles over DURATION_IN_FRAMES.
 */
const simmer = (frame: number): number =>
  0.1 +
  0.045 * Math.sin((TAU * 3 * frame) / DURATION_IN_FRAMES) +
  0.03 * Math.sin((TAU * 7 * frame) / DURATION_IN_FRAMES + 1.3);

/**
 * 0 = calm, 1 = full corruption. Bursts snap on and decay raggedly; there is
 * no easing anywhere, the hard instantaneous quality is the point.
 */
export const glitchLevel = (frame: number): number => {
  let level = simmer(frame);

  for (let i = 0; i < BURSTS.length; i++) {
    const burst = BURSTS[i];
    if (frame < burst.start || frame >= burst.start + burst.length) {
      continue;
    }
    const t = (frame - burst.start) / burst.length;
    // Hard attack for the first third, then a jagged (not smooth) decay.
    const shape = t < 0.34 ? 1 : rand(0.35, 0.95, SHAPE_SEED, i, frame);
    level = Math.max(level, burst.power * shape);
  }

  // Single frame hiccups between the bursts, so the simmer is never regular.
  if (hash(MICRO_SEED, frame) < 0.04) {
    level = Math.max(level, rand(0.28, 0.55, MICRO_SEED, frame, 1));
  }

  return Math.min(1, level);
};

/** Slow, loop safe wobble in [-1, 1] used for drifts. */
export const wobble = (frame: number, cycles: number, phase = 0): number =>
  Math.sin((TAU * cycles * frame) / DURATION_IN_FRAMES + phase);
