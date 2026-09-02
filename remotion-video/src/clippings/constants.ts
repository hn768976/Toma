/**
 * Geometry and timing shared by both clipping variants.
 *
 * The loop closes because the whole wall is laid out on a *lattice*: one
 * block of clippings is generated and drawn several times, each copy offset
 * by an integer multiple of the lattice vector (BLOCK_W, BLOCK_DY). Over the
 * 420 frames the layer translates by exactly one lattice vector, so frame 420
 * is pixel-identical to frame 0 — copy k has slid into the place copy k-1
 * occupied at frame 0, and every copy holds the same content.
 *
 * A pure horizontal tile could not drift "slightly down"; shearing the
 * lattice by BLOCK_DY lets the drift run along any shallow diagonal while
 * still closing exactly.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 420;

/** Lattice vector for the clipping layer. */
export const BLOCK_W = 5600;
export const BLOCK_DY = 190;

/**
 * The wall uses its own, shorter lattice, so it drifts at half the speed of
 * the clippings along the same diagonal. That gives a hint of parallax and
 * still closes: over 420 frames the wall advances exactly one wall-lattice
 * step.
 */
export const WALL_BLOCK_W = BLOCK_W / 2;
export const WALL_BLOCK_DY = BLOCK_DY / 2;
export const WALL_BLOCK_BLEED = 320;

/** Copies of each block that are considered per frame (then culled). */
export const COPY_RANGE = 2;

/** Scale advantage given to clippings near the leading edge (fraction). */
export const LEAD_SCALE = 0.035;

/** Ambient camera drift, peak pixels on a closed path. */
export const CAMERA_DRIFT = 10;

/** Vignette strength at the corners. */
export const VIGNETTE_STRENGTH = 0.24;

/** Film grain alpha. */
export const GRAIN_ALPHA = 0.05;
export const GRAIN_TILE = 1024;
export const GRAIN_TILE_COUNT = 3;
