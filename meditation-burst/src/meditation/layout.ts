import { VariantConfig } from "./variants";

/** 20.0s at 30fps. Every periodic motion in the piece divides this. */
export const LOOP = 600;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const TAU = Math.PI * 2;

/**
 * Geometry measured off `public/lotus.svg`, expressed as fractions of
 * the figure's own bounding box so it survives any render size.
 */
export const FIGURE_ASPECT = 378 / 438;
/** Centre of the head, as a fraction of figure height below its top. */
export const HEAD_CENTER_Y = 0.103;
/** Centre of the head, as a fraction of figure width from its left. */
export const HEAD_CENTER_X = 0.4735;
/** Headroom added above the figure's box so the hair bun has somewhere to go. */
export const FIGURE_PAD_TOP = 0.12;

export type Layout = {
  width: number;
  height: number;
  horizonY: number;
  figureHeight: number;
  figureWidth: number;
  figureLeft: number;
  figureTop: number;
  /** The burst origin: directly behind the figure's head. */
  originX: number;
  originY: number;
  /** Distance from the origin to the furthest frame corner. */
  maxRadius: number;
  coreRadius: number;
};

export const computeLayout = (
  config: VariantConfig,
  width = WIDTH,
  height = HEIGHT,
): Layout => {
  const horizonY = Math.round(height * config.horizonFraction);
  const figureHeight = height * config.figureFraction;
  const figureWidth = figureHeight * FIGURE_ASPECT;
  const figureLeft = width / 2 - figureWidth / 2;
  const figureTop = horizonY - figureHeight;
  const originX = figureLeft + figureWidth * HEAD_CENTER_X;
  const originY = figureTop + figureHeight * HEAD_CENTER_Y;
  const maxRadius = Math.max(
    Math.hypot(originX, originY),
    Math.hypot(width - originX, originY),
    Math.hypot(originX, height - originY),
    Math.hypot(width - originX, height - originY),
  );
  return {
    width,
    height,
    horizonY,
    figureHeight,
    figureWidth,
    figureLeft,
    figureTop,
    originX,
    originY,
    maxRadius,
    coreRadius: height * config.coreGlow.radiusFraction,
  };
};

/**
 * Ambient camera drift: a closed Lissajous path, so frame 0 and frame
 * LOOP land on the same offset. No other camera motion exists.
 */
export const cameraDrift = (frame: number): { x: number; y: number } => ({
  x: 8 * Math.sin((TAU * frame) / LOOP),
  y: 8 * Math.sin((2 * TAU * frame) / LOOP + Math.PI / 3),
});

/** The figure's ±0.6% breath, on a 150-frame sine (4 breaths per loop). */
export const breathScale = (frame: number): number =>
  1 + 0.006 * Math.sin((TAU * frame) / 150);

/**
 * Core-glow brightness over the loop.
 *
 * "breathe" is a steady ±10% sine. "accumulate" starts dim, climbs to a
 * peak at frame 480 as the converging filaments feed it, then eases back
 * to its frame-0 value by 600 — matching value *and* slope at the wrap,
 * so the loop closes without a visible kick.
 */
export const coreGlowLevel = (
  frame: number,
  mode: "breathe" | "accumulate",
): number => {
  if (mode === "breathe") {
    return 1 + 0.1 * Math.sin((TAU * frame) / LOOP - Math.PI / 2);
  }
  const peak = 480;
  const shape =
    frame <= peak
      ? (1 - Math.cos((Math.PI * frame) / peak)) / 2
      : (1 + Math.cos((Math.PI * (frame - peak)) / (LOOP - peak))) / 2;
  // A wide range on purpose: several hundred filaments converging on the
  // origin already keep the centre bright, so a timid swing would be
  // invisible under them. The core has to be genuinely dim at frame 0
  // for the build to read.
  return 0.35 + 1.15 * shape;
};
