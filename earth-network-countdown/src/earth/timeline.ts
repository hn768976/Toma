// Timing of the shot, measured from the reference clip (30 fps, 890 frames).

export const FPS = 30;
export const DURATION_IN_FRAMES = 890; // 29.666… s
/** The countdown starts at 00:00:20:00 and reaches zero on frame 600. */
export const COUNTDOWN_FRAMES = 600;

type Key = [number, number];

/** Piecewise smooth (smoothstep-eased) interpolation through keyframes. */
export const track = (keys: Key[], t: number): number => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * s;
    }
  }
  return keys[keys.length - 1][1];
};

/** Horizontal position of the sun along the horizon (fraction of width). */
const SUN_X: Key[] = [
  [0, 0.22],
  [5, 0.3],
  [9, 0.39],
  [12, 0.44],
  [15, 0.5],
  [19, 0.57],
  [21, 0.62],
  [23, 0.69],
  [25, 0.75],
  [27, 0.82],
  [29.7, 0.9],
];

/** Strength of the sun flare (core, rays, anamorphic streak). */
const SUN_I: Key[] = [
  [0, 0],
  [5.5, 0.0],
  [8, 0.4],
  [10, 0.9],
  [13, 1.0],
  [16, 0.9],
  [19, 0.75],
  [21.5, 0.55],
  [22.5, 0.25],
  [23.5, 0.05],
  [24.5, 0],
];

/** Warmth / strength of the sunlit rim, crescent and city lights. */
const RIM_I: Key[] = [
  [0, 0.0],
  [1.5, 0.12],
  [3, 0.5],
  [6, 0.8],
  [10, 1.0],
  [15, 1.0],
  [20, 0.8],
  [23, 0.62],
  [26, 0.45],
  [28, 0.22],
  [29.7, 0.04],
];

export const sunState = (t: number) => ({
  x: track(SUN_X, t),
  flare: track(SUN_I, t),
  rim: track(RIM_I, t),
});

/** Short digital-glitch bursts: [first frame, length, strength]. */
const GLITCHES: [number, number, number][] = [
  [2, 4, 0.6],
  [168, 4, 0.7],
  [300, 3, 0.55],
  [340, 6, 0.9],
  [418, 4, 0.6],
  [450, 3, 0.75],
  [636, 10, 1.0],
  [658, 4, 0.7],
  [704, 6, 0.8],
  [716, 6, 0.9],
  [745, 5, 0.6],
  [820, 4, 0.6],
];

export const glitchAt = (frame: number) => {
  for (const [start, len, strength] of GLITCHES) {
    if (frame >= start && frame < start + len) {
      // stronger in the middle of the burst
      const u = (frame - start + 0.5) / len;
      return { amount: strength * (0.55 + 0.45 * Math.sin(Math.PI * u)), seed: frame * 1.618 + start };
    }
  }
  return { amount: 0, seed: frame * 1.618 };
};

export const timecode = (frame: number) => {
  const remaining = Math.max(0, COUNTDOWN_FRAMES - frame);
  const secs = Math.floor(remaining / FPS);
  const frames = remaining % FPS;
  const pad = (v: number) => String(v).padStart(2, "0");
  return ["00", "00", pad(secs), pad(frames)];
};
