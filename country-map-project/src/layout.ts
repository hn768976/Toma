/**
 * Type and geometry metrics, as fractions of frame width.
 *
 * Shared by the asset builder (which uses them to lay labels out and resolve
 * collisions offline) and the compositions (which use them to draw). Keeping one
 * copy is what stops the baked label positions from drifting away from the type
 * that actually gets rendered.
 */

export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 360;

/** All in fractions of composition width. */
export const TYPE = {
  /** The country name. The dominant piece of type in frame, but sized to sit on
   *  the country rather than to shout — and set at normal tracking. */
  title: 0.044,
  titleMaxWidthFrac: 0.56,
  titleLetterSpacing: 0.015,
  /** City labels. 0.0108 * 3840 = 41px at 4K, 21px at 1080p. */
  city: 0.0108,
  /** Neighbouring country names, small grey caps. */
  neighbour: 0.0094,
  neighbourLetterSpacing: 0.035,
  /** Named seas and gulfs, italic. */
  marine: 0.0094,
  marineLetterSpacing: 0.025,
  /** V3's understated label. */
  satelliteTitle: 0.024,
  satelliteLetterSpacing: 0.05,
} as const;

export const MARKER = {
  city: 0.0035,
  capital: 0.0052,
  ring: 0.0009,
} as const;

/** Rough advance width of Inter as a multiple of font size, for offline collision tests. */
export const AVG_GLYPH_WIDTH = 0.56;
export const CAPS_GLYPH_WIDTH = 0.66;

export const estimateTextWidth = (
  text: string,
  fontSize: number,
  {caps = false, letterSpacing = 0}: {caps?: boolean; letterSpacing?: number} = {}
): number =>
  text.length * fontSize * ((caps ? CAPS_GLYPH_WIDTH : AVG_GLYPH_WIDTH) + letterSpacing);

/** The push-in. Scale 1.0 -> 1.18 over the whole clip, with a slight lateral drift. */
export const PUSH = {
  from: 1.0,
  to: 1.18,
  /** Lateral drift, as a fraction of frame width / height. Kept well inside the
   *  margin the scale-up creates, so no edge is ever revealed. */
  driftX: -0.012,
  driftY: 0.006,
} as const;
