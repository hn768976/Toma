/**
 * Every continuous motion in the piece, as a pure function of the frame
 * number and nothing else.
 *
 * Each one is periodic with a period that divides DURATION_IN_FRAMES, so the
 * value at frame 600 is bit-for-bit the value at frame 0. `scripts/verify-loop.ts`
 * asserts exactly that against this module - keeping the expressions here
 * rather than inline in the components is what makes the loop checkable.
 */
import {
  COLUMN_TILE_HEIGHT,
  DURATION_IN_FRAMES,
  GRAIN_TILE_COUNT,
  MAP_DRIFT_X,
  MAP_DRIFT_Y,
  TIMING,
} from "./layout";

const TAU = Math.PI * 2;

/** Position within the loop, 0 at frame 0 and again at frame 600. */
export const loopT = (frame: number): number =>
  (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;

export const loopFrame = (frame: number): number => frame % DURATION_IN_FRAMES;

/** One horizontal and two vertical cycles of backdrop drift per loop. */
export const mapDrift = (frame: number): { x: number; y: number } => {
  const t = loopT(frame);
  return {
    x: Math.sin(TAU * t) * MAP_DRIFT_X,
    y: Math.sin(TAU * 2 * t + Math.PI / 5) * MAP_DRIFT_Y,
  };
};

/** A column advances a whole number of tile heights over the loop. */
export const columnDrift = (frame: number, tilesPerLoop: number): number =>
  (loopT(frame) * tilesPerLoop * COLUMN_TILE_HEIGHT) % COLUMN_TILE_HEIGHT;

/** Sharp on, quick decay - a blink rather than a throb. */
export const squareFlicker = (
  frame: number,
  period: number,
  offset: number,
): number => {
  const phase = ((frame + offset) % period) / period;
  return 0.18 + 0.82 * Math.pow(Math.max(0, Math.sin(phase * Math.PI)), 6);
};

export const accentDashOffset = (
  frame: number,
  direction: number,
  cycle: number,
): number =>
  direction *
  ((frame % TIMING.accentRulePeriod) / TIMING.accentRulePeriod) *
  cycle;

export const iconPulse = (frame: number): { scale: number; glow: number } => {
  const p = Math.sin((TAU * loopFrame(frame)) / TIMING.iconPulse);
  return { scale: 1 + p * 0.012, glow: 0.62 + p * 0.12 };
};

/** A tiny closed Lissajous path: whole cycle counts, so it closes. */
export const docBob = (
  frame: number,
  amplitudeX: number,
  amplitudeY: number,
  phase: number,
): { x: number; y: number } => {
  const t = loopT(frame);
  return {
    x: Math.sin(TAU * (TIMING.docBobFastCycles * t + phase)) * amplitudeX,
    y:
      Math.sin(TAU * (TIMING.docBobSlowCycles * t + phase * 1.7) + Math.PI / 3) *
      amplitudeY,
  };
};

/** "rejected" only: is this document in its brief dropout right now? */
export const docDropout = (
  frame: number,
  period: number,
  offset: number,
): boolean => (frame + offset) % period < TIMING.docFlickerFrames;

export const grainTileIndex = (frame: number): number =>
  loopFrame(frame) % GRAIN_TILE_COUNT;
