/**
 * Shared timing + geometry constants for the "Gold Tile Field" motion loop.
 *
 * The reference clip is 768x432, exactly 30fps, 450 frames (15.000s) and is a
 * seamless loop. Everything below is built so that the state at t = LOOP_SECONDS
 * is bit-identical to the state at t = 0: every temporal frequency in the scene
 * is an integer multiple of 2*PI / LOOP_SECONDS.
 */

export const FPS = 30;
export const LOOP_SECONDS = 15;
export const DURATION_IN_FRAMES = FPS * LOOP_SECONDS; // 450

/** Delivery format. */
export const WIDTH_1080 = 1920;
export const HEIGHT_1080 = 1080;

/** Master format kept in the project so a 4K render is one CLI call away. */
export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

/** Number of tiles along each grid axis. GRID_N^2 instances are drawn. */
export const GRID_N = 168;

/** Centre-to-centre spacing of the tiles, in world units. */
export const PITCH = 1;

/** Footprint of one tile. The remainder of the pitch becomes the dark gap. */
export const TILE_SIZE = 0.8;

/** Extrusion height of a tile above the wave surface. */
export const TILE_HEIGHT = 0.16;

/** How far the tile skirt hangs below the surface (hides gaps at grazing angles). */
export const TILE_DEPTH = 0.45;

/** Size of the 45-degree chamfer that catches the specular highlight. */
export const TILE_CHAMFER = 0.06;

/**
 * The travelling wave field that displaces the grid.
 *
 * `harmonic` is the number of whole cycles the wave completes across one loop,
 * which is what keeps the loop seamless. `dir` is the (unnormalised) direction
 * of travel in the XZ plane.
 */
export type Wave = {
  amplitude: number;
  wavelength: number;
  dir: [number, number];
  harmonic: number;
  phase: number;
};

export const WAVES: Wave[] = [
  { amplitude: 2.05, wavelength: 52, dir: [0.34, 0.94], harmonic: 1, phase: 0.0 },
  { amplitude: 1.15, wavelength: 31, dir: [-0.82, 0.57], harmonic: -2, phase: 1.7 },
  { amplitude: 0.52, wavelength: 18.5, dir: [0.9, -0.44], harmonic: 3, phase: 3.1 },
  { amplitude: 0.28, wavelength: 10.5, dir: [0.21, 0.98], harmonic: -5, phase: 5.4 },
  { amplitude: 0.1, wavelength: 6.2, dir: [-0.62, -0.78], harmonic: 8, phase: 2.2 },
];

/** How far the centre of a tile's top bulges above its rim. */
export const TILE_DOME_RISE = 0.045;

/** Subdivision of the domed top face, per axis. */
export const TILE_TOP_SEGMENTS = 3;

/**
 * Random per-tile tilt, in radians-ish. Without it every tile in a
 * neighbourhood shares a normal and the field reads as one smooth sheet; this
 * is what gives the surface its grain and its sparkle.
 */
export const TILE_TILT_JITTER = 0.032;
