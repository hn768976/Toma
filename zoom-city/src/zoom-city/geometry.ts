/**
 * Frame constants and the per-frame placement of the whole composition.
 *
 * Everything here is a pure function of the frame number, and every periodic
 * term is evaluated at `frame % LOOP_FRAMES`, so frame 300 reproduces frame 0
 * bit for bit rather than merely closely.
 */

import type { Variant } from "./variants";

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const LOOP_FRAMES = 300;

/** Ambient drift of the entire composition: a closed figure-eight, ±8px. */
const DRIFT_PX = 8;

/** Total rotation excursion of the field about the vanishing point (< 3°). */
const ROTATION_DEG = 2.6;

export type Scene = {
  /** Frame number folded into the loop. Use this, never the raw frame. */
  f: number;
  /** Vanishing point, drifted. */
  vx: number;
  vy: number;
  /** Horizon line. Sits on the vanishing point and drifts with it. */
  horizonY: number;
  /** Slow rotation offset applied to every streak angle, in radians. */
  rotation: number;
  /** Distance from the vanishing point to the farthest frame corner. */
  maxRadius: number;
};

export const sceneAt = (variant: Variant, frame: number): Scene => {
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const t = (f / LOOP_FRAMES) * Math.PI * 2;

  const dx = DRIFT_PX * Math.sin(t);
  const dy = DRIFT_PX * Math.sin(t * 2);

  const vx = WIDTH * variant.vanishingPoint.x + dx;
  const vy = HEIGHT * variant.vanishingPoint.y + dy;

  const corners = [
    [0, 0],
    [WIDTH, 0],
    [0, HEIGHT],
    [WIDTH, HEIGHT],
  ];
  let maxRadius = 0;
  for (const [cx, cy] of corners) {
    maxRadius = Math.max(maxRadius, Math.hypot(cx - vx, cy - vy));
  }

  return {
    f,
    vx,
    vy,
    horizonY: vy,
    rotation: ((ROTATION_DEG / 2) * Math.PI) / 180 * Math.sin(t),
    maxRadius,
  };
};

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
