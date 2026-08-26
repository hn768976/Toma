/**
 * Every colour and every look-defining number in the piece lives here. Nothing
 * outside this file hardcodes a hex: the component reads a theme and draws it,
 * so a new variant is a new entry in THEMES and nothing else.
 */

export type Variant = 'cold' | 'electric';

export type ThemeColors = {
  background: string;
  /** Nearest code, about to pass the camera. */
  codeBright: string;
  /** Mid-corridor code -- the colour most of the frame is made of. */
  codeMid: string;
  /** Distant code, near the vanishing point. */
  codeDim: string;
  /** The perspective guide lines. */
  tunnelLine: string;
  title: string;
  /** Chromatic aberration, one side. */
  fringeA: string;
  /** Chromatic aberration, the other side. */
  fringeB: string;
  /** Blurred title passes: the tight glow, the wide glow, and the bloom. */
  titleGlowNear: string;
  titleGlowWide: string;
  titleBloom: string;
  /** The soft radial halo sitting behind the type. */
  titleHaloInner: string;
  titleHaloMid: string;
  vignette: string;
};

export type Theme = {
  colors: ThemeColors;
  /** How many blocks are in the corridor at any one time. */
  elementCount: number;
  /** How many distinct code blocks are laid out and recycled through. */
  blockPool: number;
  /** Code font size at 4K, before the /z perspective scaling. */
  baseFontPx: number;
  /** Resting chromatic offset on the title, in 4K pixels. */
  chromaticOffsetPx: number;
  /** Chromatic offset during a glitch event. */
  glitchOffsetPx: number;
  /** Seeded gap between glitch events, in frames: [min, max]. */
  glitchIntervalFrames: [number, number];
  /** Title cap height as a fraction of frame height. */
  titleCapFraction: number;
  /** Title letterspacing, in em. */
  titleTrackingEm: number;
  /**
   * Hard ceiling on the title's width as a fraction of frame width. The title
   * is a prop, so a long one is fitted down to this rather than being allowed
   * to run into the frame edges.
   */
  titleMaxWidthFraction: number;
};

export const THEMES: Record<Variant, Theme> = {
  /**
   * v1 -- cold, desaturated, corporate blue. Clinical.
   */
  cold: {
    colors: {
      background: '#000000',
      codeBright: '#E8F2FF',
      codeMid: '#A8C8E8',
      codeDim: '#3A5878',
      tunnelLine: '#1A2C44',
      title: '#FFFFFF',
      fringeA: '#E02040',
      fringeB: '#20D0E0',
      titleGlowNear: '#FFFFFF',
      titleGlowWide: '#BEDCFF',
      titleBloom: '#FFFFFF',
      titleHaloInner: '#FFFFFF',
      titleHaloMid: '#D2E6FF',
      vignette: '#000000',
    },
    elementCount: 34,
    blockPool: 50,
    baseFontPx: 26,
    chromaticOffsetPx: 7,
    glitchOffsetPx: 20,
    glitchIntervalFrames: [40, 110],
    titleCapFraction: 0.09,
    titleTrackingEm: 0.15,
    // Never bites for a short title; it is only here so an over-long prop
    // cannot run off the frame.
    titleMaxWidthFraction: 0.86,
  },

  /**
   * v2 -- saturated, electric blue. Higher chroma, deeper shadows, more
   * contrast; energetic where `cold` is clinical. The mid blue is the
   * signature: it desaturates visually at the size most code renders here, so
   * it is pitched harder than it looks in a swatch. The hot pink fringe stays
   * distinct against saturated blue where a red one would muddy.
   */
  electric: {
    colors: {
      background: '#000000',
      codeBright: '#C8E4FF',
      codeMid: '#4A9EFF',
      codeDim: '#1A3D7A',
      tunnelLine: '#0F2A55',
      title: '#FFFFFF',
      fringeA: '#FF2D6F',
      fringeB: '#00E5FF',
      titleGlowNear: '#FFFFFF',
      titleGlowWide: '#C8E4FF',
      titleBloom: '#FFFFFF',
      titleHaloInner: '#FFFFFF',
      titleHaloMid: '#C8E4FF',
      vignette: '#000000',
    },
    // Fewer, larger blocks with more space between them. The bigger font
    // covers ~1.5x the area per block, so the count comes down to match: this
    // is what makes v2 read cleaner and more deliberate than v1 rather than
    // simply busier.
    elementCount: 22,
    blockPool: 34,
    baseFontPx: 32,
    chromaticOffsetPx: 9,
    glitchOffsetPx: 20,
    glitchIntervalFrames: [50, 130],
    // A longer title needs more clear space around it than a short one.
    titleCapFraction: 0.075,
    titleTrackingEm: 0.09,
    titleMaxWidthFraction: 0.62,
  },
};

export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(mix(a[0], b[0], t)),
  Math.round(mix(a[1], b[1], t)),
  Math.round(mix(a[2], b[2], t)),
];

/**
 * Builds the depth ramp for a theme: `t` runs 0 (far, at the vanishing point)
 * to 1 (near camera), dim -> mid -> bright.
 */
export const makeDepthRamp = (theme: Theme) => {
  const dim = hexToRgb(theme.colors.codeDim);
  const mid = hexToRgb(theme.colors.codeMid);
  const bright = hexToRgb(theme.colors.codeBright);
  return (t: number): Rgb =>
    t < 0.5 ? mixRgb(dim, mid, t / 0.5) : mixRgb(mid, bright, (t - 0.5) / 0.5);
};
