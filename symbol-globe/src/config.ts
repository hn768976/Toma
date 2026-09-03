/**
 * Timing and geometry. Colours live in variants.ts and never here.
 *
 * Every periodic quantity in the piece is expressed as a whole number of cycles
 * across DURATION_IN_FRAMES, so the state at frame 450 is identical to frame 0
 * and the loop closes without a cut.
 */
export const FPS = 30;
export const DURATION_IN_FRAMES = 450;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Globe diameter as a fraction of frame height. */
export const GLOBE_DIAMETER_RATIO = 0.52;

/** Centre glyph height as a fraction of frame height. */
export const CENTRE_GLYPH_HEIGHT_RATIO = 0.4;

/** Tilt of the globe's axis, in degrees; constant, so it does not affect the loop. */
export const GLOBE_TILT_DEG = -18;

/** Angular spacing of the land dot sample grid, in degrees. */
export const DOT_STEP_DEG = 1.5;

/** Dot diameter at the sphere's centre and at its limb, in 4K pixels. */
export const DOT_SIZE_CENTRE = 7;
export const DOT_SIZE_LIMB = 4;

/** Great-circle arcs drawn across the globe's face. */
export const ARC_CENTRES: [number, number][] = [
  [20, 62],
  [-102, 8],
  [138, -34],
  [64, -72],
];

/** Scattered field glyphs. */
export const FIELD_GLYPH_COUNT = 45;
export const FIELD_SIZE_MIN = 20;
export const FIELD_SIZE_MAX = 90;

/**
 * Field glyphs are kept out of a disc this many globe-radii wide, so the centre
 * of frame stays clean and the centre glyph has nothing competing with it.
 */
export const FIELD_EXCLUSION_RATIO = 1.3;

/** Ambient camera drift, in 4K pixels, on a closed path. */
export const AMBIENT_DRIFT_PX = 10;

/** Pixel dimensions the tuning constants above were chosen at. */
export const DESIGN_HEIGHT = 2160;
