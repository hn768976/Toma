// Timing, camera and palette configuration for the celestial flythrough.
//
// The reference clip is 960x540 / 23.976fps / 5.005s. This rebuild keeps
// the same on-screen duration but on a clean 30fps grid: 150 frames at
// 30fps = 5.000s.

export const FPS = 30;
export const DURATION_IN_FRAMES = 150;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Camera -----------------------------------------------------------
//
// Everything in the scene is authored in "normalised screen units at its
// own depth": a puff or star records where it sits on screen at frame 0
// plus a depth z. Projecting it is then just a growth factor
//
//   g = z / (z - camZ)
//
// applied to its offset from the vanishing point and to its size. That
// keeps the art direction readable (nx/ny are literally fractions of the
// frame) while still producing true perspective parallax: near things
// sweep past fast, far things barely move.

// How far the camera travels over the clip, in the same z units.
// Measured against the reference: features separate by ~1.48x over 5s,
// which for mid-depth material (z ~ 6) means camZ ends near 2.
export const CAMERA_TRAVEL = 2.0;

// Nothing is placed closer than this, so no star ever crosses the camera
// plane and pops.
export const Z_NEAR = 3.2;
export const Z_FAR = 15.0;

// Vanishing point, as a fraction of the frame. Sitting it just off the
// geometric centre stops the expansion from looking like a plain zoom.
export const VANISHING_X = 0.515;
export const VANISHING_Y = 0.455;

// A barely-there roll (degrees over the whole clip) — not consciously
// visible, but it stops the frame feeling locked to a tripod.
export const CAMERA_ROLL_DEG = 0.9;

// --- Star field -------------------------------------------------------

export const STAR_COUNT = 2600;
export const CLUSTER_STAR_COUNT = 900;
export const HERO_STAR_COUNT = 14;
export const WARM_CLUSTER_COUNT = 7;

// Per-star twinkle, in frames. Deliberately not a divisor of the clip
// length — this is a one-shot, not a loop.
export const TWINKLE_PERIOD = 47;

export type Palette = {
  /** Deep background, centre of the frame. */
  backgroundInner: string;
  /** Deep background, corners. */
  backgroundOuter: string;
  /** Tints sampled for the nebula arm puffs. */
  nebulaTints: string[];
  /** Brighter tint for the dense core mass. */
  coreTint: string;
  /** Distant haze wash behind everything. */
  hazeTint: string;
  /** Warm accent clusters (kept in both variants for contrast). */
  warmTints: string[];
  /** Star body colours, sampled per star. */
  starTints: string[];
};

// Variant A — matches the reference: blue-teal clouds, warm amber knots.
export const CELESTIAL_PALETTE: Palette = {
  backgroundInner: "#04070f",
  backgroundOuter: "#010205",
  nebulaTints: [
    "#1E6FA8",
    "#2FB0D2",
    "#1B3E8E",
    "#3F72C4",
    "#17607E",
    "#5B4AA0",
  ],
  coreTint: "#6FCDE8",
  hazeTint: "#16344F",
  warmTints: ["#FF8A46", "#FF5B39", "#FFB07A"],
  starTints: ["#FFFFFF", "#E2EEFF", "#C2DAFF", "#FFF1DC", "#FFD6AC"],
};

// Variant B — violet nebula, same warm accents.
//
// Violet sits far higher in perceived luminance than the same-value
// blue, so these tints are deliberately darker than their celestial
// counterparts. Matching them by hex value alone makes the violet cut
// read washed out next to the blue one.
export const VIOLET_PALETTE: Palette = {
  backgroundInner: "#07030D",
  backgroundOuter: "#030107",
  nebulaTints: [
    "#5E2FA8",
    "#8A38B4",
    "#382078",
    "#6E44B8",
    "#472370",
    "#9A50A8",
  ],
  coreTint: "#A97BD8",
  hazeTint: "#211440",
  warmTints: ["#FF8A46", "#FF5B39", "#FFB07A"],
  starTints: ["#FFFFFF", "#F0E4FF", "#D6C2FF", "#FFF1DC", "#FFD6AC"],
};

export type VariantName = "celestial" | "violet";

export const PALETTES: Record<VariantName, Palette> = {
  celestial: CELESTIAL_PALETTE,
  violet: VIOLET_PALETTE,
};
