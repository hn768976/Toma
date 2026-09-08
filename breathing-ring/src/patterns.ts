/**
 * Breathing patterns as data.
 *
 * A pattern is an ordered list of phases with a duration in seconds. The ring's
 * radius, the phase label and the cycle length are all derived from this, so a
 * new pattern is a data addition — no component changes.
 */

export type BreathPhase = "inhale" | "hold" | "exhale";

export type PatternStep = {
  phase: BreathPhase;
  seconds: number;
};

export type BreathingPattern = {
  /** Stable id, used for the composition id suffix and in the README. */
  id: string;
  /** Human-readable name, e.g. for a labelled variant or documentation. */
  name: string;
  steps: PatternStep[];
};

/** V1 — Box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s. 16s. */
export const BOX_4_4_4_4: BreathingPattern = {
  id: "box-4-4-4-4",
  name: "Box breathing 4-4-4-4",
  steps: [
    { phase: "inhale", seconds: 4 },
    { phase: "hold", seconds: 4 },
    { phase: "exhale", seconds: 4 },
    { phase: "hold", seconds: 4 },
  ],
};

/** V2 — 4-7-8: inhale 4s, hold 7s, exhale 8s. 19s. */
export const RELAXING_4_7_8: BreathingPattern = {
  id: "4-7-8",
  name: "4-7-8 breathing",
  steps: [
    { phase: "inhale", seconds: 4 },
    { phase: "hold", seconds: 7 },
    { phase: "exhale", seconds: 8 },
  ],
};

/** V3 — Coherent breathing: inhale 5.5s, exhale 5.5s, no holds. 11s. */
export const COHERENT_5_5: BreathingPattern = {
  id: "coherent-5-5",
  name: "Coherent breathing 5.5-5.5",
  steps: [
    { phase: "inhale", seconds: 5.5 },
    { phase: "exhale", seconds: 5.5 },
  ],
};

export const cycleSeconds = (pattern: BreathingPattern): number =>
  pattern.steps.reduce((total, step) => total + step.seconds, 0);

/**
 * Exact cycle length in frames.
 *
 * Throws if any phase — or the cycle as a whole — is not a whole number of
 * frames: a cycle that is a fraction of a frame off drifts against a voiceover
 * over a long session, which is exactly what these clips are sold to avoid.
 */
export const cycleDurationInFrames = (
  pattern: BreathingPattern,
  fps: number,
): number => {
  for (const step of pattern.steps) {
    const frames = step.seconds * fps;
    if (!Number.isInteger(frames)) {
      throw new Error(
        `Pattern "${pattern.id}": phase ${step.phase} of ${step.seconds}s is ` +
          `${frames} frames at ${fps}fps — must be a whole number of frames.`,
      );
    }
  }
  const total = cycleSeconds(pattern) * fps;
  if (!Number.isInteger(total)) {
    throw new Error(
      `Pattern "${pattern.id}": cycle of ${cycleSeconds(pattern)}s is ` +
        `${total} frames at ${fps}fps — must be a whole number of frames.`,
    );
  }
  return total;
};

/** The frame at peak inhale — the end of the first inhale phase. Used for stills. */
export const peakInhaleFrame = (
  pattern: BreathingPattern,
  fps: number,
): number => {
  let frame = 0;
  for (const step of pattern.steps) {
    frame += step.seconds * fps;
    if (step.phase === "inhale") {
      return frame;
    }
  }
  return 0;
};
