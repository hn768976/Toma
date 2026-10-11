import { getInputProps } from "remotion";

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Animation frame for a loop/story. Normally wrapped to [0, period). With the
 * `loopCheck` input prop the wrap is disabled, so frame `period` evaluates every
 * periodic function at phase 1.0 — the seam check (frame 600 == frame 0) then
 * genuinely tests the motion rather than the modulo. Grain always uses frame % period.
 */
export const animFrame = (frame: number, period: number) =>
  (getInputProps() as { loopCheck?: boolean }).loopCheck ? frame : mod(frame, period);
export const grainFrame = (frame: number, period: number) => mod(frame, period);
