import {Easing, interpolate} from 'remotion';
import {FPS} from './timeline';

/**
 * The entire motion vocabulary. Global spec, section "Motion vocabulary":
 * four primitives, nothing else. No bounce, no spin, no elastic anywhere.
 * If an idea cannot be expressed with these, it gets cut.
 */

/** Milliseconds -> frames. */
export const ms = (n: number) => Math.round((n / 1000) * FPS);

export const FADE = ms(300); // 1. fade  - opacity, 300ms
export const SLIDE = ms(400); // 2. slide - transform, 400ms ease-in-out
export const SNAP = ms(100); // 3. snap  - transform, 100ms linear
export const DRAW = ms(400); // 4. draw  - line reveal

const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const EASE_IN_OUT = Easing.inOut(Easing.ease);

/** 1. fade -- opacity 0 -> 1. */
export const fadeIn = (frame: number, start: number, duration = FADE) =>
  interpolate(frame, [start, start + duration], [0, 1], CLAMP);

/** 1. fade -- opacity 1 -> 0. */
export const fadeOut = (frame: number, start: number, duration = FADE) =>
  interpolate(frame, [start, start + duration], [1, 0], CLAMP);

/** 1. fade -- in at `inAt`, back out at `outAt`. */
export const fadeInOut = (
  frame: number,
  inAt: number,
  outAt: number,
  duration = FADE,
) =>
  Math.min(fadeIn(frame, inAt, duration), fadeOut(frame, outAt, duration));

/** 2. slide -- any transform value, 400ms ease-in-out. */
export const slide = (
  frame: number,
  start: number,
  from: number,
  to: number,
  duration = SLIDE,
) =>
  interpolate(frame, [start, start + duration], [from, to], {
    ...CLAMP,
    easing: EASE_IN_OUT,
  });

/** 3. snap -- any transform value, 100ms linear, no easing. */
export const snap = (
  frame: number,
  start: number,
  from: number,
  to: number,
  duration = SNAP,
) =>
  interpolate(frame, [start, start + duration], [from, to], {
    ...CLAMP,
    easing: Easing.linear,
  });

/** 4. draw -- 0 -> 1 reveal progress for a line, linear. */
export const draw = (frame: number, start: number, duration = DRAW) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: Easing.linear,
  });
