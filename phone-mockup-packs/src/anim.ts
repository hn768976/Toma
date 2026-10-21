// Pure, frame-driven animation helpers. Nothing here reads a clock.

export type Vec3 = [number, number, number];

export const DEG = Math.PI / 180;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const add3 = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];

export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

// Ease-out-back tuned so the peak overshoot is ~2% of the travel:
// peak = 4c^3 / (27 (c+1)^2) = 0.02  ->  c = 0.745
const OVERSHOOT_C = 0.745;
export const easeOutSettle = (t: number) => {
  const u = clamp01(t) - 1;
  return 1 + (OVERSHOOT_C + 1) * u * u * u + OVERSHOOT_C * u * u;
};

export const easeInCubic = (t: number) => {
  const c = clamp01(t);
  return c * c * c;
};

export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));

export const easeInOutCubic = (t: number) => {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

// Monotonic "glide": quick at the ends, slow through the middle.
export const glide = (t: number) => {
  const c = clamp01(t);
  return c - (0.115 * Math.sin(2 * Math.PI * c));
};

// 0 -> 1 -> 0 bump with eased shoulders.
export const thereAndBack = (t: number) => Math.sin(Math.PI * easeInOutSine(t));

export const progress = (f: number, start: number, duration: number) =>
  clamp01((f - start) / duration);

// Gentle hold float: +-0.5% of frame height vertically, +-1 degree of tilt.
// Driven by the global frame so match-cuts between segments stay continuous.
export const float = (globalFrame: number, seed: number, frameHeightUnits: number) => {
  const g = globalFrame;
  const tau = Math.PI * 2;
  return {
    y: 0.005 * frameHeightUnits * Math.sin((tau * g) / 96 + seed * 1.7),
    rx: 0.6 * DEG * Math.sin((tau * g) / 118 + seed * 2.9),
    rz: 1.0 * DEG * Math.sin((tau * g) / 134 + seed * 2.3 + 0.8),
  };
};

export type MotionOpts = {
  enter?: number; // frames of the entrance
  exit?: number; // frames of the exit (0 = hold to the end)
  delay?: number; // entrance stagger
  exitDelay?: number; // exit stagger, counted back from the end
};

// Enter -> hold -> exit position along three keyframes, plus an eased drift
// vector applied over the hold so nothing ever sits perfectly still.
export const travel = (
  f: number,
  L: number,
  from: Vec3,
  mid: Vec3,
  to: Vec3 | null,
  opts: MotionOpts = {},
  drift: Vec3 = [0, 0, 0],
): Vec3 => {
  const enter = opts.enter ?? 34;
  const exit = to ? (opts.exit ?? 26) : 0;
  const delay = opts.delay ?? 0;
  const exitDelay = opts.exitDelay ?? 0;
  const inP = easeOutSettle(progress(f, delay, enter));
  let p = lerp3(from, mid, inP);
  const exitStart = L - 2 - exit - exitDelay;
  const holdT = easeInOutSine(progress(f, delay + enter * 0.6, exitStart - delay - enter * 0.6));
  p = add3(p, scale3(drift, holdT));
  if (to) {
    const outP = easeInCubic(progress(f, exitStart, exit));
    p = lerp3(p, add3(to, drift), outP);
  }
  return p;
};

// Weight that is 0 before the entrance, 1 through the hold, back to 0 on exit.
export const holdWeight = (f: number, L: number, enter = 34, exit = 26) =>
  Math.min(easeInOutSine(progress(f, enter * 0.5, enter * 0.8)), 1 - easeInOutSine(progress(f, L - exit - 10, exit)));
