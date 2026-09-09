import { easeInOutCubic, easeInOutCubicIntegral } from "./math";

export type WarpMode = "arc" | "loop";

/**
 * Speed is measured in "traversals per frame": one traversal is a particle
 * travelling the whole way from the birth radius R0 out past the frame
 * diagonal. At peak warp a particle crosses the frame in 1 / PEAK_RATE ~ 8
 * frames, which is what makes the one-frame segments long enough to read
 * as motion blur.
 *
 * PEAK_RATE is deliberately 72 / 600: the loop composition is 600 frames, so
 * the whole population cycles exactly 72 times and frame 600 lands back on
 * frame 0. 72 is also a multiple of ANGLE_CYCLE_SLOTS (12), which is the
 * other half of the seam — see field.ts.
 */
export const PEAK_RATE = 0.12;
/** Calm drift, as a fraction of peak. Slow enough to render as points. */
export const CALM_FACTOR = 0.005;
export const CALM_RATE = PEAK_RATE * CALM_FACTOR;

/** Arc keyframes, in frames, for the 450-frame compositions. */
export const ARC = {
  calmInEnd: 60,
  rampUpEnd: 150,
  peakEnd: 300,
  rampDownEnd: 390,
  end: 450,
} as const;

const RAMP = ARC.rampUpEnd - ARC.calmInEnd; // 90 frames, both ramps

/** Normalised speed in [0, 1]: 0 = calm starfield, 1 = full warp. */
export const speedNorm = (frame: number, mode: WarpMode): number => {
  if (mode === "loop") return 1;
  if (frame <= ARC.calmInEnd) return 0;
  if (frame < ARC.rampUpEnd) return easeInOutCubic((frame - ARC.calmInEnd) / RAMP);
  if (frame <= ARC.peakEnd) return 1;
  if (frame < ARC.rampDownEnd) return easeInOutCubic(1 - (frame - ARC.peakEnd) / RAMP);
  return 0;
};

/** Integral of speedNorm from 0 to `frame`, in closed form. */
const speedNormIntegral = (frame: number, mode: WarpMode): number => {
  if (mode === "loop") return Math.max(0, frame);
  if (frame <= ARC.calmInEnd) return 0;
  if (frame < ARC.rampUpEnd) {
    return RAMP * easeInOutCubicIntegral((frame - ARC.calmInEnd) / RAMP);
  }
  const rampUpArea = RAMP * 0.5; // 45
  if (frame <= ARC.peakEnd) return rampUpArea + (frame - ARC.rampUpEnd);
  const peakArea = ARC.peakEnd - ARC.rampUpEnd; // 150
  if (frame < ARC.rampDownEnd) {
    const y = (frame - ARC.peakEnd) / RAMP;
    return rampUpArea + peakArea + RAMP * (0.5 - easeInOutCubicIntegral(1 - y));
  }
  return rampUpArea + peakArea + RAMP * 0.5; // 240
};

/**
 * D(frame): total distance travelled, in traversals, since frame 0.
 * Closed form, so any frame can be rendered on its own in any order.
 * Defined for negative frames too — the previous-frame position at frame 0
 * needs D(-1).
 */
export const travelled = (frame: number, mode: WarpMode): number => {
  if (mode === "loop") return PEAK_RATE * frame;
  return CALM_RATE * frame + (PEAK_RATE - CALM_RATE) * speedNormIntegral(frame, mode);
};

/**
 * Cumulative field rotation in radians. Only during the warp, so the calm
 * head and tail of the arc line up. Omitted entirely in loop mode, where any
 * non-zero rate would break the seam (1 deg/s over 20s is not a whole
 * number of revolutions).
 */
export const FIELD_ROTATION_DEG_PER_SEC = 1;

export const fieldRotation = (frame: number, mode: WarpMode, fps: number): number => {
  if (mode === "loop") return 0;
  const radPerSpeedFrame = ((FIELD_ROTATION_DEG_PER_SEC * Math.PI) / 180) / fps;
  return radPerSpeedFrame * speedNormIntegral(frame, mode);
};
