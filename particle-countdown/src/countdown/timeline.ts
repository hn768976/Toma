/**
 * Timing of the particle countdown (30 fps, 345 frames = 11.5 s).
 *
 * Measured from the reference clip's luminance curve: a new number peaks every
 * 30 frames, the first ("10") at frame ~26 and the last ("1") at ~frame 297 (the
 * shader's flash lags the formation peak by ~2 frames, so peaks are set at 24 + 30·i).
 * Each number condenses out of glitter during the ~22 frames before its peak,
 * flashes, then bursts into a drifting cloud of glitter/bokeh over ~40 frames
 * while the next number condenses in the same place. After "1" dissolves the
 * screen settles to true black (≈ frame 324 → 345).
 */
export const FPS = 30;
export const DURATION = 345;

export const DIGITS = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1"] as const;
export const FIRST_PEAK = 24;
export const PERIOD = 30;

export const peakFrame = (i: number) => FIRST_PEAK + i * PERIOD;

/** Frames before the peak at which a number starts to condense. */
export const FORM_FRAMES = 24;
/** Frames after the peak during which the number's particles are alive. */
export const DISSOLVE_FRAMES = 40;

export const isDigitActive = (i: number, frame: number) => {
  const t = frame - peakFrame(i);
  return t > -FORM_FRAMES - 2 && t < DISSOLVE_FRAMES + 2;
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Ambient floating dust: fades in with the first number, out after the last. */
export const ambientLevel = (frame: number) =>
  smoothstep(6, 30, frame) * (1 - smoothstep(290, 318, frame));
