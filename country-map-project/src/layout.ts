/**
 * Type and geometry metrics, as fractions of frame width.
 *
 * Shared by the asset builder — which uses them to lay labels out and resolve
 * collisions offline against the real font metrics — and by the compositions,
 * which draw what the builder decided. Keeping one copy is what stops the baked
 * label positions from drifting away from the type that actually gets rendered.
 */

export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 360;

/**
 * Weights, all Barlow Semi Condensed.
 * The condensed widths are the point: "Belo Horizonte" is 27% narrower than in a
 * standard-width sans, which removes most collisions before the solver runs.
 */
export const WEIGHT = {
  title: 800,
  capital: 600,
  city: 500,
  neighbour: 400,
  marine: 400,
  satelliteTitle: 500,
} as const;

/** All in fractions of composition width. */
export const TYPE = {
  /** The country name. Dominant, but sized to sit on the country. */
  title: 0.046,
  titleMaxWidthFrac: 0.56,
  titleLetterSpacing: 0.035,
  /** City labels. 0.0115 * 3840 = 44px at 4K, 22px at 1080p. */
  city: 0.0115,
  /** Neighbouring country names, small dim caps. */
  neighbour: 0.0102,
  neighbourLetterSpacing: 0.05,
  /** Named seas and gulfs, italic. */
  marine: 0.0102,
  marineLetterSpacing: 0.02,
  /** V3's understated label. */
  satelliteTitle: 0.026,
  satelliteLetterSpacing: 0.08,
} as const;

export const MARKER = {
  city: 0.0035,
  capital: 0.0052,
  ring: 0.0009,
  /** How far a leader line pushes a label that has nowhere adjacent to sit. */
  leaderReach: 0.03,
} as const;

/**
 * Halo weights, as a fraction of the font size. A tight outline hugging the
 * glyphs — never a large-radius shadow, which reads as a stain on the map rather
 * than as depth on the type.
 */
export const HALO = {
  city: 0.11,
  cityOpacity: 0.72,
  title: 0.05,
  titleOpacity: 0.7,
  satellite: 0.075,
  satelliteOpacity: 0.68,
} as const;

/** Padding around the country name's box, so labels never crowd up against it. */
export const TITLE_PAD = 0.008;

/** The push-in. Scale 1.0 -> 1.18 over the whole clip, with a slight lateral drift. */
export const PUSH = {
  from: 1.0,
  to: 1.18,
  /** Lateral drift, as a fraction of frame width / height. Kept well inside the
   *  margin the scale-up creates, so no edge is ever revealed. */
  driftX: -0.012,
  driftY: 0.006,
} as const;

/**
 * V3's closing framing: the fraction of the frame that the country's longest
 * dimension fills. The brief's target is 60-70%; this is the default and every
 * country carries its own value in src/countries.ts.
 */
export const DEFAULT_FINAL_ZOOM = 0.68;
