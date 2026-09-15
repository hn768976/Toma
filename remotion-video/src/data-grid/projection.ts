import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CENTER_X,
  CENTER_Y,
  CULL_MARGIN,
  CURVE,
  DRIFT_X_AMPLITUDE,
  DRIFT_X_PERIODS,
  DRIFT_Y_AMPLITUDE,
  DRIFT_Y_PERIODS,
  DURATION_IN_FRAMES,
  FADE_IN,
  FADE_OUT,
  FOCAL,
  TRAVEL_PER_FRAME,
  Z_DEPTH,
  Z_NEAR,
} from "./constants";

export type Camera = {
  /** How far the camera has flown down +z by this frame. */
  travel: number;
  /** Lateral offset in world units, so it parallaxes with depth. */
  driftX: number;
  driftY: number;
};

export const cameraAt = (frame: number): Camera => {
  const t = frame / DURATION_IN_FRAMES;
  return {
    travel: frame * TRAVEL_PER_FRAME,
    driftX: Math.sin(t * Math.PI * 2 * DRIFT_X_PERIODS) * DRIFT_X_AMPLITUDE,
    driftY: Math.cos(t * Math.PI * 2 * DRIFT_Y_PERIODS) * DRIFT_Y_AMPLITUDE,
  };
};

/**
 * Wrap a seeded depth into the live slab for this frame. Elements that
 * fly past the camera reappear at the back, so the field never runs out.
 */
export const wrapDepth = (worldZ: number, travel: number) => {
  const raw = worldZ - travel;
  return (((raw % Z_DEPTH) + Z_DEPTH) % Z_DEPTH) + Z_NEAR;
};

/**
 * A gentle barrel warp, as though through a wide lens. Only y is bowed,
 * by a factor that peaks at mid-frame and vanishes at the edges.
 */
export const bowY = (projectedX: number, projectedY: number) => {
  const u = projectedX / BASE_WIDTH;
  return projectedY - (projectedY - CENTER_Y) * 2 * CURVE * u * (1 - u);
};

export type Projected = {
  x: number;
  y: number;
  /** Perspective scale: world units -> base pixels at this depth. */
  scale: number;
  /** 0 at the near clip, 1 at the far clip. */
  depth: number;
  /** Fades to 0 at both ends of the slab, so recycling is invisible. */
  fade: number;
  onScreen: boolean;
};

export const project = (
  worldX: number,
  worldY: number,
  worldZ: number,
  camera: Camera,
): Projected => {
  const z = wrapDepth(worldZ, camera.travel);
  const scale = FOCAL / z;

  const x = CENTER_X + (worldX - camera.driftX) * scale;
  const y = bowY(x, CENTER_Y + (worldY - camera.driftY) * scale);

  const depth = (z - Z_NEAR) / Z_DEPTH;
  const mx = BASE_WIDTH * CULL_MARGIN;
  const my = BASE_HEIGHT * CULL_MARGIN;

  return {
    x,
    y,
    scale,
    depth,
    fade: Math.max(
      0,
      Math.min(1, depth / FADE_OUT, (1 - depth) / FADE_IN),
    ),
    onScreen: x > -mx && x < BASE_WIDTH + mx && y > -my && y < BASE_HEIGHT + my,
  };
};

/**
 * Aerial perspective: distant elements sink back toward the background.
 * A strong falloff here is most of what sells the depth.
 */
export const hazeAt = (depth: number) => 1 - 0.38 * depth * depth;
