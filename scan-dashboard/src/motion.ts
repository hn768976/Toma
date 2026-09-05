import { DURATION } from './constants';

/**
 * Every motion in the piece is a pure function of the frame number and closes
 * an integer number of cycles across DURATION, so frame 480 === frame 0.
 */

export const loopPhase = (frame: number, cycles: number) => (frame / DURATION) * cycles;

export const loopSin = (frame: number, cycles: number, phase = 0) =>
  Math.sin(2 * Math.PI * loopPhase(frame, cycles) + phase);

export const loopCos = (frame: number, cycles: number, phase = 0) =>
  Math.cos(2 * Math.PI * loopPhase(frame, cycles) + phase);

/** 0 → 1 sawtooth repeating `cycles` times, landing back on 0 at DURATION. */
export const loopRamp = (frame: number, cycles: number, phase = 0) => {
  const v = loopPhase(frame, cycles) + phase;
  return v - Math.floor(v);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
