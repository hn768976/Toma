import {RGB} from './theme';

/**
 * Everything that differs between the two pieces lives here, and nowhere else.
 *
 * The component, the composition size, the design space, the stroke weights,
 * the label sizing, the bokeh, the motion blur, the vignette and the grain
 * density are all shared. A variant is a palette plus a bag of numbers plus a
 * description of what punctuates its price series.
 */
export type Variant = 'bull' | 'bear';

export type Theme = {
  bg: string;
  /** the faint haze in one lower corner */
  ambient: RGB;
  /** near-white hot centre of the stroke */
  lineCore: RGB;
  /** saturated neon body */
  lineMid: RGB;
  /** the bloom colour */
  lineGlow: RGB;
  /** bright labels */
  labelWhite: RGB;
  /** dimmer, distant labels */
  labelDim: RGB;
  /** grain is tinted so it never introduces another hue */
  grainTint: RGB;
};

export const THEMES: Record<Variant, Theme> = {
  bull: {
    bg: '#000000',
    ambient: [4, 26, 12], // #041A0C
    lineCore: [232, 255, 232], // #E8FFE8
    lineMid: [79, 255, 106], // #4FFF6A
    lineGlow: [34, 204, 68], // #22CC44
    labelWhite: [240, 255, 240], // #F0FFF0
    labelDim: [63, 224, 95], // #3FE05F
    grainTint: [0.5, 1, 0.62],
  },
  bear: {
    bg: '#000000',
    ambient: [26, 4, 6], // #1A0406
    lineCore: [255, 232, 232], // #FFE8E8
    lineMid: [255, 79, 79], // #FF4F4F
    lineGlow: [204, 34, 34], // #CC2222
    labelWhite: [255, 240, 240], // #FFF0F0
    labelDim: [224, 95, 95], // #E05F5F
    grainTint: [1, 0.42, 0.42],
  },
};

/** One kind of trending run: how long it lasts, how hard it pulls, how noisy. */
export type RunKind = {
  /** cumulative probability threshold, ascending; the last must be 1 */
  upto: number;
  len: readonly [number, number];
  drift: readonly [number, number];
  vol: readonly [number, number];
};

/** A jagged peak that shoots up and falls straight back. */
export type SpikeConfig = {
  count: readonly [number, number];
  up: readonly [number, number];
  down: readonly [number, number];
  height: readonly [number, number];
};

/** A near-vertical collapse, a dead-cat bounce, then a long slow base. */
export type CapitulationConfig = {
  /** where in the series, as a fraction */
  at: number;
  /** how far that position may wander, in points */
  jitter: number;
  drop: readonly [number, number];
  depth: readonly [number, number];
  bounceFrac: readonly [number, number];
  bounceLen: readonly [number, number];
};

/** A climb that recovers part of a prior decline and then rolls over. */
export type FailedRallyConfig = {
  /** positions in the series, as fractions */
  at: readonly number[];
  jitter: number;
  up: readonly [number, number];
  down: readonly [number, number];
  height: readonly [number, number];
};

export type SeriesConfig = {
  n: number;
  tileWidth: number;
  /**
   * World px the trend covers per tile, signed: positive climbs up the screen,
   * negative falls. The camera tracks by exactly this per loop, so its
   * direction follows from the sign with nothing else to change.
   */
  tileRise: number;
  /** RMS residual excursion around the trend, world px */
  amp: number;
  /** per-tick jitter laid on top of the walk, world px */
  hfAmp: number;
  tickVol: number;
  /** high-pass window, in points */
  hpWindow: number;
  /** the two moving-average smoothing windows */
  maSmooth: readonly [number, number];
  /**
   * Pushes the moving average off the price line, world px, negative = above.
   * The offset relaxes to a crossing near the start of the loop.
   */
  maBias: number;
  /** width of that crossing dip, as a fraction of the series */
  maBiasSigma: number;
  runKinds: readonly RunKind[];
  spikes: SpikeConfig | null;
  capitulation: CapitulationConfig | null;
  failedRallies: FailedRallyConfig | null;
};

export type VariantConfig = {
  id: Variant;
  theme: Theme;
  /** composition tilt, radians */
  tilt: number;
  /** the trend sits this far off centre, design px, positive = lower */
  lineYOffset: number;
  /** centre of the ambient haze, design px */
  wash: {x: number; y: number; r: number};
  /** alpha of the wide glow pass on the price line */
  glowAlpha: number;
  /** and on the moving average */
  maGlowAlpha: number;
  /** blur radii of the two bloom taps, in their own buffers */
  bloomBlur: number;
  haloBlur: number;
  /** how hard each bloom tap is composited back */
  bloomAlpha: number;
  haloAlpha: number;
  /** how much a label's value falls across the loop, 0 = not at all */
  labelDecline: number;
  /** share of labels that reroll their value when they respawn */
  rerollChance: number;
  series: SeriesConfig;
};

const SHARED_SERIES = {
  n: 400,
  tileWidth: 5040, // world px per loop — the camera covers exactly this in 840 frames
};

export const VARIANTS: Record<Variant, VariantConfig> = {
  bull: {
    id: 'bull',
    theme: THEMES.bull,
    tilt: (-8 * Math.PI) / 180, // up to the right
    lineYOffset: 60,
    // The radius runs past the frame's far corner (1873px away) so the wash
    // never shows the circle where it ends.
    wash: {x: 300, y: 940, r: 2000}, // lower-left
    glowAlpha: 0.26,
    maGlowAlpha: 0.14,
    bloomBlur: 8,
    haloBlur: 12,
    bloomAlpha: 0.8,
    haloAlpha: 0.5,
    labelDecline: 0,
    rerollChance: 0.42,
    series: {
      ...SHARED_SERIES,
      tileRise: 1260, // ~14deg up, +8deg of tilt on top
      amp: 152,
      hfAmp: 11,
      tickVol: 2.6,
      hpWindow: 161,
      maSmooth: [61, 41],
      maBias: 0,
      maBiasSigma: 0.05,
      // Long steady climbs punctuated by short pullbacks.
      runKinds: [
        {upto: 0.4, len: [30, 70], drift: [0.8, 1.9], vol: [0.55, 1.0]}, // steady climb
        {upto: 0.64, len: [30, 70], drift: [-1.7, -0.6], vol: [0.7, 1.25]}, // pullback
        {upto: 0.86, len: [30, 70], drift: [-0.14, 0.14], vol: [0.85, 1.45]}, // consolidation
        {upto: 1, len: [30, 70], drift: [2.1, 3.3], vol: [0.4, 0.85]}, // impulse leg
      ],
      spikes: {count: [1, 2], up: [5, 9], down: [7, 13], height: [210, 340]},
      capitulation: null,
      failedRallies: null,
    },
  },

  bear: {
    id: 'bear',
    theme: THEMES.bear,
    // Down to the right, and shallower than the bull's climb: a steep downward
    // diagonal reads melodramatic where a steep upward one reads triumphant.
    tilt: (6 * Math.PI) / 180,
    lineYOffset: -40, // starts high, with room to fall
    wash: {x: 1620, y: 940, r: 2000}, // lower-right
    // Red at high saturation spreads more readily than green, so the wide
    // glow pass comes down from 26% to 20% and both bloom radii are trimmed —
    // without that the red line smears where the green one stayed crisp.
    //
    // But red also carries far less luminance than green (#FF4F4F is roughly
    // 40% of #4FFF6A), and pulling the radii in costs brightness on top of
    // that, so side by side with v1 the trimmed line came out noticeably
    // colder. The two bloom taps are therefore composited *harder* to bring it
    // back: strength, not radius, so the line keeps the crispness the trim
    // bought it.
    glowAlpha: 0.2,
    maGlowAlpha: 0.108, // the same 0.20/0.26 ratio applied to the average
    bloomBlur: 7,
    haloBlur: 10.5,
    bloomAlpha: 0.92,
    haloAlpha: 0.6,
    labelDecline: 0.5,
    rerollChance: 0.65,
    series: {
      ...SHARED_SERIES,
      tileRise: -1100, // ~12deg down, +6deg of tilt on top
      amp: 160,
      hfAmp: 13,
      tickVol: 2.9,
      hpWindow: 131, // shorter structure — a falling chart is choppier
      maSmooth: [51, 35],
      maBias: -175, // the price spends the piece below its average
      maBiasSigma: 0.05,
      // Markets fall faster than they climb: the drops are short and steep,
      // the recoveries are longer and weaker, and they do not hold.
      runKinds: [
        {upto: 0.4, len: [20, 30], drift: [-2.8, -1.5], vol: [0.55, 1.0]}, // steep drop
        {upto: 0.68, len: [34, 45], drift: [0.55, 1.05], vol: [0.6, 1.15]}, // failing recovery
        {upto: 0.9, len: [24, 38], drift: [-0.25, 0.1], vol: [1.0, 1.7]}, // choppy consolidation
        {upto: 1, len: [20, 26], drift: [-4.8, -3.6], vol: [0.45, 0.9]}, // flush
      ],
      spikes: null,
      capitulation: {
        at: 0.66,
        jitter: 8,
        drop: [5, 8],
        depth: [400, 470],
        bounceFrac: [0.14, 0.22],
        bounceLen: [10, 15],
      },
      // Spaced so that, at full jitter, the later rally's rollover still ends
      // clear of the capitulation's first point.
      failedRallies: {
        at: [0.28, 0.44],
        jitter: 8,
        up: [28, 36],
        down: [22, 28],
        height: [200, 270],
      },
    },
  },
};

export const resolveVariant = (v: Variant | undefined): VariantConfig =>
  VARIANTS[v ?? 'bull'];
