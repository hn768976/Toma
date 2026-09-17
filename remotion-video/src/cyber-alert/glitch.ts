// The glitch schedule.
//
// Two things make a signal-corruption glitch read as real rather than as
// an animated wipe: it is STEPPY (a value is held for a couple of frames,
// then jumps, never eases), and it STUTTERS (some frames inside a burst
// snap back to clean). A smooth ramp reads as a dissolve, which is the
// one thing broken hardware never does.

import { hash01 } from "../lib/random";

export type Glitch = {
  active: boolean;
  intensity: number; // 0..1, drives displacement, split and camera kick
  step: number; // seed; changes only when the held value jumps
  scramble: number; // 0..1 chance a given character is replaced
};

type Burst = { start: number; end: number; peak: number };

// Hit points across the 7s. Placed to match the reference: a small
// stumble early, a short tick at ~2s, a long violent tear through the
// middle, and one last hit before the wall settles.
const BURSTS: Burst[] = [
  { start: 10, end: 20, peak: 0.45 },
  { start: 58, end: 66, peak: 0.32 },
  { start: 99, end: 117, peak: 0.85 },
  { start: 124, end: 146, peak: 1.0 },
  { start: 186, end: 201, peak: 0.6 },
];

// Frames a glitch value is held before it jumps. 2 at 30fps is the
// sweet spot — 1 flickers into mush, 3+ starts to look choreographed.
const HOLD_FRAMES = 2;

const envelope = (frame: number, burst: Burst) => {
  const attack = 2;
  const release = 3;
  if (frame < burst.start || frame > burst.end) return 0;
  const inRamp = Math.min(1, (frame - burst.start + 1) / attack);
  const outRamp = Math.min(1, (burst.end - frame + 1) / release);
  return Math.min(inRamp, outRamp);
};

export const glitchAt = (frame: number): Glitch => {
  let peak = 0;
  for (const burst of BURSTS) {
    peak = Math.max(peak, envelope(frame, burst) * burst.peak);
  }
  if (peak <= 0) {
    return { active: false, intensity: 0, step: 0, scramble: 0 };
  }

  const step = Math.floor(frame / HOLD_FRAMES);
  const roll = hash01(step, 11, 3);

  // Stutter: roughly one held step in six inside a burst drops clean,
  // so the corruption arrives in bursts of bursts.
  if (roll < 0.17) {
    return { active: false, intensity: 0, step, scramble: 0 };
  }

  const intensity = peak * (0.45 + 0.55 * roll);
  return { active: true, intensity, step, scramble: intensity * 0.9 };
};
