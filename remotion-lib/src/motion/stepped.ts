import { spring } from "remotion";
import { clamp, rndRange } from "../random/seeded";

export type SteppedSpringOpts = {
  /** Frame already wrapped into [0, loopLength). */
  frame: number;
  fps: number;
  /** Frames between re-targets. MUST divide loopLength. */
  period: number;
  loopLength: number;
  seed: string;
  min: number;
  max: number;
  damping?: number;
  mass?: number;
  stiffness?: number;
};

/**
 * A value that springs to a new seeded target every `period` frames, and
 * arrives back where it started at the end of the loop.
 *
 * The loop closure is the whole point. There are exactly loopLength / period
 * targets, indexed cyclically, so the target a generation springs *from* is
 * the previous generation's target modulo that count. At frame 0 the value is
 * the LAST generation's target with zero spring progress; at the final frame
 * the spring has settled on that same target. The two ends meet.
 *
 * Requires loopLength % period === 0; anything else lands mid-flight at the
 * cut. It also needs the spring to settle inside one period — the default
 * config settles in roughly 45 frames.
 */
export const steppedSpring = (o: SteppedSpringOpts): number => {
  const { frame, fps, period, loopLength, seed, min, max } = o;
  const generations = Math.max(1, Math.round(loopLength / period));
  const gen = Math.floor(frame / period);
  const targetAt = (g: number) => {
    const idx = ((g % generations) + generations) % generations;
    return rndRange(`${seed}-target-${idx}`, min, max);
  };
  const from = targetAt(gen - 1);
  const to = targetAt(gen);
  const progress = spring({
    frame: frame - gen * period,
    fps,
    config: {
      damping: o.damping ?? 14,
      mass: o.mass ?? 0.9,
      stiffness: o.stiffness ?? 85,
    },
  });
  return clamp(from + (to - from) * progress, min, max);
};

/**
 * A value that steps to a new seeded target every `period` frames with no
 * interpolation — for readouts and table cells, which should snap.
 */
export const steppedValue = (o: {
  frame: number;
  period: number;
  loopLength: number;
  seed: string;
  min: number;
  max: number;
  /** Shifts this cell's reroll off the shared beat. */
  offset?: number;
}): { value: number; ageInGeneration: number } => {
  const { frame, period, loopLength, seed, min, max, offset = 0 } = o;
  const generations = Math.max(1, Math.round(loopLength / period));
  const shifted = (frame + offset) % loopLength;
  const gen = Math.floor(shifted / period) % generations;
  return {
    value: rndRange(`${seed}-gen-${gen}`, min, max),
    ageInGeneration: shifted - gen * period,
  };
};

/** A 0..1 bell over `width` frames starting at `start`, on a cycle of `period`. */
export const pulseEnvelope = (
  frame: number,
  period: number,
  start: number,
  width: number,
): number => {
  const t = ((((frame - start) % period) + period) % period);
  if (t >= width) return 0;
  return Math.sin((t / width) * Math.PI);
};
