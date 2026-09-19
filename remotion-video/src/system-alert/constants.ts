// "System Hacked" cyber-alert motion graphic.
//
// Every dimension below is a FRACTION of the composition's width or height,
// never a pixel value. That is what lets the exact same component render
// byte-for-byte proportionally at 1920x1080 and at 3840x2160 — the 4K
// composition is not a separate design, it is this one measured in the same
// units against a bigger canvas.
//
// The numbers were measured off the reference clip (898x506 source frames)
// and converted to fractions, so the layout matches it at any resolution.

export const FPS = 30;

/** 600 frames @ 30fps = 20.000s — matches the 20.003s reference. */
export const DURATION_IN_FRAMES = 600;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/** Banner geometry, as fractions of the frame. Measured: 376/898 x 119/506. */
export const BANNER = {
  widthFrac: 0.4187,
  heightFrac: 0.2352,
  centerXFrac: 0.4894,
  centerYFrac: 0.502,
};

/**
 * Cap height of the headline, as a fraction of frame height (measured 29/506).
 * Liberation Sans Bold is metrically identical to Arial/Helvetica Bold — the
 * face used in the reference — and its cap height is 0.716em, so the font size
 * follows from the cap height rather than being guessed.
 */
export const CAP_HEIGHT_FRAC = 0.0596;
export const CAP_HEIGHT_RATIO = 0.716;
export const FONT_SIZE_FRAC = CAP_HEIGHT_FRAC / CAP_HEIGHT_RATIO;

export const FONT_FAMILY = "Liberation Sans Alert";

/**
 * Palette. The reference banner reads ~rgb(185,20,44) on screen, but that is
 * the scanline-darkened average — the underlying fill is brighter and the
 * scanline multiply pulls it down to the measured value.
 */
export const PALETTE = {
  bannerRed: "#E8142E",
  bannerRedDeep: "#A80C20",
  bannerEdge: "#FF4D5F",
  textWhite: "#F4F2F3",
  glowRed: "#FF1524",
};

/** Number of simulated CRT scanlines across the frame height, resolution independent. */
export const SCANLINE_COUNT = 270;

/**
 * Whole-frame glitch kick.
 *
 * `KICK_GAIN` multiplies the glitch model's `jump` (|jump| <= 0.006) to give a
 * displacement as a fraction of frame width, so the largest possible kick is
 * KICK_GAIN * 0.006 of the width. `BACKGROUND_COVER_SCALE` is what the
 * full-bleed background is scaled by so it can absorb that displacement
 * without pulling its own edge into frame; it must stay above
 * 1 + 2 * KICK_GAIN * 0.006, with margin for the blur that is applied at the
 * same time.
 */
export const KICK_GAIN = 3;
export const BACKGROUND_COVER_SCALE = 1.06;
