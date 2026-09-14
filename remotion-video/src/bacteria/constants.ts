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
 * Every version ends on a short white-on-black matte tail, the way the
 * reference stock clips carry their alpha -- but kept to a few seconds
 * rather than the half-and-half split those clips use, so the colour
 * pass gets nearly the whole runtime.
 *
 * The motion runs straight through the cut: the matte picks up the
 * scene exactly where the colour pass left it, so the tail reads as a
 * deliberate ending rather than a jump back to the top.
 */
export const MATTE_TAIL_SECONDS = 2.5;

/** Model bounding box (metres, from the GLB accessor min/max). */
export const MODEL_HALF_EXTENT = { x: 0.9509, y: 0.4911, z: 0.3153 };
