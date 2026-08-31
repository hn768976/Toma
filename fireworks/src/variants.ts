/**
 * Every tunable that differs between the two versions of the piece lives here:
 * palette, sky mode, burst placement, burst rate and burst types.
 *
 * This is the ONLY module in the project that is allowed to contain a colour
 * literal. Everything else takes its colours from a variant's palette.
 */

export const DURATION_IN_FRAMES = 420;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type VariantName = 'blue' | 'black';

export type BurstTypeName =
  | 'peony'
  | 'chrysanthemum'
  | 'willow'
  | 'crackle'
  | 'ring';

export type Weighted<T> = {readonly value: T; readonly weight: number};

export type Palette = {
  /** Base colour of the sky. */
  readonly skyDeep: string;
  /** Soft lighter region washed over the sky (city glow). */
  readonly skyWash: string;
  /** Colour of the dim majority of stars. */
  readonly starPale: string;
  /** Colour of the few bright stars. */
  readonly starBright: string;
  /** Burst particle colours, drawn from by weight. */
  readonly burst: readonly Weighted<string>[];
  /** Particles shift towards this as they cool. */
  readonly ember: string;
  /** Detonation flash and the rising shell head. */
  readonly flash: string;
  /** Vignette colour (darkens the frame edges). */
  readonly vignette: string;
  /** Grain colour. */
  readonly grain: string;
};

export type SkyConfig = {
  readonly mode: 'blue' | 'black';
  /** Opacity of the city-glow wash in the upper-left. 0 disables it. */
  readonly washStrength: number;
  /** Number of stars in the field. */
  readonly starCount: number;
  /** Global multiplier on star brightness. */
  readonly starBrightness: number;
};

export type PlacementConfig = {
  readonly mode: 'rightClustered' | 'centredFull';
  /** Horizontal band the burst origins fall in, as a fraction of the width. */
  readonly xRange: readonly [number, number];
  /** Vertical band the burst origins fall in, as a fraction of the height. */
  readonly yRange: readonly [number, number];
  /**
   * How strongly origins pull towards the centre of the band. 0 = uniform,
   * 1 = strongly clustered.
   */
  readonly clustering: number;
};

export type RateConfig = {
  /**
   * `clustered` fires bursts in small groups separated by clear gaps.
   * `continuous` fires them at a steady short interval with no gaps.
   */
  readonly mode: 'clustered' | 'continuous';
  /** Frames between bursts inside a cluster (or between all bursts if continuous). */
  readonly step: readonly [number, number];
  /** Frames of empty sky between clusters. Ignored when continuous. */
  readonly gap: readonly [number, number];
  /** Number of bursts per cluster. Ignored when continuous. */
  readonly clusterSize: readonly [number, number];
};

export type MultiBreakConfig = {
  /** Probability a burst detonates a second time from some of its particles. */
  readonly chance: number;
  /** How many secondary bursts a multi-break shell throws. */
  readonly children: readonly [number, number];
  /** Frames after the primary break that the secondaries fire. */
  readonly delay: readonly [number, number];
  /** Size of the secondary bursts relative to the primary. */
  readonly scale: number;
};

export type VariantConfig = {
  readonly palette: Palette;
  readonly sky: SkyConfig;
  readonly placement: PlacementConfig;
  readonly rate: RateConfig;
  readonly types: readonly Weighted<BurstTypeName>[];
  /** Global multiplier on burst brightness. */
  readonly brightness: number;
  /** Global multiplier on particle counts. */
  readonly density: number;
  /** Fraction of bursts preceded by a visible rising shell. */
  readonly shellLaunchChance: number;
  readonly multiBreak: MultiBreakConfig;
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /**
   * Version 1 — a photographed-looking blue night sky with the bursts held in
   * the right third of the frame, leaving the left two thirds open for a title.
   */
  blue: {
    palette: {
      skyDeep: '#0A1A4A',
      skyWash: '#14306B',
      starPale: '#C8D8F5',
      starBright: '#FFFFFF',
      burst: [
        {value: '#F5C43F', weight: 0.32}, // gold
        {value: '#FFE8A8', weight: 0.24}, // warm
        {value: '#F58FC4', weight: 0.2}, // pink
        {value: '#FFFFFF', weight: 0.14}, // white
        {value: '#A8C8FF', weight: 0.1}, // cool, a minority
      ],
      ember: '#F5C43F',
      flash: '#FFFFFF',
      vignette: '#000000',
      grain: '#FFFFFF',
    },
    sky: {
      mode: 'blue',
      washStrength: 1,
      starCount: 900,
      starBrightness: 1,
    },
    placement: {
      mode: 'rightClustered',
      xRange: [0.665, 0.955],
      yRange: [0.13, 0.5],
      clustering: 0.45,
    },
    rate: {
      mode: 'clustered',
      step: [9, 17],
      gap: [26, 44],
      clusterSize: [2, 3],
    },
    types: [
      {value: 'peony', weight: 0.4},
      {value: 'chrysanthemum', weight: 0.34},
      {value: 'crackle', weight: 0.16},
      {value: 'willow', weight: 0.06},
      {value: 'ring', weight: 0.04},
    ],
    brightness: 1,
    density: 1,
    shellLaunchChance: 0.5,
    multiBreak: {
      chance: 0,
      children: [0, 0],
      delay: [0, 0],
      scale: 0,
    },
  },

  /**
   * Version 2 — a finale. True black sky, bursts across the whole frame, three
   * times the rate, the full spectrum instead of a gold and pink pairing, and
   * shells breaking a second time from their own particles.
   */
  black: {
    palette: {
      skyDeep: '#000000',
      skyWash: '#0A0A12',
      starPale: '#A8A8B8',
      starBright: '#FFFFFF',
      burst: [
        {value: '#F5483F', weight: 0.22}, // red
        {value: '#F58F3F', weight: 0.2}, // orange
        {value: '#4FE87A', weight: 0.2}, // green
        {value: '#9B5FE8', weight: 0.2}, // violet
        {value: '#FFFFFF', weight: 0.18}, // white
      ],
      ember: '#F58F3F',
      flash: '#FFFFFF',
      vignette: '#000000',
      grain: '#FFFFFF',
    },
    sky: {
      mode: 'black',
      // The city glow is gone; what is left is barely present.
      washStrength: 0.22,
      // The star field is thinned so it has nothing competing with the bursts.
      starCount: 540,
      starBrightness: 0.75,
    },
    placement: {
      mode: 'centredFull',
      xRange: [0.06, 0.94],
      yRange: [0.08, 0.6],
      clustering: 0.18,
    },
    rate: {
      mode: 'continuous',
      step: [7, 15],
      gap: [0, 0],
      clusterSize: [1, 1],
    },
    // No ring: a flat disc of particles reads as a horizontal ellipse, which
    // is not wanted here. The weight goes to the spherical types.
    types: [
      {value: 'willow', weight: 0.32},
      {value: 'peony', weight: 0.23},
      {value: 'crackle', weight: 0.23},
      {value: 'chrysanthemum', weight: 0.22},
    ],
    // A finale puts many bursts on screen at once, so each one is pulled back
    // about a quarter to keep the frame from blowing out.
    brightness: 0.75,
    density: 0.72,
    shellLaunchChance: 0.92,
    multiBreak: {
      chance: 0.2,
      children: [2, 4],
      delay: [10, 17],
      scale: 0.42,
    },
  },
};
