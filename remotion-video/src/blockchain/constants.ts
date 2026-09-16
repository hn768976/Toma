// Timing, sizing and palette for the "blockchain data chain" 3D scene.
//
// The reference clip this matches is 20s at 30fps (600 frames) at
// 16:9. All geometry/density values below are authored at 1x (1080p)
// and scaled through `resolutionScale` so the 1080p and 4K
// compositions stay visually identical apart from pixel count.

export const FPS = 30;

// 20s, matching the reference clip exactly.
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Palette -------------------------------------------------------
// Deep navy that reads as black on a broadcast monitor but keeps a
// blue cast in the shadows, like the reference.
export const BACKGROUND_COLOR = "#01040c";

// Cube body + edge glow. The faces sit dimmer than the edges so the
// silhouette stays crisp once bloom is applied.
export const CUBE_FACE_COLOR = "#48b8ff";
export const CUBE_EDGE_COLOR = "#63c6ff";

// Background dot-matrix world map: desaturated, barely above the
// background so it never competes with the chain.
export const WORLD_MAP_COLOR = "#33587f";

// Accents scattered through the data field. Red is used sparingly --
// in the reference it is maybe 1 mark in 12.
export const ACCENT_BLUE = "#2f7fd0";
export const ACCENT_CYAN = "#57e0ff";
export const ACCENT_RED = "#ff3b3b";
export const ACCENT_WHITE = "#dceefc";

// --- Chain ---------------------------------------------------------
// Cube edge length in world units; spacing is centre-to-centre.
export const CUBE_SIZE = 1;
export const CUBE_SPACING = 1.85;

// How many cubes exist on the conveyor at once. The chain is recycled
// (a cube that passes the camera is re-inserted at the far end), so
// this is a steady-state count, not a total.
export const CHAIN_LENGTH = 20;

// World units the chain advances per frame. Over DURATION_IN_FRAMES
// this must land on a whole number of CUBE_SPACING steps for the
// motion to loop seamlessly.
export const CHAIN_STEPS_PER_LOOP = 11;
export const CHAIN_SPEED = (CHAIN_STEPS_PER_LOOP * CUBE_SPACING) / DURATION_IN_FRAMES;

// --- Data field ----------------------------------------------------
export const BASE_PARTICLE_COUNT = 1100;
export const BASE_FLOOR_MARK_COUNT = 2000;
export const BASE_NUMBER_LABEL_COUNT = 44;

// --- Post-processing ----------------------------------------------
export const BLOOM_STRENGTH = 0.46;
export const BLOOM_RADIUS = 0.85;
export const BLOOM_THRESHOLD = 0.42;

export type Layout = "diagonal" | "hero";
