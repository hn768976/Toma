/**
 * Compositions are authored at UHD so the same source renders straight to
 * 4K. Nothing downstream hard-codes 3840 though: the board is laid out in
 * its own units and scaled to whatever useVideoConfig() reports, so a
 * render at --scale=0.5 -- or a composition registered at a different
 * size -- is an exact scaled copy rather than a different layout.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s at 30fps

/**
 * The network is laid out on a plane wider and taller than the frame,
 * then tilted into perspective. The overhang keeps the plane's own edges
 * outside the picture once it is rotated.
 */
export const BOARD_WIDTH = 5600;
export const BOARD_HEIGHT = 3400;

/**
 * Depth-of-field tiers, blur radius in board units.
 *
 * These are board units on purpose: the board carries a single scale()
 * in its transform, and a CSS filter is applied in the element's own
 * coordinate space *before* that transform, so the blur is scaled by
 * exactly the same factor as the geometry it belongs to. That is what
 * keeps a 1080p preview and a 4K master looking identical instead of the
 * usual preview-vs-4K blur mismatch.
 *
 * Tier 0 is the in-focus plane carrying the hero node; the far tiers are
 * soft enough to read as colour rather than as shapes.
 */
export const TIER_BLUR = [0, 11, 32, 78, 165] as const;

/** Per-tier opacity, so distant nodes sit back as well as going soft. */
export const TIER_OPACITY = [1, 0.96, 0.88, 0.78, 0.66] as const;

export const TIER_COUNT = TIER_BLUR.length;

export const clampTier = (tier: number) =>
  Math.max(0, Math.min(TIER_COUNT - 1, Math.round(tier)));

/** Blur radius, in board units, for a depth tier. */
export const tierBlur = (tier: number) => TIER_BLUR[clampTier(tier)];

/** Opacity for a depth tier. */
export const tierOpacity = (tier: number) => TIER_OPACITY[clampTier(tier)];
