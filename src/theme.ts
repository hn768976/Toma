/**
 * Every colour in the piece lives here. Nothing outside this file may contain a
 * hex literal — a new palette is a new entry in THEMES, never an edit elsewhere.
 *
 * Colours are named by *role*, not by appearance, because the roles invert
 * between variants: the dominant card fill is white in "blue" and near-black in
 * "dark", so a field called `cardWhite` would be a lie in half the themes.
 */

export type Variant = 'blue' | 'dark';

/** How a card is filled. `accent` and `highlight` are rationed by count, not by roll. */
export type CardFillKind = 'base' | 'blue' | 'glass' | 'highlight' | 'accent';

/** The cluster beside the badge: an audio waveform, or a typing indicator. */
export type MotifKind = 'bars' | 'dots';

export interface CardFillStyle {
  /** May already carry alpha, for the see-through fills. */
  body: string;
  rim: string;
  /** Each card flips a seeded coin between `line` and `lineAlt`. Set both the
   * same to switch that variation off. */
  line: string;
  lineAlt: string;
  lineAlpha: number;
  /** Colour of the bar/dot motif on the few cards that carry it. */
  motif: string;
  /** Strength of the inner top-edge sheen; 0 for none. */
  sheen: number;
}

export interface Theme {
  backgroundDeep: string;
  backgroundMid: string;
  glowCyan: string;
  badgeWhite: string;
  codeCyan: string;
  codeWhite: string;

  /** The hero. */
  bubbleBody: string;
  bubbleRim: string;
  /** The short text-preview lines below the bubble. */
  heroLine: string;
  /** The motif beside the badge. */
  heroMotif: string;
  /** Badge body gradient, dark -> mid -> bright. */
  badgeGradient: readonly [string, string, string];
  badgeRim: string;
  motif: MotifKind;

  /** The surrounding cards. */
  cardFills: Record<CardFillKind, CardFillStyle>;
  /** Cumulative thresholds on a seeded 0..1 roll: below `base` is base, below
   * `blue` is blue, above is glass. Cards already claimed by accent or
   * highlight never reach the roll. */
  fillThresholds: {base: number; blue: number};
  /** Cards rationed to the rare light fill. 0 switches the fill off entirely. */
  highlightCount: number;
  /** Card rim: `max(floor, cardWidth * factor)`, in plane units. */
  rimWidthFactor: number;
  rimWidthFloor: number;
}

/** `#RRGGBB` -> `rgba(r, g, b, a)`. The only place hex is parsed. */
export const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Mix two colours in sRGB. Used for gradient stops and card rims. */
export const mixColors = (a: string, b: string, t: number): string => {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const ca = (na >> shift) & 255;
    const cb = (nb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

// ── Shared across every variant ──────────────────────────────────────────────
// The badge and its halo are the fixed point of the piece: identical in every
// variant, so they are defined once rather than per theme.

const GLOW_CYAN = '#29C5F5';
const BADGE_WHITE = '#FFFFFF';
const CODE_CYAN = '#5FD8E8';
const CODE_WHITE = '#D8E8F5';
const BADGE_BLUE = '#2A6FD9';
const BADGE_GRADIENT_BASE = '#101C33';

const BADGE_GRADIENT = [
  mixColors(BADGE_BLUE, BADGE_GRADIENT_BASE, 0.25),
  BADGE_BLUE,
  mixColors(BADGE_BLUE, GLOW_CYAN, 0.8),
] as const;

// ── "blue": white cards on a deep blue field ────────────────────────────────

const BLUE_CARD_WHITE = '#E8EEF5';
const BLUE_CARD_BLUE = '#2A6FD9';
const BLUE_LINE = '#4A9EE8';
const BLUE_ACCENT_RED = '#C41E28';

const blue: Theme = {
  backgroundDeep: '#060B18',
  backgroundMid: '#101C33',
  glowCyan: GLOW_CYAN,
  badgeWhite: BADGE_WHITE,
  codeCyan: CODE_CYAN,
  codeWhite: CODE_WHITE,

  bubbleBody: BLUE_CARD_WHITE,
  bubbleRim: withAlpha(BADGE_WHITE, 0.55),
  heroLine: BLUE_LINE,
  heroMotif: GLOW_CYAN,
  badgeGradient: BADGE_GRADIENT,
  badgeRim: GLOW_CYAN,
  motif: 'bars',

  cardFills: {
    base: {
      body: BLUE_CARD_WHITE,
      rim: withAlpha(BADGE_WHITE, 0.5),
      line: BLUE_LINE,
      lineAlt: BLUE_LINE,
      lineAlpha: 0.88,
      motif: GLOW_CYAN,
      sheen: 0.5,
    },
    blue: {
      body: BLUE_CARD_BLUE,
      rim: withAlpha(BLUE_LINE, 0.7),
      // Filled blue cards carry white or lighter-blue lines.
      line: BADGE_WHITE,
      lineAlt: mixColors(BLUE_LINE, BLUE_CARD_WHITE, 0.55),
      lineAlpha: 0.85,
      motif: mixColors(GLOW_CYAN, BLUE_CARD_WHITE, 0.25),
      sheen: 0,
    },
    glass: {
      body: withAlpha(BLUE_CARD_WHITE, 0.16),
      rim: withAlpha(BLUE_LINE, 0.5),
      line: BLUE_LINE,
      lineAlt: BLUE_LINE,
      lineAlpha: 0.6,
      motif: GLOW_CYAN,
      sheen: 0.18,
    },
    accent: {
      body: BLUE_ACCENT_RED,
      rim: withAlpha(BLUE_ACCENT_RED, 0.9),
      line: BLUE_CARD_WHITE,
      lineAlt: BLUE_CARD_WHITE,
      lineAlpha: 0.5,
      motif: GLOW_CYAN,
      sheen: 0,
    },
    // Unused in this variant: highlightCount is 0.
    highlight: {
      body: BLUE_CARD_WHITE,
      rim: withAlpha(BADGE_WHITE, 0.5),
      line: BLUE_LINE,
      lineAlt: BLUE_LINE,
      lineAlpha: 0.88,
      motif: GLOW_CYAN,
      sheen: 0.5,
    },
  },
  fillThresholds: {base: 0.46, blue: 0.72},
  highlightCount: 0,
  rimWidthFactor: 0.004,
  rimWidthFloor: 1.5,
};

// ── "dark": the inversion. Dark cards dominate, light becomes the rare accent ─

const DARK_CARD_BASE = '#14243D';
const DARK_CARD_BLUE = '#1E4E96';
const DARK_LINE_CYAN = '#4FC8E8';
const DARK_LINE_DIM = '#2A5A7A';
const DARK_CARD_HIGHLIGHT = '#E8EEF5';
const DARK_ACCENT_AMBER = '#E8A93F';
const DARK_BACKGROUND_DEEP = '#04070F';

/**
 * Dark cards on a dark field have far less inherent separation than white cards
 * did, so every fill carries a rim lifted toward the highlight tone. Without it
 * the overlapping stack collapses into one soft mass — the failure mode for
 * this variant.
 */
const darkRim = (fill: string, lift: number) => mixColors(fill, DARK_CARD_HIGHLIGHT, lift);

const dark: Theme = {
  backgroundDeep: DARK_BACKGROUND_DEEP,
  backgroundMid: '#0A1424',
  glowCyan: GLOW_CYAN,
  badgeWhite: BADGE_WHITE,
  codeCyan: CODE_CYAN,
  codeWhite: CODE_WHITE,

  bubbleBody: DARK_CARD_HIGHLIGHT,
  bubbleRim: withAlpha(BADGE_WHITE, 0.55),
  heroLine: DARK_LINE_CYAN,
  heroMotif: GLOW_CYAN,
  badgeGradient: BADGE_GRADIENT,
  badgeRim: GLOW_CYAN,
  motif: 'dots',

  cardFills: {
    base: {
      body: DARK_CARD_BASE,
      rim: darkRim(DARK_CARD_BASE, 0.3),
      line: DARK_LINE_CYAN,
      lineAlt: DARK_LINE_CYAN,
      lineAlpha: 0.85,
      motif: GLOW_CYAN,
      sheen: 0,
    },
    blue: {
      body: DARK_CARD_BLUE,
      rim: darkRim(DARK_CARD_BLUE, 0.3),
      // "the deeper cards" — these sit back, so their lines stay quiet.
      line: DARK_LINE_DIM,
      lineAlt: DARK_LINE_DIM,
      lineAlpha: 0.95,
      motif: mixColors(GLOW_CYAN, DARK_CARD_HIGHLIGHT, 0.25),
      sheen: 0,
    },
    glass: {
      body: withAlpha(DARK_LINE_CYAN, 0.07),
      rim: withAlpha(DARK_LINE_CYAN, 0.42),
      line: DARK_LINE_CYAN,
      lineAlt: DARK_LINE_CYAN,
      lineAlpha: 0.45,
      motif: GLOW_CYAN,
      sheen: 0,
    },
    accent: {
      // Amber, not red: against dark cards #C41E28 becomes the loudest thing in
      // frame and fights the badge. Amber sits closer in value to the field.
      body: DARK_ACCENT_AMBER,
      rim: darkRim(DARK_ACCENT_AMBER, 0.2),
      line: DARK_BACKGROUND_DEEP,
      lineAlt: DARK_BACKGROUND_DEEP,
      lineAlpha: 0.4,
      motif: GLOW_CYAN,
      sheen: 0,
    },
    highlight: {
      body: DARK_CARD_HIGHLIGHT,
      rim: withAlpha(BADGE_WHITE, 0.5),
      line: DARK_CARD_BLUE,
      lineAlt: DARK_CARD_BLUE,
      lineAlpha: 0.8,
      motif: GLOW_CYAN,
      sheen: 0.4,
    },
  },
  // Of the cards left after accent and highlight are rationed out:
  // ~58% base, ~26% blue, ~16% glass.
  fillThresholds: {base: 0.58, blue: 0.84},
  highlightCount: 3,
  rimWidthFactor: 0.005,
  rimWidthFloor: 2.5,
};

export const THEMES: Record<Variant, Theme> = {blue, dark};

export const getTheme = (variant: Variant): Theme => THEMES[variant] ?? THEMES.blue;
