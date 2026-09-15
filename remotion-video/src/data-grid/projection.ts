import {
  BAND_LOG,
  BASE_HEIGHT,
  BASE_WIDTH,
  CENTER_X,
  CENTER_Y,
  CULL_MARGIN,
  CURVE,
  CYCLE_FRAMES,
  DRIFT_X_AMPLITUDE,
  DRIFT_X_PERIODS,
  DRIFT_Y_AMPLITUDE,
  DRIFT_Y_PERIODS,
  DURATION_IN_FRAMES,
  FADE_IN,
  FADE_OUT,
} from "./constants";

export type Camera = {
  /** Progress along the zoom band this frame, in bands. */
  phase: number;
  /** Parallax offset, applied before the zoom so it reads as movement. */
  driftX: number;
  driftY: number;
};

export const cameraAt = (frame: number): Camera => {
  const t = frame / DURATION_IN_FRAMES;
  return {
    phase: frame / CYCLE_FRAMES,
    driftX: Math.sin(t * Math.PI * 2 * DRIFT_X_PERIODS) * DRIFT_X_AMPLITUDE,
    driftY: Math.cos(t * Math.PI * 2 * DRIFT_Y_PERIODS) * DRIFT_Y_AMPLITUDE,
  };
};

/**
 * Where an element sits in the zoom band right now. `seed` is its
 * starting phase in [0, 1); the camera advances every element by the
 * same amount, so the whole field zooms uniformly — which is exactly
 * what the reference does.
 */
export const bandPhase = (seed: number, camera: Camera) => {
  const e = (seed + camera.phase) % 1;
  return e < 0 ? e + 1 : e;
};

/**
 * Vertical bow applied to a projected point so it lands exactly on the
 * bowed horizontal grid lines. Those lines are quadratic Beziers whose
 * control point sits at `y - CURVE * (y - CENTER_Y)`; evaluating that
 * curve at horizontal position u gives the factor below.
 */
export const bowY = (projectedX: number, projectedY: number) => {
  const u = projectedX / BASE_WIDTH;
  return projectedY - (projectedY - CENTER_Y) * 2 * CURVE * u * (1 - u);
};

/** Fade an element in as it enters the band and out as it leaves. */
export const bandFade = (e: number) =>
  Math.max(0, Math.min(1, e / FADE_IN, (1 - e) / FADE_OUT));

export type Projected = {
  x: number;
  y: number;
  /** Uniform zoom for this element: sizes and offsets both scale by it. */
  zoom: number;
  /** Position in the band, 0 entering (small) to 1 leaving (large). */
  e: number;
  fade: number;
  onScreen: boolean;
};

export const project = (
  baseX: number,
  baseY: number,
  seed: number,
  camera: Camera,
): Projected => {
  const e = bandPhase(seed, camera);
  const zoom = Math.exp(e * BAND_LOG);

  const x = CENTER_X + (baseX - camera.driftX) * zoom;
  const y = bowY(x, CENTER_Y + (baseY - camera.driftY) * zoom);

  const mx = BASE_WIDTH * CULL_MARGIN;
  const my = BASE_HEIGHT * CULL_MARGIN;

  return {
    x,
    y,
    zoom,
    e,
    fade: bandFade(e),
    onScreen: x > -mx && x < BASE_WIDTH + mx && y > -my && y < BASE_HEIGHT + my,
  };
};

/** Atmospheric haze: elements just entering sit back into the field. */
export const hazeAt = (e: number) => 1 - 0.28 * (1 - e) * (1 - e);
