/**
 * Every colour and every per-version parameter of the piece lives here.
 * Nothing outside this file contains a hex literal — the three versions are
 * the same component driven by three entries of VARIANTS.
 */

export type VariantName = "violet" | "amber" | "mono";

/** How the ground below the horizon is treated. */
export type FloorMode = "wet" | "dry" | "none";

export type Palette = {
  /** Near-black base the whole frame sits on. */
  backgroundDeep: string;
  /** Broad glow washed around the vanishing point. */
  backgroundWash: string;
  /** The hue most streaks take. */
  streakDominant: string;
  /** A neighbouring hue, on a large minority. */
  streakSecondary: string;
  /** The cool (or, in mono, the dim) accent, scattered. */
  streakAccent: string;
  /** The brightest minority — roughly 15% of the field. */
  streakWhite: string;
  /** The core of the flare at the vanishing point. */
  coreWhite: string;
  /** Tint mixed into the floor reflection. Unused when floor mode is "none". */
  floorTint: string;
  /** The band of light sitting on the horizon line. */
  horizonGlow: string;
};

export type Variant = {
  name: VariantName;
  palette: Palette;
  /** Colour slot weights; they are normalised, so they need not sum to 1. */
  colourWeights: {
    dominant: number;
    secondary: number;
    accent: number;
    white: number;
  };
  vanishingPoint: {
    /** Fraction of frame width. */
    x: number;
    /** Fraction of frame height — also the horizon line when there is a floor. */
    y: number;
  };
  streaks: {
    /** How many streaks live in the field at once. */
    count: number;
    /** Multiplier on every streak's width. */
    widthScale: number;
    /** Multiplier on every streak's alpha. */
    brightnessScale: number;
    /** Share that stay near the vanishing point — distant lights, not yet blurred. */
    shortFraction: number;
    /** Share that span most of the frame and carry the eye. */
    heroFraction: number;
    /**
     * How lumpy the angular distribution is. 0 is a perfectly even sunburst;
     * high values give dense fans separated by sparse sectors.
     */
    lumpiness: number;
    /**
     * How strongly angles are pulled away from straight down. Where a floor
     * clips the field at the horizon, streaks aimed downward would be thrown
     * away, so the versions with a floor spend them above it instead.
     */
    downBias: number;
    /**
     * How strongly the field favours the horizontal. High values open a dark
     * cone above the vanishing point and pack the light into the left and
     * right walls, which is what makes the frame read as a street being
     * driven down rather than as a sunburst.
     */
    corridor: number;
    /**
     * Streaks are grouped into bundles of near-identical angle, which is what
     * gives a real zoom blur its sheets of parallel filaments. This is how
     * much of its natural angular cell a bundle collapses into: 1 leaves the
     * field evenly spread, small values draw it into tight ribbons.
     */
    bundleTightness: number;
    /**
     * How many bundles the field is divided into. Bundles also brighten and
     * fade on their own schedules, which is how lit facades arrive and pass.
     */
    bundles: number;
    /**
     * How many groups the pulsing works on. This is deliberately far coarser
     * than the bundles: a few dozen wide sectors swelling and fading changes
     * the frame's large-scale structure, where hundreds of independent little
     * pulses would just average out to a constant.
     */
    pulseGroups: number;
    /** How hard the groups pulse. 0 holds the field's structure still. */
    bundlePulse: number;
    /** Share of streaks that ignore bundling, so the gaps are not empty. */
    freeShare: number;
  };
  motion: {
    /**
     * Whole traversals of the frame each streak makes across the loop. Whole
     * numbers are what let the loop close. Higher is faster.
     */
    cyclesMin: number;
    cyclesMax: number;
  };
  floor: {
    mode: FloorMode;
    /** Opacity of the mirrored field below the horizon. */
    opacity: number;
    /** Vertical stretch applied to the reflection. 1 is a plain mirror. */
    smear: number;
    /** Blur radius of the reflection, in frame pixels. */
    blur: number;
    /** Multiplier on the brightness of the band sitting at the horizon. */
    horizonBand: number;
  };
  core: {
    /** Overall size multiplier of the flare. */
    scale: number;
    /** The wide flat horizontal streak through the core. */
    anamorphic: boolean;
  };
  bursts: {
    gapMin: number;
    gapMax: number;
    streakCountMin: number;
    streakCountMax: number;
    durationMin: number;
    durationMax: number;
  };
};

/** Used when a composition is rendered without a valid variant prop. */
export const DEFAULT_VARIANT: VariantName = "violet";

export const VARIANTS: Record<VariantName, Variant> = {
  /* ── v1: centred, dense, wet floor ─────────────────────────────────── */
  violet: {
    name: "violet",
    palette: {
      backgroundDeep: "#0A0418",
      backgroundWash: "#2A0F52",
      streakDominant: "#8B3FE8",
      streakSecondary: "#E85FD4",
      streakAccent: "#4FD4F5",
      streakWhite: "#F0E8FF",
      coreWhite: "#FFFFFF",
      floorTint: "#4A1F8A",
      horizonGlow: "#C48FFF",
    },
    colourWeights: { dominant: 0.52, secondary: 0.18, accent: 0.15, white: 0.15 },
    vanishingPoint: { x: 0.5, y: 0.62 },
    streaks: {
      count: 2600,
      widthScale: 1,
      brightnessScale: 1,
      shortFraction: 0.22,
      heroFraction: 0.05,
      lumpiness: 1,
      downBias: 0.82,
      corridor: 0.85,
      bundleTightness: 0.24,
      bundles: 300,
      pulseGroups: 24,
      bundlePulse: 1.05,
      freeShare: 0.2,
    },
    motion: { cyclesMin: 3, cyclesMax: 8 },
    floor: { mode: "wet", opacity: 0.35, smear: 1.45, blur: 12, horizonBand: 1 },
    core: { scale: 1, anamorphic: true },
    bursts: {
      gapMin: 40,
      gapMax: 80,
      streakCountMin: 15,
      streakCountMax: 25,
      durationMin: 6,
      durationMax: 10,
    },
  },

  /* ── v2: off-centre, sparser and heavier, dry floor ────────────────── */
  amber: {
    name: "amber",
    palette: {
      backgroundDeep: "#140A02",
      backgroundWash: "#4A2408",
      streakDominant: "#F5A03F",
      streakSecondary: "#E8763F",
      streakAccent: "#3FC4B8",
      streakWhite: "#FFF4E0",
      coreWhite: "#FFFFFF",
      floorTint: "#7A4A14",
      horizonGlow: "#FFD48F",
    },
    colourWeights: { dominant: 0.52, secondary: 0.18, accent: 0.15, white: 0.15 },
    vanishingPoint: { x: 0.34, y: 0.58 },
    streaks: {
      count: 1500,
      widthScale: 1.75,
      brightnessScale: 1.25,
      shortFraction: 0.18,
      heroFraction: 0.08,
      lumpiness: 1.05,
      downBias: 0.82,
      corridor: 0.8,
      bundleTightness: 0.28,
      bundles: 180,
      pulseGroups: 18,
      bundlePulse: 1,
      freeShare: 0.22,
    },
    motion: { cyclesMin: 3, cyclesMax: 8 },
    floor: { mode: "dry", opacity: 0.15, smear: 1, blur: 72, horizonBand: 1.5 },
    core: { scale: 1, anamorphic: true },
    bursts: {
      gapMin: 70,
      gapMax: 130,
      streakCountMin: 30,
      streakCountMax: 45,
      durationMin: 12,
      durationMax: 18,
    },
  },

  /* ── v3: monochrome, no floor, high vanishing point ────────────────── */
  mono: {
    name: "mono",
    palette: {
      backgroundDeep: "#030305",
      backgroundWash: "#14161C",
      streakDominant: "#B0B8C4",
      streakSecondary: "#6A7280",
      streakAccent: "#3A4048",
      streakWhite: "#F0F4F8",
      coreWhite: "#FFFFFF",
      floorTint: "#3A4048",
      horizonGlow: "#D8DEE8",
    },
    colourWeights: { dominant: 0.4, secondary: 0.27, accent: 0.18, white: 0.15 },
    vanishingPoint: { x: 0.5, y: 0.45 },
    streaks: {
      count: 4000,
      widthScale: 0.55,
      brightnessScale: 0.72,
      shortFraction: 0.25,
      heroFraction: 0.04,
      // Near-uniform: with no colour and no floor the field is meant to read
      // as a starfield rather than as a city, so the sunburst risk is taken.
      lumpiness: 0.12,
      downBias: 0,
      corridor: 0,
      // Deliberately unbundled: v3 is meant to read as a starfield.
      bundleTightness: 1,
      // No angular bundling in v3, but the groups still pulse, so the field
      // keeps changing instead of sitting as a fixed spray.
      bundles: 260,
      pulseGroups: 30,
      bundlePulse: 0.85,
      freeShare: 1,
    },
    motion: { cyclesMin: 3, cyclesMax: 8 },
    floor: { mode: "none", opacity: 0, smear: 1, blur: 0, horizonBand: 0 },
    core: { scale: 1.05, anamorphic: false },
    bursts: {
      gapMin: 25,
      gapMax: 50,
      streakCountMin: 10,
      streakCountMax: 18,
      durationMin: 6,
      durationMax: 10,
    },
  },
};
