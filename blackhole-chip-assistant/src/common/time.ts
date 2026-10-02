import { LOOP_FRAMES } from "./constants";
import { TAU } from "./glsl";

/**
 * Loop phase 0..1 for the 600-frame looks.
 *
 * Normally `frame % 600`, so frame 600 is literally frame 0. The loop test
 * passes `wrap: false` so the phase keeps running (frame 600 -> phase 1.0):
 * then frame 600 only matches frame 0 if every motion really completes a
 * whole number of cycles. See README "Loop check".
 */
export const loopPhase = (frame: number, wrap: boolean) =>
  wrap ? (frame % LOOP_FRAMES) / LOOP_FRAMES : frame / LOOP_FRAMES;

/**
 * Fractional part. Periodic functions reduce their argument with this before
 * calling sin/cos, so phase 1.0 gives exactly the same value as phase 0.0
 * (Math.sin(2*PI) is -2.4e-16, not 0, which is enough to flip a pixel).
 */
export const cyc = (x: number) => x - Math.floor(x);

/** sin / cos of 2*pi*(cycles * phase + offset): whole cycles per loop. */
export const sinLoop = (phase: number, cycles = 1, offset = 0) => Math.sin(TAU * cyc(cycles * phase + offset));
export const cosLoop = (phase: number, cycles = 1, offset = 0) => Math.cos(TAU * cyc(cycles * phase + offset));

/** Point on the noise time-circle: (cos, sin)(2*pi*phase) * radius. */
export const timeCircle = (phase: number, radius: number): [number, number] => [
  cosLoop(phase) * radius,
  sinLoop(phase) * radius,
];
