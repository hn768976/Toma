/**
 * The single source of truth for how the three overlays differ.
 *
 * A variant is a palette plus a set of per-layer intensities plus a little
 * motion tuning — never a different implementation. Every layer component
 * takes an `intensity`, and a variant switches a layer off by setting it to
 * zero. No hex literal appears anywhere else in the project.
 */

export type VariantName = "dust";

export type LeakPalette = {
  /** The body of the leak. */
  amber: string;
  /** Its hot core. */
  white: string;
  /** The chromatic fringe on its leading edge. */
  cyan: string;
};

export type Palette = {
  /** Near-black. In screen/add blend this is what becomes transparent. */
  base: string;
  dustPale: string;
  /** The brighter minority of motes. Falls back to dustPale. */
  dustBright?: string;
  /** Omitted by variants with no scratches. */
  scratchPale?: string;
  /** Omitted by variants with no hairs. Falls back to scratchPale. */
  hairPale?: string;
  blotchLight: string;
  /** Also the colour the edge vignette multiplies toward. */
  blotchDark: string;
  /** Grain tint. #FFFFFF is strictly monochrome; a warm hex biases it. */
  grainTint: string;
  /** Omitted by variants with no light leak. */
  leak?: LeakPalette;
};

export type LayerSettings = {
  dust: {
    intensity: number;
    /** Mote count at intensity 1; scaled down linearly by intensity. */
    count: number;
  };
  scratches: {
    intensity: number;
    minConcurrent: number;
    maxConcurrent: number;
    minLife: number;
    maxLife: number;
    minGap: number;
    maxGap: number;
    /** Hairline width in px at 4K; thick scratches may exceed it. */
    baseWidth: number;
    maxWidth: number;
    /** Probability a scratch is one of the thick, ragged-edged kind. */
    thickChance: number;
    /** Short horizontal scratches, present at any moment. */
    horizontalConcurrent: number;
  };
  blotches: {
    intensity: number;
    count: number;
  };
  hairs: {
    intensity: number;
    maxConcurrent: number;
    minLife: number;
    maxLife: number;
    minGap: number;
    maxGap: number;
  };
  grain: {
    intensity: number;
    /**
     * Pixel pitch of the grain: 1 generates one grain per output pixel, 1.4
     * generates it coarser and upscales so grains clump into visible specks.
     */
    pitch: number;
    /** 0 = flat density, 1 = strongly uneven density across the frame. */
    densityVariation: number;
    /** Larger transient grain clusters visible at any moment. */
    clusterConcurrent: number;
  };
  leak: {
    intensity: number;
    /** Leak events across the loop. */
    eventCount: number;
    buildFrames: number;
    holdFrames: number;
    recedeFrames: number;
    /** Fraction of the frame the leak reaches inward. */
    minReach: number;
    maxReach: number;
    /** Probability a given leak event contains a burn-through flash. */
    flashChance: number;
  };
  vignette: {
    intensity: number;
  };
  splice: {
    intensity: number;
    minGap: number;
    maxGap: number;
    minLife: number;
    maxLife: number;
  };
};

export type MotionSettings = {
  /** Multiplier on how far dust motes wander over the loop. */
  dustWander: number;
  /** Multiplier on blotch drift distance. */
  blotchDrift: number;
  /**
   * Whole grid-cells the grain density field drifts over one loop. Must be an
   * integer or the density pattern will not close the loop.
   */
  grainDensityCycles: number;
};

export type VariantConfig = {
  palette: Palette;
  layers: LayerSettings;
  motion: MotionSettings;
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /**
   * "dust" — the general-purpose overlay. Neutral, moderate, usable over
   * almost anything: dust and scratches with no colour cast.
   */
  dust: {
    palette: {
      base: "#0E1014",
      dustPale: "#C8CDD4",
      dustBright: "#F0F4F8",
      scratchPale: "#E0E4EA",
      blotchLight: "#4A5058",
      blotchDark: "#060709",
      grainTint: "#FFFFFF",
    },
    layers: {
      dust: { intensity: 1.0, count: 450 },
      scratches: {
        intensity: 0.7,
        minConcurrent: 3,
        maxConcurrent: 8,
        minLife: 4,
        maxLife: 30,
        minGap: 8,
        maxGap: 120,
        baseWidth: 1,
        maxWidth: 3,
        thickChance: 0,
        horizontalConcurrent: 0,
      },
      blotches: { intensity: 0.6, count: 25 },
      hairs: {
        intensity: 0.5,
        maxConcurrent: 2,
        minLife: 20,
        maxLife: 60,
        minGap: 70,
        maxGap: 280,
      },
      grain: { intensity: 0.5, pitch: 1, densityVariation: 0.25, clusterConcurrent: 0 },
      leak: {
        intensity: 0,
        eventCount: 0,
        buildFrames: 50,
        holdFrames: 40,
        recedeFrames: 70,
        minReach: 0.33,
        maxReach: 0.5,
        flashChance: 0,
      },
      vignette: { intensity: 0.6 },
      splice: { intensity: 0, minGap: 150, maxGap: 260, minLife: 2, maxLife: 3 },
    },
    motion: {
      dustWander: 1,
      blotchDrift: 1,
      grainDensityCycles: 1,
    },
  },
};
