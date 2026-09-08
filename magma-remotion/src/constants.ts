export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s

/**
 * Field parameters, shared by all three versions — the versions differ only in
 * their colour ramp.
 *
 * The two `Rate` values are radii of the circle each noise field walks through
 * its time axis, not angular speeds: every field completes exactly one lap per
 * loop, and a smaller radius simply covers less noise space on the way round.
 * That is how the warp evolves slower than the cellular field while both still
 * close perfectly at frame 600.
 */
export const FIELD = {
  cells: 9.5, // cells across the frame width
  warpAmp1: 0.62,
  warpFreq1: 0.40,
  warpRate1: 0.65, // slow: the big swirl
  warpAmp2: 0.32,
  warpFreq2: 1.35,
  warpRate2: 1.40,
  jitter: 0.3, // feature-point orbit radius, in cell units
  cellCycles: 3, // whole orbits per loop — must stay an integer
  cells2: 3.4, // second cellular octave, as a multiple of the first
  cellCycles2: 8, // must stay an integer
  filigree: 0.30,
  plateMin: 0.18, // crust island radius, in cell units
  plateVar: 0.40,
  speck: 0.5,
  veinW: 0.26,
  contourN: 5.0, // iso-levels per cell => concentric rings
  bloom: 0.10,
  pulse: 0.07,
  pulseCycles: 5, // must stay an integer
  grain: 0.02,
  crust: 0.055,
  advAmp: 1.35, // advection radius, in cell units
  advFreq: 0.45,
} as const;
