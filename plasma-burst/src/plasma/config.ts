/**
 * Top-level configuration. Everything that shapes the piece — discharge count,
 * recursion depth, bloom strength, cloud density and the intensity curve — is
 * a number in this file.
 *
 * Lengths and widths are authored in 4K pixels (the composition is 3840x2160)
 * and multiplied by a resolution scale at draw time, so the same numbers hold
 * if the composition is ever rendered at another size.
 */

/** Frames per second and total length. Must match the <Composition>. */
export const TIMING = {
  fps: 30,
  durationInFrames: 120,
} as const;

/**
 * The intensity curve — the whole shape of the piece. A single 0..1 value
 * drives filament count, brightness, cloud density and bloom together.
 */
export const CURVE = {
  /** Frames 0..8: pure black. The emptiness is what makes the strike land. */
  blackHoldEnd: 8,
  /** Frames 8..14: ignition. 0 -> 1 in six frames, hard ease-out. */
  ignitionEnd: 14,
  /** Frames 14..30: peak. Holds near 1 but flickers — the discharge is unstable. */
  peakEnd: 30,
  /** Frames 30..70: decay. 1 -> 0.25 on a long ease-out. */
  decayEnd: 70,
  /** Frames 70..110: afterglow. 0.25 -> 0.02, cloud only, occasional flicker. */
  afterglowEnd: 110,
  /** Frames 110..116: the last 0.02 goes to nothing. 116..120 is black. */
  fadeEnd: 116,

  /** Higher = harder ease-out on the ignition ramp; 4 puts >50% in one frame. */
  ignitionExponent: 4,
  /** Peak intensity wanders between this floor and 1.0. */
  peakFlickerFloor: 0.75,
  /** Peak flicker occasionally drops harder than the floor. */
  peakDipChance: 0.14,
  peakDipDepth: 0.78,
  /** Decay carries a gentler version of the same instability. */
  decayFlickerFloor: 0.86,
  /** Where the decay lands at frame 70, and the afterglow at frame 110. */
  decayFloor: 0.25,
  afterglowFloor: 0.02,
} as const;

/**
 * How often the filament web is re-seeded. A static web reads as a still image
 * with a fade; re-seeding every 2-3 frames at peak makes it writhe. Each
 * re-seeded web is generated once and reused for its whole hold.
 */
export const RESEED = {
  peakHoldMin: 2,
  peakHoldMax: 3,
  decayHoldMin: 3,
  decayHoldMax: 6,
  afterglowHoldMin: 6,
  afterglowHoldMax: 11,
} as const;

/** The discharge centre, in fractions of frame width/height. */
export const CENTRE = {
  x: 0.545,
  y: 0.455,
} as const;

export const DISCHARGE = {
  /** Primary filaments, each with its own recursive branch tree. */
  primaryCount: 40,
  /** Recursive midpoint-displacement levels for a primary. */
  recursionDepth: 5,
  /**
   * Perpendicular displacement as a fraction of the segment being split.
   * Deliberately low: plasma curls, lightning zigzags.
   */
  displacementScale: 0.2,
  /**
   * Extra per-level falloff on top of the natural halving. Steep, so the deep
   * levels contribute almost nothing: the filament keeps its point density (and
   * so its smoothness) without acquiring high-frequency noise.
   */
  levelDecay: 0.62,
  /** Filaments fork constantly — this is much higher than a lightning bolt. */
  branchProbability: 0.55,
  /** Forking thins out with each level and each generation. */
  branchLevelFalloff: 0.75,
  branchGenerationFalloff: 0.6,
  /**
   * Branches only spawn off the first two (largest) levels. Forking off deeper
   * levels gives fine twigs; plasma forks into further sweeping arcs.
   */
  branchMaxLevel: 2,
  /** Generations of forking: 0 = primary, so 2 gives three tiers. */
  maxGeneration: 2,
  /** Fraction of filaments that curl back on themselves into a loop. */
  loopProbability: 0.38,
  /** How far a straight filament bows before displacement — the sinuous base. */
  bowAmount: 0.55,
  /** Fraction of primaries that start at the core; the rest start on others. */
  coreOriginFraction: 0.4,
  /** Fraction of filaments rendered at the hotter cyan temperature. */
  hotFraction: 0.36,
  /** Filament reach as a fraction of the smaller frame dimension. */
  reach: 0.47,
  /** Per-generation stroke width multiplier. */
  generationWidth: [1, 0.8, 0.62] as const,

  /**
   * The four composited passes. The thin white core inside a wide soft glow is
   * the entire effect — a single thick semi-transparent stroke will not do it.
   *
   * `downsample` renders the pass on a reduced-resolution scratch canvas and
   * blurs it there before upscaling. The two wide passes are pure low-frequency
   * glow, so nothing is lost and the blur costs a fraction of what an
   * equivalent per-stroke shadow would at 4K. `blur` is always expressed as the
   * effective radius in 4K pixels.
   */
  passes: {
    /** 1. Wide atmospheric glow — very wide, very low alpha, 70px of blur. */
    atmosphere: { width: 92, alpha: 0.16, blur: 70, downsample: 4, crisp: false },
    /** 2. Outer glow — medium width, low alpha, 32px of blur. */
    outer: { width: 34, alpha: 0.34, blur: 32, downsample: 2, crisp: false },
    /**
     * 3. Mid channel. The glow is rendered at half resolution and the stroke
     * itself is laid crisply over it at full resolution — which is what a 10px
     * shadow under a stroke amounts to, at a fraction of the cost at 4K.
     */
    channel: { width: 13, alpha: 0.38, blur: 10, downsample: 2, crisp: true },
    /** 4. Hot core — a thin near-white stroke, no blur. This is the effect. */
    core: { width: 3.2, alpha: 0.8, blur: 0, downsample: 1, crisp: true },
  },
} as const;

export const CLOUD = {
  /** Overlapping radial blobs. */
  blobCount: 30,
  /** Cloud density multiplier — scales every blob's alpha. */
  density: 1,
  /**
   * Computed at 1/8 resolution and upscaled with imageSmoothingQuality 'high'.
   * It is all soft gradient; nothing is lost and it roughly quarters the cost.
   */
  resolutionDivisor: 8,
  /** Blur radius applied in the reduced-resolution space. */
  blurRadius: 3.5,
  /** Blob radius range, as a fraction of the smaller frame dimension. */
  radiusMin: 0.13,
  radiusMax: 0.46,
  /** Blobs are stretched into ellipses; 1 = circular. */
  eccentricity: 0.55,
  /** Blobs sit in a shell around the core, not piled on top of it. */
  innerHole: 0.24,
  /** Cluster reach. Blobs thin outward from the discharge centre. */
  spread: 0.45,
  /** >1 pulls blobs towards the centre. */
  clusterBias: 1.15,
  /** Fraction of blobs that are brighter knots. */
  knotFraction: 0.3,
  baseAlpha: 0.44,
  /** How far the cloud expands over the life of the burst. */
  ignitionExpansion: 0.5,
  driftExpansion: 0.3,
  /** Slow rotation of the whole cluster, in radians over the full duration. */
  swirl: 0.42,
} as const;

export const CORE_FLASH = {
  /** Overlapping white blobs that make the blown-out centre irregular. */
  blobCount: 14,
  blobRadiusMin: 0.05,
  blobRadiusMax: 0.15,
  /** The soft halo the blobs sit in. */
  haloRadius: 0.27,
  haloAlpha: 0.26,
  /** Frame at which the flash peaks, and its exponential decay constant. */
  peakFrame: 12,
  riseExponent: 3,
  decayFrames: 11,
} as const;

export const SPARKS = {
  count: 120,
  /** Sparks are thrown over this many frames from the ignition frame. */
  birthSpread: 3,
  /** Initial speed, in 4K pixels per frame. */
  speedMin: 45,
  speedMax: 170,
  /** Exponential deceleration constant. Higher = stops sooner. */
  dragMin: 0.038,
  dragMax: 0.1,
  /** They persist into the decay phase, drifting and dimming. */
  lifeMin: 34,
  lifeMax: 82,
  /** Slow drift once the initial throw has decayed away. */
  driftSpeed: 0.55,
  /** Trailing streak length, in frames of travel. Short — these are sparks,
   * not flare rays. */
  trailFrames: 0.7,
  /** Peak angular drift, radians per frame, so paths bend instead of radiating
   * as perfectly straight spokes. */
  curl: 0.03,
  widthMin: 2.2,
  widthMax: 4.6,
  /** Fraction of sparks rendered at full core white rather than pale. */
  whiteFraction: 0.3,
} as const;

export const BLOOM = {
  /** Overall bloom strength; scaled by the intensity curve at draw time. */
  strength: 1,
  /** Bloom is computed at 1/4 resolution — it is low-frequency by nature. */
  resolutionDivisor: 4,
  /** Two radii, in 4K pixels: a tight halo and a wide wash. */
  tightRadius: 44,
  wideRadius: 190,
  tightAlpha: 0.44,
  wideAlpha: 0.4,
  /** Softens the bright-pass so the cloud blooms too, not only the cores. */
  linearMix: 0.3,
} as const;

export const GRAIN = {
  alpha: 0.04,
  /** Tiled across the frame so the grain stays fine at 4K. */
  tileSize: 256,
  /** Distinct tiles, cycled by frame number, so the grain crawls. */
  tileCount: 6,
} as const;
