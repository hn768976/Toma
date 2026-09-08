/**
 * Deriving the breath from the frame.
 *
 * Everything here is a pure function of the frame — no state, no timers — so a
 * frame rendered in isolation on a render farm is identical to the preview.
 */

import { Easing, interpolate } from "remotion";
import type { BreathingPattern, BreathPhase } from "./patterns";

export type TimelineStep = {
  phase: BreathPhase;
  startFrame: number;
  durationInFrames: number;
  /** Breath level at the start of the step: 0 = full exhale, 1 = full inhale. */
  fromLevel: number;
  /** Breath level at the end of the step. */
  toLevel: number;
};

/**
 * Expand a pattern into absolute frame ranges, carrying the breath level
 * through so a hold knows which level to sit still at.
 */
export const buildTimeline = (
  pattern: BreathingPattern,
  fps: number,
): TimelineStep[] => {
  const timeline: TimelineStep[] = [];
  let startFrame = 0;
  // Every supported pattern begins on the inhale, so the cycle starts at rest.
  let level = 0;

  for (const step of pattern.steps) {
    const toLevel =
      step.phase === "inhale" ? 1 : step.phase === "exhale" ? 0 : level;
    const durationInFrames = step.seconds * fps;
    timeline.push({
      phase: step.phase,
      startFrame,
      durationInFrames,
      fromLevel: level,
      toLevel,
    });
    startFrame += durationInFrames;
    level = toLevel;
  }

  return timeline;
};

export type BreathState = {
  /** 0 at full exhale, 1 at full inhale. Floating point — never quantised. */
  level: number;
  phase: BreathPhase;
  /** Progress through the current phase, 0 → 1. */
  phaseProgress: number;
  /** Progress through the whole cycle, 0 → 1. Drives the progress marker. */
  cycleProgress: number;
  step: TimelineStep;
};

export const getBreathState = (
  frame: number,
  timeline: TimelineStep[],
  cycleFrames: number,
): BreathState => {
  // Wrap so the component is safe outside a single cycle (e.g. a looped
  // Sequence, or a Studio scrub past the end).
  const local = ((frame % cycleFrames) + cycleFrames) % cycleFrames;

  let step = timeline[timeline.length - 1] as TimelineStep;
  for (const candidate of timeline) {
    if (local < candidate.startFrame + candidate.durationInFrames) {
      step = candidate;
      break;
    }
  }

  const phaseProgress = interpolate(
    local,
    [step.startFrame, step.startFrame + step.durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // A hold is completely still: fromLevel === toLevel, so `interpolate`
  // returns a constant and the easing never introduces drift.
  const level = interpolate(phaseProgress, [0, 1], [step.fromLevel, step.toLevel], {
    // Sinusoidal ease-in-out — real breath accelerates, then settles.
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    level,
    phase: step.phase,
    phaseProgress,
    cycleProgress: local / cycleFrames,
    step,
  };
};

export const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "INHALE",
  hold: "HOLD",
  exhale: "EXHALE",
};
