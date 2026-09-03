import { Easing, interpolate } from "remotion";
import {
  CORE_MIN_RADIUS_FACTOR,
  CORE_PATH_X,
  CORE_PATH_X_FRAMES,
  CORE_PATH_Y,
  CORE_PATH_Y_FRAMES,
  T_DARK,
  T_IGNITE,
  T_PEAK_IN,
  T_PEAK_OUT,
  T_REST_IN_END,
  T_REST_IN_START,
  T_REST_OUT_END,
  T_REST_OUT_START,
  T_RING_FADE,
  T_RING_FULL,
  T_RING_IN,
  T_RING_OUT,
} from "./constants";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Core brightness, 0..1.
 *
 * Ignition is a fast ease-out (the light "catches"), the peak holds flat with
 * a barely-there flicker, and the decay is a (1-t)^1.7 falloff so brightness
 * arrives at zero with zero slope — no visible corner where the flare ends.
 */
export const coreBrightness = (frame: number): number => {
  if (frame <= T_IGNITE) return 0;
  if (frame < T_PEAK_IN) {
    return interpolate(frame, [T_IGNITE, T_PEAK_IN], [0, 1], {
      ...CLAMP,
      easing: Easing.out(Easing.cubic),
    });
  }
  if (frame < T_PEAK_OUT) {
    // A ~2% flicker on a period that divides the clip length, so the peak
    // reads as a live light source rather than a held still.
    return 1 - 0.02 * (0.5 - 0.5 * Math.cos((Math.PI * 2 * frame) / 27));
  }
  if (frame >= T_DARK) return 0;
  const t = (frame - T_PEAK_OUT) / (T_DARK - T_PEAK_OUT);
  return Math.pow(1 - t, 1.7);
};

/**
 * Core position, as fractions of frame width/height.
 *
 * Defined over the whole 270 frames rather than only the lit window, because
 * the iris ring rides the same path and stays visible after the core dies.
 */
export const corePosition = (frame: number) => ({
  x: interpolate(frame, CORE_PATH_X_FRAMES, CORE_PATH_X, CLAMP),
  y: interpolate(frame, CORE_PATH_Y_FRAMES, CORE_PATH_Y, CLAMP),
});

/** Warm falloff radius as a fraction of CORE_PEAK_RADIUS. Shrinks as it cools. */
export const coreRadiusFactor = (brightness: number): number =>
  CORE_MIN_RADIUS_FACTOR +
  (1 - CORE_MIN_RADIUS_FACTOR) * Math.pow(brightness, 0.55);

/**
 * The travelling iris ring's own envelope. It leads the core in (the ring is
 * already forming while the frame is still dark) and lags it out, which is
 * exactly what the reference does: several beats of thin bright arc over blue
 * haze with no warm light left at all.
 */
export const ringDrive = (frame: number): number =>
  interpolate(
    frame,
    [T_RING_IN, T_RING_FULL, T_PEAK_OUT, T_RING_FADE, T_RING_OUT],
    [0, 1, 1, 0.62, 0],
    { ...CLAMP, easing: Easing.inOut(Easing.quad) },
  );

/**
 * The resting ring's alpha. This is the loop's hinge: it is 1 at frame 0 and
 * back to 1 at frame 270, hands over to the travelling ring during ignition,
 * and fades back in at its home position as the travelling one leaves frame.
 */
export const restingRing = (frame: number): number =>
  interpolate(
    frame,
    [
      0,
      T_REST_OUT_START,
      T_REST_OUT_END,
      T_REST_IN_START,
      T_REST_IN_END,
      270,
    ],
    [1, 1, 0, 0, 1, 1],
    { ...CLAMP, easing: Easing.inOut(Easing.quad) },
  );

/**
 * Ghost visibility. Ghosts scale with core brightness but are deliberately
 * suppressed at full peak — at peak the warm flood swamps them, and they only
 * become readable once the core dims. This peaks around 40-50% brightness.
 */
export const ghostDrive = (brightness: number): number =>
  Math.pow(brightness, 0.55) * (0.3 + 0.7 * (1 - brightness));

/** Anamorphic streak strength — strongest at peak, gone quickly after. */
export const streakDrive = (brightness: number): number =>
  Math.pow(brightness, 1.25);
