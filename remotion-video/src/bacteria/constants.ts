// Shared config for the microscopic-bacteria series.
//
// All eleven compositions are authored at 4K (3840x2160). The 1080p
// deliverables are rendered from the very same compositions with
// `--scale=0.5`, so there is a single source of truth per version and
// the two resolutions can never drift apart.
//
// Everything that is measured in CSS pixels (blur radii, grain size,
// vignette spread) is authored at 1080p and multiplied by the
// resolution scale at use time; everything expressed in world units
// (camera, model placement) is resolution independent already.

export const FPS = 30;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const WIDTH_4K = BASE_WIDTH * 2;
export const HEIGHT_4K = BASE_HEIGHT * 2;

/** The supplied Meshy bacillus. Position-only; normals/UVs are derived. */
export const MODEL_SRC = "models/bacillus.glb";

/**
 * Each version is delivered as two separate files: the colour pass, and
 * its matte as a standalone clip of the same length. Both run the same
 * timeline from the same seed, so frame n of the matte is exactly the
 * alpha of frame n of the colour -- a full-length key, not a sample.
 */
export const PASSES = ["colour", "matte"] as const;

export type Pass = (typeof PASSES)[number];

/** Model bounding box (metres, from the GLB accessor min/max). */
export const MODEL_HALF_EXTENT = { x: 0.9509, y: 0.4911, z: 0.3153 };
