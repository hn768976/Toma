/**
 * Every number here lives in *design space*: the composition is authored at
 * 3840x2160 and each component converts to the real frame size with the
 * `scale` factor from `useVideoConfig()`. Rendering at `--scale=0.5` therefore
 * changes nothing about the geometry, only the device pixel ratio.
 *
 * The loop is exact. Read the divisibility comments before changing anything:
 * the seamlessness of the 420-frame loop depends on every spatial period
 * dividing LOOP_DISTANCE.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 420; // 14s
export const DESIGN_WIDTH = 3840;
export const DESIGN_HEIGHT = 2160;

/** Grid: 48 and 240 both divide 3840 and 2160, so the grid tiles the frame
 *  exactly, and both halve to whole pixels in a 1080p render (24 / 120). */
export const GRID_MINOR = 48;
export const GRID_MAJOR = GRID_MINOR * 5; // 240
/** Numeric labels sit on every second major division. */
export const LABEL_SPACING = GRID_MAJOR * 2; // 480

/**
 * 16 design px per frame -> 8 whole pixels per frame at 1080p and 16 at 4K, so
 * the grid never lands between pixels and the scroll cannot shimmer.
 */
export const SCROLL_PER_FRAME = 16;

/**
 * 6720 px of travel per loop = 2^6 * 3 * 5 * 7. Every waveform period below is
 * a divisor of it, which is what makes the loop seamless: after 420 frames the
 * world has moved by exactly one period of every signal in frame.
 */
export const LOOP_DISTANCE = SCROLL_PER_FRAME * DURATION_IN_FRAMES; // 6720

// --- Waveform periods (all divide LOOP_DISTANCE) ---------------------------
export const SINE_MAIN_WAVELENGTH = LOOP_DISTANCE / 10; // 672  -> 5.71 cycles across the frame
export const SINE_SECOND_WAVELENGTH = LOOP_DISTANCE / 9; // 746.67 -> beats against the main sine once per loop
export const SQUARE_WAVELENGTH = LOOP_DISTANCE / 8; // 840 -> 4.57 cycles across the frame
export const SQUARE_DUTY = 0.42;

/**
 * Noise octaves as [lattice step in design px, weight]. Each step divides
 * LOOP_DISTANCE, so the noise repeats exactly once per loop.
 *
 * The weights deliberately load the *fine* octaves. Classic fbm (halving the
 * amplitude each octave) produces a smoothly wandering line; a raw measurement
 * trace is the opposite — a little drift carrying a lot of hash.
 */
export const NOISE_TOP_OCTAVES = [
  [240, 0.3],
  [60, 0.32],
  [24, 0.52],
  [12, 0.62],
] as const;
export const NOISE_BOTTOM_OCTAVES = [
  [480, 0.32],
  [120, 0.46],
  [32, 0.72],
  [12, 0.88],
] as const;

/** Sampling steps, chosen so every noise breakpoint lands exactly on a sample. */
export const SAMPLE_STEP_SMOOTH = 2;
export const SAMPLE_STEP_NOISE = 4;

/**
 * Vertical layout, as fractions of the 2160px design height. The traces sit in
 * separate horizontal bands rather than overlapping in one space.
 *
 * The main sine's zero line (0.4 * 2160 = 864) is the voltage axis: the
 * horizontal grid is offset so a major division falls exactly on it, and the
 * square wave's midline sits three majors below, so both read as measured
 * against the same axis rather than floated into place.
 */
export const BANDS = {
  noiseTop: { center: 0.115, amplitude: 0.036 },
  sine: { center: 0.4, amplitude: 0.172 },
  sineSecondary: { center: 0.4, amplitude: 0.105 },
  square: { center: (0.4 * DESIGN_HEIGHT + GRID_MAJOR * 3) / DESIGN_HEIGHT, amplitude: 0.048 },
  noiseBottom: { center: 0.876, amplitude: 0.056 },
} as const;

/** y of the voltage axis in design px, and the grid offset that lands on it. */
export const AXIS_Y = BANDS.sine.center * DESIGN_HEIGHT;
export const GRID_OFFSET_Y = AXIS_Y % GRID_MAJOR;

/** Amplitude modulation on the main sine: two full cycles per loop. */
export const AM_CYCLES_PER_LOOP = 2;
export const AM_DEPTH = 0.08;

/** The sweep crosses the frame twice per loop. */
export const SWEEP_CROSSINGS = 2;

// --- Axis labels -----------------------------------------------------------
/**
 * 14 values on a 480px pitch = 6720px, exactly one loop of travel, so the
 * sequence wraps at the same instant the scroll does and never drifts.
 */
export const LABEL_START = 0.09;
export const LABEL_STEP = 0.01;
export const LABEL_COUNT = LOOP_DISTANCE / LABEL_SPACING; // 14
