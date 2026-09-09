/**
 * Every length in this project is authored in a fixed 3840x2160 "design space"
 * and scaled to whatever the composition's real width is at draw time. That way
 * the 1080p preview is a true miniature of the 4K master rather than a
 * separately tuned look.
 */
export const DESIGN_W = 3840;
export const DESIGN_H = 2160;

export const FPS = 30;
export const DURATION = 600; // 20s

// --- Motion -----------------------------------------------------------------

/** Total drift across the clip: 7% of frame height, down and slightly left. */
export const DRIFT_Y = DESIGN_H * 0.07; // 151.2px
export const DRIFT_X = -DRIFT_Y * 0.12; // ~-18px, "slightly left"

/** Parallax rates, front plane to back plane. */
export const PLANE_RATES = [1, 0.85, 0.7, 0.55] as const;

/** ~12,000 stars: fewer and brighter up front, denser and fainter behind. */
export const PLANE_COUNTS = [1800, 2600, 3400, 4200] as const;

export const HERO_COUNT = 25;

/**
 * Peak-to-peak camera roll, in degrees, driven by a full sine cycle so frame 600
 * lands exactly back on frame 0.
 */
export const ROLL_DEG = 0.3;

/** Peak zoom, as a fraction. Full raised-cosine cycle, so it also returns home. */
export const ZOOM_AMT = 0.015;

/** Constant overscan so the roll never swings an empty corner into frame. */
export const BASE_SCALE = 1.03;

// --- Star field -------------------------------------------------------------

/**
 * Stars are generated across the frame plus this margin so nothing thins out at
 * the edges once drift and the respawn cycle are applied.
 */
export const SPAWN_MARGIN = 280;

/** Point-star core diameter in 4K pixels. The soft sprite adds a halo on top. */
export const STAR_CORE_MIN = 1;
export const STAR_CORE_MAX = 3;

/** How much wider the drawn sprite is than the star's bright core. */
export const POINT_SPRITE_RATIO = 3.2;
export const HERO_SPRITE_RATIO = 7;

export const STAR_ALPHA_MIN = 0.2;
export const STAR_ALPHA_MAX = 0.95;

export const HERO_CORE_MIN = 8;
export const HERO_CORE_MAX = 16;

/**
 * Never let a sprite collapse below this many *output* pixels. At 1080p a 1px
 * 4K star would otherwise land on half a pixel and disappear; we clamp the size
 * and pay the brightness back so the preview keeps the master's density.
 */
export const MIN_SPRITE_PX = 1.35;
export const MIN_SPRITE_ENERGY_EXP = 1.6;

// --- Dust band --------------------------------------------------------------

/** Band axis, degrees. Negative runs lower-left to upper-right on screen. */
export const BAND_ANGLE_DEG = -32;
/** Gaussian half-width of the band, in 4K pixels. */
export const BAND_SIGMA = 430;
/** Band centre offset along the band normal (negative nudges it up-screen). */
export const BAND_OFFSET = -70;
/** Spawn probability away from the band. 1.0 would mean "no band at all". */
export const BAND_FLOOR = 0.1;
/** Extra brightness for stars that land inside the band. */
export const BAND_BRIGHTNESS = 0.22;

/** Large-scale clumping so the field never reads as an even sprinkle. */
export const CLUMP_PERIOD = 3; // lattice cells across the spawn area
export const CLUMP_STRENGTH = 0.45;

// --- Twinkle & loop ---------------------------------------------------------

/** Twinkle periods in frames. Every one divides 600 exactly. */
export const TWINKLE_PERIODS = [600, 300, 200, 150, 120] as const;
export const TWINKLE_DEPTH_MIN = 0.12;
export const TWINKLE_DEPTH_MAX = 0.45;
export const HERO_TWINKLE_DEPTH = 0.18;

/**
 * Fraction of the 600-frame cycle each star spends fading out and back in.
 * The star's position resets at the instant it is fully transparent, which is
 * what lets a constant linear drift close a perfect loop without tiling the
 * plane at the (tiny) 151px travel distance — see README.
 */
export const RESPAWN_FADE = 0.05;
export const HERO_RESPAWN_FADE = 0.12;

// --- Grade ------------------------------------------------------------------

export const GRAIN_TILE = 256;
export const GRAIN_SIGMA = 5.1; // ~2% of 255
export const GRAIN_MEAN = 4;
export const DITHER_TILE = 128;
export const DITHER_MAX = 3; // ~1 LSB of 8-bit
