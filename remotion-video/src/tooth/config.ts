/**
 * Shared configuration for the 12 dental 3D versions.
 *
 * Every version is authored against a 1920x1080 "design frame" and rendered at
 * two resolutions (HD and UHD) from the exact same component. Anything measured
 * in pixels must therefore be multiplied by `pxScale` (see `usePxScale`) so the
 * 4K render is a true 2x of the 1080p one rather than a differently-weighted
 * image.
 */

export const FPS = 30;

export const HD = { width: 1920, height: 1080 } as const;
export const UHD = { width: 3840, height: 2160 } as const;

/** The resolution every version is authored against. */
export const DESIGN_WIDTH = HD.width;
export const DESIGN_HEIGHT = HD.height;

/**
 * Durations are taken from the reference clip each version matches, re-timed to
 * 30fps and rounded to the nearest whole frame.
 */
export const secondsToFrames = (seconds: number) => Math.round(seconds * FPS);

export const MODELS = {
  /** 188k triangles - the hero mesh, used for every solid/glossy version. */
  full: "models/tooth-full.bin",
  /** 21k triangles - used where a visible but fine mesh topology is wanted. */
  mid: "models/tooth-midpoly.bin",
  /** 5k triangles - the deliberate low-poly look of the wireframe versions. */
  low: "models/tooth-lowpoly.bin",
  /** 24k area-weighted surface samples, pre-shuffled. */
  points: "models/tooth-points.bin",
} as const;
