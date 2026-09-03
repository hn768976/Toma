/**
 * Design tokens for the calendar card.
 *
 * Every length is expressed as a fraction of the card width (or card height,
 * where noted) so the same numbers hold at 1080p preview and 4K delivery.
 */

export const COLORS = {
  background: "#f7f7f7",
  backgroundGlow: "#fdfdfd",
  card: "#ffffff",
  ink: "#1a1a1a",
  sunday: "#e01f26",
  weekdayBand: "#f1f1f1",
  weekday: "#3a3a3a",
  /** Endpoints of the gradient painted onto the curled flap's reverse side. */
  flapLight: "#ffffff",
  flapDark: "#9a9a9a",
} as const;

export const FONT_FAMILY = "InterCalendar";

/** Card geometry, as fractions of the frame. */
export const CARD = {
  /** Card width as a fraction of frame width. */
  widthFraction: 0.42,
  /** width / height. */
  aspect: 1.25,
  /** Optical lift: the card sits this fraction of frame height above centre. */
  liftFraction: 0.018,
} as const;

/** Page layout, as fractions of page width (x) or page height (y). */
export const PAGE = {
  padX: 0.072,
  titleSize: 0.086,
  titleBaselineY: 0.176,
  titleTracking: -0.02,

  bandTopY: 0.232,
  bandHeightY: 0.072,
  weekdaySize: 0.031,
  weekdayBaselineY: 0.288,
  weekdayTracking: 0.06,

  gridTopY: 0.36,
  gridBottomY: 0.95,
  dateSize: 0.047,
} as const;
