import {
  BASE_BLUR_PX,
  BASE_DOT_RADIUS,
  BASE_HEIGHT,
  BASE_WIDTH,
  BOKEH_PER_UNIT,
  CURVE_X,
  CURVE_Y,
  FOCAL,
  FOCUS_Z,
  FOG_DISTANCE,
  PLANE_DISTANCE,
  X_AMPLITUDE,
  X_EXTENT,
  Y_AMPLITUDE,
  Y_EXTENT,
  Z_AMPLITUDE,
} from "./constants";

export type WaveGeometry = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  focal: number;
  planeDistance: number;
  curveX: number;
  curveY: number;
  xExtent: number;
  yExtent: number;
  zAmplitude: number;
  xAmplitude: number;
  yAmplitude: number;
  focusZ: number;
  bokehPerUnit: number;
  fogDistance: number;
  baseDotRadius: number;
  blurPx: number;
  scale: number;
};

// Derives render geometry for a resolution multiple (1 = 1080p, 2 = 4K).
// Every length scales linearly, so the 4K frame is the 1080p frame at twice
// the sampling rate — same composition, same particle count, more detail.
export const computeWaveGeometry = (resolutionScale: number): WaveGeometry => {
  const s = resolutionScale;
  const width = BASE_WIDTH * s;
  const height = BASE_HEIGHT * s;
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    focal: FOCAL * s,
    planeDistance: PLANE_DISTANCE * s,
    curveX: CURVE_X * s,
    curveY: CURVE_Y * s,
    xExtent: X_EXTENT * s,
    yExtent: Y_EXTENT * s,
    zAmplitude: Z_AMPLITUDE * s,
    xAmplitude: X_AMPLITUDE * s,
    yAmplitude: Y_AMPLITUDE * s,
    focusZ: FOCUS_Z * s,
    // Radius grows per unit of Z, and Z itself scaled by s, so the
    // coefficient stays as authored to keep blur-in-pixels scaling by s.
    bokehPerUnit: BOKEH_PER_UNIT,
    fogDistance: FOG_DISTANCE * s,
    baseDotRadius: BASE_DOT_RADIUS * s,
    blurPx: BASE_BLUR_PX * s,
    scale: s,
  };
};
