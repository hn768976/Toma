import { mixHex } from "../lib/color";

// The ONE place any colour literal appears in this project.
//
// Both compositions (ForestEmber / ForestFrost) run the exact same component
// tree; everything that differs between a burnt forest at night and a winter
// forest in falling snow is a value in this object.

export type VariantName = "ember" | "frost";

// "rise" and "fall" are the same particle system with an opposite sign on the
// vertical component. `direction` is that sign: +1 travels up the frame,
// -1 travels down it. Nothing else in ParticleField knows which variant it is.
export type ParticleMode = "rise" | "fall";

export type GroundTreatment = "emberBed" | "snowBed";

export type Palette = {
  skyDeep: string;
  skyMid: string;
  fogPale: string;
  fogBright: string;
  /**
   * The colour the low haze is lit toward. Mixing smoke toward a warm, fairly
   * bright tone is what makes it read as smoke lit from below by a fire;
   * mixing it toward the dark ground colour just makes it dirty.
   */
  fogWarm: string;
  treeNear: string;
  treeMid: string;
  treeFar: string;
  /** Hottest / brightest particles — a small minority of them. */
  particleHot: string;
  /** The bulk of the particles. */
  particleMid: string;
  /** The most distant, dimmest particles. */
  particleCool: string;
  groundGlow: string;
  groundDark: string;
};

export type ParticleSettings = {
  mode: ParticleMode;
  /** +1 = up the frame, -1 = down it. Derived from `mode`, never hardcoded. */
  direction: 1 | -1;
  count: number;
  /** Sprite diameter range in 4K pixels. */
  sizeMin: number;
  sizeMax: number;
  /**
   * 0 = a soft even falloff all the way to the centre (snow),
   * 1 = a small hot core with a soft halo around it (embers).
   */
  coreHardness: number;
  /** Embers spark: two incommensurate sines multiplied. */
  flicker: boolean;
  /** Snow instead fades gently in and out as it passes through fog. */
  opacityDrift: boolean;
  /** Horizontal wander amplitude, as a fraction of frame width. */
  wanderMin: number;
  wanderMax: number;
  /** Flakes tumble; embers do not. */
  rotate: boolean;
  /**
   * Vertical squash of the particle sprite. Rotation on a perfectly round
   * sprite is invisible, so flakes are drawn slightly elliptical and the
   * tumble actually reads.
   */
  spriteAspect: number;
  /** Larger particles travel faster (embers) or not (snow falls evenly). */
  speedFollowsSize: boolean;
  /** Fraction of particles caught in a draught, and how much faster they go. */
  fastFraction: number;
  fastBoost: number;
  /** Base number of whole traversals completed in one 240-frame loop. */
  cyclesMin: number;
  cyclesMax: number;
  /**
   * Embers are light and add up where they overlap; snow is matter and simply
   * covers what is behind it. That is the difference between 'lighter' and
   * 'source-over', and it matters more to the read than the colour does.
   */
  blend: "lighter" | "source-over";
  bloomRadius: number;
  bloomStrength: number;
};

export type SkySettings = {
  /**
   * How far the horizon band lifts toward the haze colour, 0..1. Low values
   * keep the sky black and let the ground be the only light in the frame.
   */
  horizonLift: number;
  /**
   * How far that lift is pushed toward `groundGlow`, 0..1. This is what makes
   * the sky read as lit BY the fire rather than by an ambient grey dusk.
   */
  horizonWarm: number;
  /** Alpha of the soft off-centre brightening in the upper frame. */
  glowAlpha: number;
};

export type FogSettings = {
  blobCount: number;
  /** Heights the blobs cluster into, as fractions of frame height. */
  strata: number[];
  /** Master opacity multiplier for the whole fog stack. */
  opacity: number;
  /** How far the lower fog strata are mixed toward `groundGlow`, 0..1. */
  warmCast: number;
  /** Height the warm cast starts at, and how far it takes to reach full. */
  warmFrom: number;
  warmSpan: number;
  /** Blur radius applied to the fog buffer, in 4K pixels. */
  blur: number;
  /** Opacity of the single angled light shaft. */
  shaftOpacity: number;
};

export type GroundSettings = {
  treatment: GroundTreatment;
  /** Height of the glow band, as a fraction of frame height. */
  bandFrac: number;
  /** Particles clustered in the band — denser than those in the air. */
  bedCount: number;
  bedSizeMin: number;
  bedSizeMax: number;
  /** Amplitude of the wobble on the band's upper edge, fraction of height. */
  edgeIrregularity: number;
  /** How far the band's peak brightness swings over the loop, 0..1. */
  pulseDepth: number;
  bloomRadius: number;
  bloomStrength: number;
};

export type Variant = {
  palette: Palette;
  particles: ParticleSettings;
  sky: SkySettings;
  fog: FogSettings;
  ground: GroundSettings;
};

/**
 * The depth ramp every tree instance is coloured from: 0 = the sharp near
 * trees, 1 = trees fully dissolved into the fog. Sampling one continuous ramp
 * (rather than giving each band a flat colour) is what makes the four bands
 * recede into each other instead of reading as three cut-out layers.
 */
export const treeTintAt = (palette: Palette, t: number): string => {
  if (t < 0.34) return mixHex(palette.treeNear, palette.treeMid, t / 0.34);
  if (t < 0.68)
    return mixHex(palette.treeMid, palette.treeFar, (t - 0.34) / 0.34);
  return mixHex(palette.treeFar, palette.fogPale, (t - 0.68) / 0.32);
};

export const VARIANTS: Record<VariantName, Variant> = {
  // ── Burnt forest, rising embers ────────────────────────────────────────
  ember: {
    palette: {
      skyDeep: "#08080B",
      skyMid: "#141419",
      fogPale: "#47413C",
      fogBright: "#9A968F",
      fogWarm: "#8A3A16",
      treeNear: "#050506",
      treeMid: "#0F0F13",
      treeFar: "#26262E",
      particleHot: "#FFB88A",
      particleMid: "#F5763A",
      particleCool: "#E8402A",
      groundGlow: "#6B1408",
      groundDark: "#2A0A04",
    },
    particles: {
      mode: "rise",
      direction: 1,
      count: 180,
      sizeMin: 3,
      sizeMax: 14,
      coreHardness: 1,
      flicker: true,
      opacityDrift: false,
      wanderMin: 0.006,
      wanderMax: 0.022,
      rotate: false,
      spriteAspect: 1,
      speedFollowsSize: true,
      fastFraction: 0.2,
      fastBoost: 2,
      cyclesMin: 1,
      cyclesMax: 3,
      blend: "lighter",
      bloomRadius: 22,
      bloomStrength: 0.55,
    },
    fog: {
      blobCount: 20,
      // Low and warm: the haze hangs just above the coals and is lit by them,
      // which is the whole difference between "night fire" and "grey dusk".
      strata: [0.5, 0.63, 0.75],
      opacity: 0.22,
      warmCast: 0.85,
      warmFrom: 0.18,
      warmSpan: 0.42,
      blur: 260,
      shaftOpacity: 0.3,
    },
    sky: {
      horizonLift: 0.14,
      horizonWarm: 0.62,
      glowAlpha: 0.05,
    },
    ground: {
      treatment: "emberBed",
      bandFrac: 0.19,
      bedCount: 280,
      bedSizeMin: 3,
      bedSizeMax: 11,
      edgeIrregularity: 0,
      pulseDepth: 0.22,
      bloomRadius: 30,
      bloomStrength: 0.34,
    },
  },

  // ── Winter forest, falling snow ────────────────────────────────────────
  frost: {
    palette: {
      skyDeep: "#0E141C",
      skyMid: "#1E2C3C",
      fogPale: "#7A8A9E",
      fogBright: "#C8D8E8",
      // Inert: the frost variant's warmCast is 0.
      fogWarm: "#1A222E",
      treeNear: "#060A0E",
      treeMid: "#16202C",
      treeFar: "#33445A",
      particleHot: "#FFFFFF",
      particleMid: "#D8E4F0",
      particleCool: "#8A9AAC",
      groundGlow: "#6A7A8E",
      groundDark: "#1A222E",
    },
    particles: {
      mode: "fall",
      direction: -1,
      count: 320,
      sizeMin: 5,
      sizeMax: 22,
      coreHardness: 0,
      flicker: false,
      opacityDrift: true,
      wanderMin: 0.02,
      wanderMax: 0.075,
      rotate: true,
      spriteAspect: 0.72,
      speedFollowsSize: false,
      fastFraction: 0.15,
      fastBoost: 1,
      cyclesMin: 1,
      cyclesMax: 2,
      blend: "source-over",
      bloomRadius: 16,
      bloomStrength: 0.28,
    },
    fog: {
      blobCount: 30,
      strata: [0.44, 0.58, 0.72],
      opacity: 0.35,
      warmCast: 0,
      warmFrom: 0.42,
      warmSpan: 0.5,
      blur: 260,
      shaftOpacity: 0.45,
    },
    sky: {
      horizonLift: 0.34,
      horizonWarm: 0,
      glowAlpha: 0.1,
    },
    ground: {
      treatment: "snowBed",
      bandFrac: 0.13,
      bedCount: 90,
      bedSizeMin: 4,
      bedSizeMax: 12,
      edgeIrregularity: 0.055,
      pulseDepth: 0.12,
      bloomRadius: 20,
      bloomStrength: 0.2,
    },
  },
};
