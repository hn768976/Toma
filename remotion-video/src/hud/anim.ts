import { interpolate } from "remotion";
import { LOOP } from "./constants";

// A readout that ramps from `from` to `target` across the clip and
// holds, the way the reference's percentage counters climb over its 20
// seconds. `delay`/`span` are fractions of the loop. Widgets that should
// already read as populated at frame 0 (bar charts, dials) pass a
// non-zero `from` so they are never sitting empty mid-clip.
export const rampTo = (
  frame: number,
  target: number,
  delay = 0,
  span = 0.92,
  from = 0,
) => {
  const t = interpolate(
    frame,
    [LOOP * delay, LOOP * Math.min(1, delay + span)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Slight ease so the counters do not feel mechanically linear.
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return from + (target - from) * eased;
};

// A value that wobbles around `base` and returns to exactly `base` at the
// loop point. `cycles` must be a whole number to stay seamless.
export const wobble = (
  frame: number,
  base: number,
  amount: number,
  cycles: number,
  phase = 0,
) => base + amount * Math.sin(((frame / LOOP) * cycles + phase) * Math.PI * 2);

/** 0..1 sawtooth completing `cycles` whole passes per loop. */
export const saw = (frame: number, cycles: number, phase = 0) =>
  (((frame / LOOP) * cycles + phase) % 1 + 1) % 1;

export const pad = (n: number, width: number) =>
  Math.round(n).toString().padStart(width, "0");
