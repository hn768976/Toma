/**
 * The one place any of the six versions is described.
 *
 * Both families run the same particle system; `mode` decides whether a
 * particle is drawn as a radial streak leaving a core ("streak", the warp
 * family) or as a point holding station in a slowly drifting field ("point",
 * the starfield family). Everything else that differs between versions is a
 * number or a colour in this file. No hex literal appears anywhere else in
 * the project.
 *
 * Loop lengths: warp 168 frames (5.6s @ 30fps), field 390 frames (13.0s).
 * Every period below is a divisor of its family's loop length and every
 * Lissajous frequency is an integer, so all six loop seamlessly.
 */

export type ParticleMode = "streak" | "point";

export type VariantId =
  | "warpBlue"
  | "warpViolet"
  | "warpAmber"
  | "fieldBlue"
  | "fieldTeal"
  | "fieldMono";

/** A weighted colour choice, as a hex string. */
export type ColorWeight = { readonly hex: string; readonly weight: number };

/** One slice of the brightness distribution: `share` of particles in `range`. */
export type BrightnessTier = {
  readonly share: number;
  readonly range: readonly [number, number];
};

/** A diagonal band used both to cluster dust and to bias star density. */
export type BandConfig = {
  /** Degrees, measured clockwise from the +x axis in screen space. */
  readonly angleDeg: number;
  /** Perpendicular half-width, as a fraction of the frame diagonal. */
  readonly width: number;
  /** Perpendicular offset of the band centre from the frame centre. */
  readonly offset: number;
};

export type CoreConfig = {
  /** Position as a fraction of the frame. */
  readonly x: number;
  readonly y: number;
  /** Radius of the hot centre, as a fraction of frame height. */
  readonly radius: number;
  /** The intensely bright centre. */
  readonly hot: string;
  /** The ring around the centre — amber on warpBlue, teal on warpAmber. */
  readonly ring: string;
  readonly ringStrength: number;
  /** Outermost halo, a much wider and fainter wash. */
  readonly halo: string;
  readonly haloStrength: number;
  /** Radius/intensity pulse, +/- amount on a sine. */
  readonly pulseAmp: number;
  /** Frames. Must divide the loop length. */
  readonly pulsePeriod: number;
};

export type StreakConfig = {
  /** Starting radius, fraction of the frame diagonal. */
  readonly rStart: number;
  /** Radius at which a particle has certainly left the frame. */
  readonly rEnd: number;
  /** Streak length per unit of speed (speed is measured in px/frame). */
  readonly lengthScale: number;
  /** Hard cap on streak length, fraction of the frame diagonal. */
  readonly maxLength: number;
  /** Whole traversals completed per loop. Integers only. */
  readonly cycles: readonly number[];
  readonly cycleWeights: readonly number[];
};

export type DriftConfig = {
  /** Amplitude of the whole-field drift in px at 4K. */
  readonly fieldAmp: number;
  /** Amplitude of each particle's own tiny closed path, px at 4K. */
  readonly particleAmp: number;
};

export type DustConfig = {
  readonly count: number;
  /** Per-blob alpha range before the global gain. */
  readonly alpha: readonly [number, number];
  /** Blob radius range, fraction of frame width. */
  readonly radius: readonly [number, number];
  /** Radius breathing, +/- fraction. */
  readonly breathAmp: number;
  readonly colors: readonly ColorWeight[];
  /** Global multiplier on blob alpha. */
  readonly gain: number;
  /** Blur radius applied at 1/8 resolution. */
  readonly blur: number;
  /** When set, blobs cluster along this diagonal band. */
  readonly band: BandConfig | null;
  /** Number of density knots used when there is no band. */
  readonly knots: number;
  /** Spread of a knot, fraction of frame width. */
  readonly knotSpread: number;
  /** Share of blobs placed freely rather than on a knot or the band. */
  readonly scatterShare: number;
};

export type BurstConfig = {
  readonly intervalRange: readonly [number, number];
  readonly durationRange: readonly [number, number];
  readonly countRange: readonly [number, number];
  readonly gain: number;
};

export type FlareConfig = {
  /** Number of short bright twinkles per loop. */
  readonly perLoop: number;
  readonly durationRange: readonly [number, number];
  readonly gain: number;
};

export type SpikeConfig = {
  readonly count: number;
  /** Size range of the spiked stars, px at 4K. */
  readonly size: readonly [number, number];
  /** Spike arm length, px at 4K. */
  readonly length: readonly [number, number];
  readonly alpha: number;
};

export type BloomConfig = {
  /** Particles brighter than this contribute to the bloom. */
  readonly threshold: number;
  /** Blur radius in full-resolution px. */
  readonly radius: number;
  readonly strength: number;
};

export type Variant = {
  readonly id: VariantId;
  /** Composition id it is registered under. */
  readonly compositionId: string;
  readonly family: "warp" | "field";
  readonly loopLength: number;
  readonly fps: number;
  readonly mode: ParticleMode;

  readonly backgroundDeep: string;
  readonly backgroundWash: string;
  /** Placement and strength of the background wash gradient. */
  readonly wash: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly alpha: number;
  };

  readonly density: number;
  readonly size: readonly [number, number];
  /** Higher biases harder toward the small end. */
  readonly sizeBias: number;
  readonly brightness: readonly BrightnessTier[];
  readonly colors: readonly ColorWeight[];
  readonly twinkle: {
    readonly amp: number;
    /** Frames. Each must divide the loop length. */
    readonly periods: readonly number[];
  };
  /** Biases star placement toward a band, as fieldBlue's galactic plane does. */
  readonly starBand: (BandConfig & { readonly floor: number }) | null;

  readonly core: CoreConfig | null;
  readonly streak: StreakConfig | null;
  readonly drift: DriftConfig | null;
  readonly dust: DustConfig | null;
  readonly bursts: BurstConfig | null;
  readonly flares: FlareConfig | null;
  readonly spikes: SpikeConfig | null;

  readonly bloom: BloomConfig;
  readonly vignette: number;
  readonly grain: number;
};

const WARP_LOOP = 168; // divisors: 1 2 3 4 6 7 8 12 14 21 24 28 42 56 84 168
const FIELD_LOOP = 390; // divisors: 1 2 3 5 6 10 13 15 26 30 39 65 78 130 195 390
const FPS = 30;

/* ── Family A palettes ──────────────────────────────────────────────── */

const BLUE = {
  backgroundDeep: "#01060F",
  backgroundWash: "#06254A",
  particleBlue: "#4FA8E8",
  particleCyan: "#7FD4F5",
  particlePale: "#C8E8FF",
  particleWhite: "#FFFFFF",
  coreWhite: "#FFF8E8",
  coreAmber: "#F5A03F",
  dustBlue: "#1A4A8A",
} as const;

const VIOLET = {
  backgroundDeep: "#0A0420",
  backgroundWash: "#2A0F5C",
  particleViolet: "#8B5FE8",
  particleMagenta: "#E85FD4",
  particlePale: "#E0C8FF",
  particleWhite: "#FFFFFF",
  coreWhite: "#FFFFFF",
  dustViolet: "#3A1A7A",
} as const;

const AMBER = {
  backgroundDeep: "#100702",
  backgroundWash: "#3D1E06",
  particleAmber: "#F5B04F",
  particleOrange: "#E8763F",
  particlePale: "#FFE0B8",
  particleWhite: "#FFFFFF",
  coreWhite: "#FFFFFF",
  coreTeal: "#3FC4B8",
  dustAmber: "#7A4A14",
} as const;

/* ── Family B palettes ──────────────────────────────────────────────── */

const FIELD_BLUE = {
  backgroundDeep: "#01040E",
  backgroundWash: "#071A3A",
  particleWhite: "#FFFFFF",
  particlePale: "#D8E8FF",
  particleBlue: "#6F9FD4",
  particleDim: "#2A4A7A",
  dustBlue: "#14386B",
  dustPale: "#2E5C9F",
} as const;

const FIELD_TEAL = {
  backgroundDeep: "#010C0A",
  backgroundWash: "#063028",
  particleWhite: "#FFFFFF",
  particlePale: "#D8FFF4",
  particleTeal: "#4FC4B0",
  particleDim: "#1A5C4A",
  dustTeal: "#0F4A3A",
  dustPale: "#2E8A70",
} as const;

const FIELD_MONO = {
  backgroundDeep: "#000000",
  backgroundWash: "#0A0A0C",
  particleWhite: "#FFFFFF",
  particlePale: "#D0D4DA",
  particleMid: "#7A8088",
  particleDim: "#383C42",
} as const;

export const VARIANTS: Record<VariantId, Variant> = {
  /* ── A1 — off-centre core, warm centre in a cool field ──────────── */
  warpBlue: {
    id: "warpBlue",
    compositionId: "WarpBlue",
    family: "warp",
    loopLength: WARP_LOOP,
    fps: FPS,
    mode: "streak",

    backgroundDeep: BLUE.backgroundDeep,
    backgroundWash: BLUE.backgroundWash,
    wash: { x: 0.4, y: 0.42, radius: 0.85, alpha: 0.3 },

    density: 5000,
    size: [2, 7.5],
    sizeBias: 2.4,
    brightness: [
      { share: 0.62, range: [0.1, 0.32] },
      { share: 0.28, range: [0.32, 0.62] },
      { share: 0.1, range: [0.62, 1] },
    ],
    colors: [
      { hex: BLUE.particleBlue, weight: 0.6 },
      { hex: BLUE.particleCyan, weight: 0.22 },
      { hex: BLUE.particlePale, weight: 0.13 },
      { hex: BLUE.particleWhite, weight: 0.05 },
    ],
    twinkle: { amp: 0.12, periods: [24, 28, 42, 56, 84] },
    starBand: null,

    core: {
      x: 0.4,
      y: 0.42,
      radius: 0.042,
      hot: BLUE.coreWhite,
      ring: BLUE.coreAmber,
      ringStrength: 1,
      halo: BLUE.particleBlue,
      haloStrength: 0.5,
      pulseAmp: 0.14,
      pulsePeriod: 84,
    },
    streak: {
      rStart: 0.013,
      rEnd: 0.95,
      lengthScale: 2.6,
      maxLength: 0.2,
      cycles: [2, 3, 4],
      cycleWeights: [0.35, 0.4, 0.25],
    },
    drift: null,
    dust: {
      count: 30,
      alpha: [0.045, 0.095],
      radius: [0.07, 0.24],
      breathAmp: 0.12,
      colors: [
        { hex: BLUE.dustBlue, weight: 0.62 },
        { hex: BLUE.particleBlue, weight: 0.2 },
        { hex: BLUE.backgroundWash, weight: 0.18 },
      ],
      gain: 1.7,
      blur: 7,
      band: null,
      knots: 6,
      knotSpread: 0.22,
      scatterShare: 0.3,
    },
    bursts: null,
    flares: null,
    spikes: null,

    bloom: { threshold: 0.58, radius: 30, strength: 0.85 },
    vignette: 0.22,
    grain: 0.04,
  },

  /* ── A2 — centred core, no warm ring, denser and faster ─────────── */
  warpViolet: {
    id: "warpViolet",
    compositionId: "WarpViolet",
    family: "warp",
    loopLength: WARP_LOOP,
    fps: FPS,
    mode: "streak",

    backgroundDeep: VIOLET.backgroundDeep,
    backgroundWash: VIOLET.backgroundWash,
    wash: { x: 0.5, y: 0.5, radius: 0.8, alpha: 0.45 },

    density: 9000,
    size: [2, 5.5],
    sizeBias: 2.8,
    brightness: [
      { share: 0.68, range: [0.08, 0.26] },
      { share: 0.24, range: [0.26, 0.52] },
      { share: 0.08, range: [0.52, 0.92] },
    ],
    colors: [
      { hex: VIOLET.particleViolet, weight: 0.62 },
      { hex: VIOLET.particleMagenta, weight: 0.2 },
      { hex: VIOLET.particlePale, weight: 0.13 },
      { hex: VIOLET.particleWhite, weight: 0.05 },
    ],
    twinkle: { amp: 0.12, periods: [21, 24, 28, 42, 56] },
    starBand: null,

    core: {
      x: 0.5,
      y: 0.5,
      radius: 0.036,
      hot: VIOLET.coreWhite,
      // No warm ring here: the halo is the dominant particle hue, which is
      // what makes this version read colder than warpBlue.
      ring: VIOLET.particleViolet,
      ringStrength: 0.78,
      halo: VIOLET.dustViolet,
      haloStrength: 0.6,
      pulseAmp: 0.14,
      pulsePeriod: 56,
    },
    streak: {
      rStart: 0.013,
      rEnd: 0.95,
      // +40% over warpBlue.
      lengthScale: 3.64,
      maxLength: 0.28,
      cycles: [3, 4, 5],
      cycleWeights: [0.34, 0.4, 0.26],
    },
    drift: null,
    dust: {
      count: 16,
      alpha: [0.03, 0.055],
      radius: [0.07, 0.22],
      breathAmp: 0.12,
      colors: [
        { hex: VIOLET.dustViolet, weight: 0.68 },
        { hex: VIOLET.backgroundWash, weight: 0.32 },
      ],
      gain: 0.95,
      blur: 7,
      band: null,
      knots: 4,
      knotSpread: 0.16,
      scatterShare: 0.35,
    },
    bursts: {
      intervalRange: [30, 55],
      durationRange: [5, 8],
      countRange: [40, 70],
      gain: 4,
    },
    flares: null,
    spikes: null,

    bloom: { threshold: 0.5, radius: 26, strength: 0.8 },
    vignette: 0.22,
    grain: 0.04,
  },

  /* ── A3 — cool core in a warm field, sparse, heavy dust ─────────── */
  warpAmber: {
    id: "warpAmber",
    compositionId: "WarpAmber",
    family: "warp",
    loopLength: WARP_LOOP,
    fps: FPS,
    mode: "streak",

    backgroundDeep: AMBER.backgroundDeep,
    backgroundWash: AMBER.backgroundWash,
    wash: { x: 0.62, y: 0.55, radius: 0.9, alpha: 0.55 },

    density: 2500,
    size: [3.5, 9],
    sizeBias: 1.8,
    brightness: [
      { share: 0.48, range: [0.16, 0.4] },
      { share: 0.34, range: [0.4, 0.72] },
      { share: 0.18, range: [0.72, 1] },
    ],
    colors: [
      { hex: AMBER.particleAmber, weight: 0.58 },
      { hex: AMBER.particleOrange, weight: 0.24 },
      { hex: AMBER.particlePale, weight: 0.13 },
      { hex: AMBER.particleWhite, weight: 0.05 },
    ],
    twinkle: { amp: 0.12, periods: [28, 42, 56, 84, 168] },
    starBand: null,

    core: {
      x: 0.62,
      y: 0.55,
      radius: 0.046,
      hot: AMBER.coreWhite,
      // Cool ring in a warm field — the exact inverse of warpBlue.
      ring: AMBER.coreTeal,
      ringStrength: 1,
      halo: AMBER.particleAmber,
      haloStrength: 0.45,
      pulseAmp: 0.14,
      pulsePeriod: 84,
    },
    streak: {
      rStart: 0.013,
      rEnd: 0.95,
      // -35% from warpBlue.
      lengthScale: 1.69,
      maxLength: 0.14,
      cycles: [1, 2, 3],
      cycleWeights: [0.3, 0.44, 0.26],
    },
    drift: null,
    dust: {
      count: 34,
      alpha: [0.06, 0.1],
      radius: [0.09, 0.28],
      breathAmp: 0.12,
      colors: [
        { hex: AMBER.dustAmber, weight: 0.6 },
        { hex: AMBER.particleOrange, weight: 0.18 },
        { hex: AMBER.backgroundWash, weight: 0.22 },
      ],
      gain: 2.4,
      blur: 8,
      band: null,
      knots: 6,
      knotSpread: 0.18,
      scatterShare: 0.3,
    },
    bursts: null,
    flares: null,
    spikes: null,

    bloom: { threshold: 0.55, radius: 34, strength: 1 },
    vignette: 0.22,
    grain: 0.04,
  },

  /* ── B1 — dense field with a galactic plane ─────────────────────── */
  fieldBlue: {
    id: "fieldBlue",
    compositionId: "FieldBlue",
    family: "field",
    loopLength: FIELD_LOOP,
    fps: FPS,
    mode: "point",

    backgroundDeep: FIELD_BLUE.backgroundDeep,
    backgroundWash: FIELD_BLUE.backgroundWash,
    wash: { x: 0.5, y: 0.5, radius: 0.95, alpha: 0.4 },

    density: 14000,
    size: [2, 6.5],
    sizeBias: 3,
    brightness: [
      { share: 0.8, range: [0.05, 0.2] },
      { share: 0.15, range: [0.2, 0.5] },
      { share: 0.05, range: [0.5, 1] },
    ],
    colors: [
      { hex: FIELD_BLUE.particleDim, weight: 0.55 },
      { hex: FIELD_BLUE.particleBlue, weight: 0.28 },
      { hex: FIELD_BLUE.particlePale, weight: 0.12 },
      { hex: FIELD_BLUE.particleWhite, weight: 0.05 },
    ],
    twinkle: { amp: 0.1, periods: [26, 30, 39, 65, 78] },
    starBand: { angleDeg: -27, width: 0.14, offset: -0.02, floor: 0.22 },

    core: null,
    streak: null,
    drift: { fieldAmp: 20, particleAmp: 2.5 },
    dust: {
      count: 30,
      alpha: [0.05, 0.1],
      radius: [0.18, 0.42],
      breathAmp: 0.12,
      colors: [
        { hex: FIELD_BLUE.dustBlue, weight: 0.62 },
        { hex: FIELD_BLUE.dustPale, weight: 0.38 },
      ],
      gain: 1.15,
      blur: 9,
      band: { angleDeg: -27, width: 0.09, offset: -0.02 },
      knots: 4,
      knotSpread: 0.14,
      scatterShare: 0.12,
    },
    bursts: null,
    flares: { perLoop: 46, durationRange: [3, 5], gain: 3 },
    spikes: null,

    bloom: { threshold: 0.48, radius: 28, strength: 0.9 },
    vignette: 0.22,
    grain: 0.04,
  },

  /* ── B2 — sparser, no band, real voids ──────────────────────────── */
  fieldTeal: {
    id: "fieldTeal",
    compositionId: "FieldTeal",
    family: "field",
    loopLength: FIELD_LOOP,
    fps: FPS,
    mode: "point",

    backgroundDeep: FIELD_TEAL.backgroundDeep,
    backgroundWash: FIELD_TEAL.backgroundWash,
    wash: { x: 0.5, y: 0.48, radius: 0.9, alpha: 0.32 },

    density: 7000,
    size: [2, 7],
    sizeBias: 2.6,
    brightness: [
      { share: 0.74, range: [0.05, 0.2] },
      { share: 0.15, range: [0.2, 0.5] },
      { share: 0.11, range: [0.5, 1] },
    ],
    colors: [
      { hex: FIELD_TEAL.particleDim, weight: 0.5 },
      { hex: FIELD_TEAL.particleTeal, weight: 0.3 },
      { hex: FIELD_TEAL.particlePale, weight: 0.12 },
      { hex: FIELD_TEAL.particleWhite, weight: 0.08 },
    ],
    twinkle: { amp: 0.1, periods: [26, 30, 39, 65, 78] },
    starBand: null,

    core: null,
    streak: null,
    drift: { fieldAmp: 10, particleAmp: 1.6 },
    dust: {
      count: 22,
      alpha: [0.04, 0.09],
      radius: [0.14, 0.34],
      breathAmp: 0.12,
      colors: [
        { hex: FIELD_TEAL.dustTeal, weight: 0.66 },
        { hex: FIELD_TEAL.dustPale, weight: 0.34 },
      ],
      gain: 1,
      blur: 9,
      band: null,
      // Few, tight knots with nothing between them: isolated clouds.
      knots: 4,
      knotSpread: 0.1,
      scatterShare: 0.1,
    },
    bursts: null,
    flares: { perLoop: 20, durationRange: [3, 5], gain: 3 },
    spikes: null,

    bloom: { threshold: 0.46, radius: 30, strength: 0.95 },
    vignette: 0.22,
    grain: 0.04,
  },

  /* ── B3 — monochrome, no dust, densest of the six ───────────────── */
  fieldMono: {
    id: "fieldMono",
    compositionId: "FieldMono",
    family: "field",
    loopLength: FIELD_LOOP,
    fps: FPS,
    mode: "point",

    backgroundDeep: FIELD_MONO.backgroundDeep,
    backgroundWash: FIELD_MONO.backgroundWash,
    wash: { x: 0.5, y: 0.5, radius: 1, alpha: 0.5 },

    density: 22000,
    size: [2, 6],
    sizeBias: 3.4,
    brightness: [
      { share: 0.88, range: [0.03, 0.16] },
      { share: 0.09, range: [0.16, 0.42] },
      { share: 0.03, range: [0.42, 1] },
    ],
    colors: [
      { hex: FIELD_MONO.particleDim, weight: 0.55 },
      { hex: FIELD_MONO.particleMid, weight: 0.28 },
      { hex: FIELD_MONO.particlePale, weight: 0.12 },
      { hex: FIELD_MONO.particleWhite, weight: 0.05 },
    ],
    // Twinkle is the only motion left here, so it carries a little more.
    twinkle: { amp: 0.18, periods: [26, 30, 39, 65, 78] },
    starBand: null,

    core: null,
    streak: null,
    drift: { fieldAmp: 4, particleAmp: 0.8 },
    dust: null,
    bursts: null,
    flares: { perLoop: 16, durationRange: [3, 5], gain: 2.6 },
    spikes: {
      count: 25,
      size: [7.5, 11],
      length: [55, 115],
      alpha: 0.5,
    },

    bloom: { threshold: 0.45, radius: 24, strength: 0.8 },
    vignette: 0.22,
    grain: 0.04,
  },
};

export const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[];
