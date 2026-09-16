/**
 * The scalar "light" field that drives the halftone dot radii.
 *
 * Every term is a function of `theta = 2*PI * frame / durationInFrames` with an
 * *integer* number of turns, so the whole field is seamlessly loopable: frame 0
 * and frame `durationInFrames` are identical.
 *
 * Coordinates are aspect-corrected and normalised against the frame *height*,
 * so the field is resolution independent:
 *   nx = (x - width / 2) / height   // +-0.889 on a 16:9 frame
 *   ny = (y - height / 2) / height  // +-0.5
 */

type Blob = {
  /** Centre of the orbit. */
  ox: number;
  oy: number;
  /** Orbit radii. */
  rx: number;
  ry: number;
  /** Turns per loop - must be whole numbers to keep the loop seamless. */
  fx: number;
  fy: number;
  /** Orbit phase offsets. */
  px: number;
  py: number;
  /** Falloff width, and how much it breathes over the loop. */
  sigma: number;
  breath: number;
  breathTurns: number;
  breathPhase: number;
  /** Peak contribution. */
  weight: number;
};

const BLOBS: Blob[] = [
  {
    ox: -0.06, oy: 0.0, rx: 0.44, ry: 0.2, fx: 1, fy: 1, px: 0.0, py: 1.1,
    sigma: 0.52, breath: 0.22, breathTurns: 2, breathPhase: 0.6, weight: 1.0,
  },
  {
    ox: 0.14, oy: -0.03, rx: 0.56, ry: 0.27, fx: 2, fy: 1, px: 1.05, py: 2.4,
    sigma: 0.34, breath: 0.26, breathTurns: 3, breathPhase: 2.2, weight: 0.78,
  },
  {
    ox: -0.12, oy: 0.04, rx: 0.6, ry: 0.3, fx: 1, fy: 2, px: 2.1, py: 0.3,
    sigma: 0.3, breath: 0.3, breathTurns: 2, breathPhase: 4.0, weight: 0.72,
  },
  {
    ox: 0.02, oy: 0.0, rx: 0.72, ry: 0.34, fx: 3, fy: 2, px: 0.8, py: 3.5,
    sigma: 0.21, breath: 0.34, breathTurns: 4, breathPhase: 1.3, weight: 0.58,
  },
  {
    ox: -0.02, oy: -0.02, rx: 0.66, ry: 0.31, fx: 2, fy: 3, px: 4.0, py: 5.0,
    sigma: 0.24, breath: 0.28, breathTurns: 3, breathPhase: 5.1, weight: 0.5,
  },
];

type Wave = {
  /** Spatial frequency, in cycles per frame-height. */
  fx: number;
  fy: number;
  /** Turns per loop. */
  turns: number;
  phase: number;
  amplitude: number;
};

const WAVES: Wave[] = [
  { fx: 0.85, fy: 0.3, turns: 2, phase: 0.4, amplitude: 0.13 },
  { fx: -0.5, fy: 1.05, turns: -3, phase: 1.7, amplitude: 0.1 },
  { fx: 1.7, fy: -0.85, turns: 1, phase: 3.1, amplitude: 0.07 },
  { fx: -2.3, fy: -1.6, turns: 4, phase: 5.4, amplitude: 0.045 },
];

/**
 * Logistic response that maps the raw blob sum onto 0..1. A logistic rather
 * than a clamp keeps the bright areas from flattening into a solid slab of
 * max-size dots - the reference never fully saturates either.
 */
const RESPONSE_MIDPOINT = 1.22;
const RESPONSE_GAIN = 1.5;

const TAU = Math.PI * 2;

/** The un-normalised sum of every blob and wave. Exported for calibration. */
export const halftoneFieldRaw = (nx: number, ny: number, theta: number) => {
  let raw = 0;

  for (const b of BLOBS) {
    const cx = b.ox + b.rx * Math.cos(b.fx * theta + b.px);
    const cy = b.oy + b.ry * Math.sin(b.fy * theta + b.py);
    const sigma =
      b.sigma * (1 + b.breath * Math.sin(b.breathTurns * theta + b.breathPhase));
    const dx = nx - cx;
    const dy = ny - cy;
    raw += b.weight * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }

  for (const w of WAVES) {
    raw +=
      w.amplitude *
      Math.sin(TAU * (w.fx * nx + w.fy * ny) + w.turns * theta + w.phase);
  }

  return raw;
};

/**
 * @returns the field value at (nx, ny) in the open range 0..1, where 0 is the
 * smallest dot and 1 the largest.
 */
export const halftoneField = (nx: number, ny: number, theta: number) =>
  1 / (1 + Math.exp(-RESPONSE_GAIN * (halftoneFieldRaw(nx, ny, theta) - RESPONSE_MIDPOINT)));

/** Frame number -> loop angle. */
export const loopTheta = (frame: number, durationInFrames: number) =>
  (TAU * frame) / durationInFrames;
