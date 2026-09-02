/**
 * Fixed geometry and timing for the hazard-symbol compositions.
 *
 * Everything time-dependent is expressed as a whole number of cycles per
 * LOOP_FRAMES so that frame N and frame N + LOOP_FRAMES are identical: the
 * composition is a seamless 20 s loop.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const LOOP_FRAMES = 600;

export const CENTER_X = WIDTH / 2;
export const CENTER_Y = HEIGHT / 2;

/** The symbol occupies ~48% of frame height, so its radius is 24% of it. */
export const SYMBOL_RADIUS = Math.round(HEIGHT * 0.24); // 518

/** Near-black disc the symbol is printed onto — slightly larger than it. */
export const DISC_RADIUS = Math.round(SYMBOL_RADIUS * 1.2); // 622

/** Thin band of plate showing through between the disc and the ring. */
export const RING_GAP = 76;
export const RING_RADIUS = DISC_RADIUS + RING_GAP;
export const RING_WIDTH = 14;

/** Thin darker outline sitting just *inside* the symbol's edge. */
export const OUTLINE_WIDTH = 10;

/** How far past the symbol outline the escaping energy wisps can reach. */
export const WISP_REACH = 76;

/**
 * The symbol and its wisps are composed in their own square layer, then
 * blitted onto the frame. Keeping symbol work off the 4K canvas is what makes
 * the per-frame cost affordable. Must be >= 2 * (SYMBOL_RADIUS + WISP_REACH)
 * and an exact multiple of NOISE_DIVISOR.
 */
export const LAYER_SIZE = 1200;

/** The shimmer's noise field is computed at 1/6 resolution and upscaled. */
export const NOISE_DIVISOR = 6;
export const NOISE_SIZE = LAYER_SIZE / NOISE_DIVISOR; // 200

/** Perforation pitch on the metal plate, in 4K pixels. */
export const PLATE_PITCH = 26;
export const PLATE_HOLE_RADIUS = 7.2;

/** Cycles per loop. Integers => the loop closes exactly at LOOP_FRAMES. */
export const RING_BREATHE_CYCLES = 3; // period 200 frames
export const RIM_GLOW_CYCLES = 4; // period 150 frames — never in step with the ring
export const DRIFT_CYCLES_X = 1;
export const DRIFT_CYCLES_Y = 2;
export const PLATE_LIGHT_CYCLES_X = 1;
export const PLATE_LIGHT_CYCLES_Y = 2;

/** The outer ring's glow breathes +/-12%. */
export const RING_BREATHE_DEPTH = 0.12;
export const RIM_GLOW_DEPTH = 0.22;

/** Opacity of the rim glow at rest. */
export const RIM_GLOW_BASE = 0.13;

/** The whole assembly drifts +/-8px on a closed path. */
export const DRIFT_AMPLITUDE = 8;

export const VIGNETTE_STRENGTH = 0.24;
export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE_SIZE = 512;
/** 8 divides 600, so tile selection closes with the loop. */
export const GRAIN_TILE_COUNT = 8;

export const TAU = Math.PI * 2;
