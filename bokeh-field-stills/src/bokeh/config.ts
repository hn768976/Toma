/**
 * Every tunable number in the piece. Nothing that could reasonably vary is
 * written inline anywhere else — if you want to redesign the look, this is
 * the only file you need.
 *
 * All lengths are in pixels at the 3840x2160 reference frame and are scaled
 * by `width / REFERENCE_WIDTH` at draw time, so the same config holds if the
 * composition is ever registered at a different resolution.
 */

export const REFERENCE_WIDTH = 3840;
export const REFERENCE_HEIGHT = 2160;

export const CONFIG = {
  /** How far past the frame edge elements may be generated. Fraction of width. */
  overscan: 0.055,
  /**
   * Padding added around every offscreen band buffer, in reference px. A blur
   * reads transparent black from outside the buffer, so without this the
   * heavily blurred bands would fade out along the frame edges.
   */
  bufferPadding: 240,

  density: {
    sparse: { elements: 340, clusters: [6, 8], opacityScale: 1 },
    medium: { elements: 700, clusters: [10, 12], opacityScale: 1 },
    // At ~1400 elements the additive compositing pools into white without
    // pulling each individual mark back.
    dense: { elements: 1400, clusters: [12, 16], opacityScale: 0.75 },
  },

  cluster: {
    /** Fraction of elements that belong to a cluster; the rest scatter freely. */
    memberFraction: 0.75,
    /** Cluster radius as a fraction of frame width. */
    radius: { min: 0.07, max: 0.22 },
    /** Bias toward the small end so most clusters read as tight knots. */
    radiusBias: 1.4,
    /** Relative share of elements a cluster attracts. */
    weight: { min: 0.5, max: 1.4 },
    /** Higher = elements crowd harder toward the cluster centre. */
    falloff: { min: 0.75, max: 1.6 },
    /** Depth spread of a cluster's members around its own base depth. */
    depthSpread: { min: 0.08, max: 0.22 },
    /**
     * Chance a cluster's base depth is pulled to the focus band. Without this
     * a focusBand near an extreme leaves almost nothing sharp in frame.
     */
    focusAffinity: 0.45,
    focusAffinityJitter: 0.12,
    /**
     * Cluster centres are placed one per cell of a shuffled coarse grid
     * rather than uniformly at random. Pure uniform placement leaves a dead
     * third of the frame often enough to spoil a batch. 0 = pure random,
     * 1 = dead centre of the assigned cell.
     */
    stratification: 0.55,

  },

  /**
   * Additive compositing means a tight, heavily weighted cluster pools
   * straight past white and clips into a flat blob. Ink is binned into a
   * coarse map and elements standing in an over-inked cell are dimmed, so
   * hot regions survive but blown-out ones do not.
   */
  crowding: {
    /** Bin size in reference px. */
    cell: 200,
    /** Alpha-weighted coverage a cell may reach before its marks are dimmed. */
    ceiling: 0.5,
    /** The most a mark may be dimmed. */
    floor: 0.35,
  },

  /** The loose invisible grid that makes a cluster read as circuitry. */
  grid: {
    pitch: { min: 40, max: 150 },
    /** 0 = ignore the grid entirely, 1 = snap hard to it. */
    strength: { min: 0.5, max: 0.85 },
    /** Residual jitter, as a fraction of the cluster's pitch. */
    jitter: { min: 0.1, max: 0.3 },
  },

  shapes: {
    weights: {
      shortDash: 0.3,
      tallBar: 0.2,
      squareBlock: 0.15,
      dashStack: 0.15,
      dashRow: 0.1,
      fineLine: 0.1,
    },
    shortDash: { length: [34, 78], aspect: [2, 6] },
    tallBar: { height: [38, 104], aspect: [3, 8] },
    squareBlock: { side: [14, 34] },
    dashStack: { count: [3, 6], length: [28, 58], aspect: [2.5, 6], gap: [0.8, 2.2] },
    dashRow: { count: [3, 6], length: [24, 52], aspect: [2, 5], gap: [0.5, 1.6] },
    fineLine: { length: [120, 330], thickness: [2.4, 5] },
    /** Per-element size wobble applied on top of the ranges above. */
    sizeJitter: [0.85, 1.15],
  },

  depth: {
    /** Near elements are 5x the size of far ones. */
    scale: { far: 0.5, near: 2.5 },
    /** Peak blur radius, reached at whichever depth extreme is further away. */
    blurMax: 60,
    opacity: { far: 0.32, near: 1 },
    /**
     * Defocus spreads a mark's light over a much larger area, so without a
     * compensating lift the blurred bands wash out to nothing. This is the
     * peak multiplier, reached at maximum blur.
     */
    blurCompensation: 2.7,
    /** Very near elements are so defocused they go slightly transparent. */
    nearFade: { start: 0.75, amount: 0.38 },
    /** Jitter on the depth->tone mapping so a band isn't monochrome. */
    toneJitter: 0.14,
    /**
     * How far a heavily defocused mark is pulled back down the tone ramp.
     * Near marks still shift toward the brightest tone, but a defocused
     * highlight keeps its colour instead of spreading into grey — only a
     * sharp one clips toward white.
     */
    defocusTonePull: 0.42,
    /**
     * Five buckets over normalised blur (distance-from-focus, squared). Each
     * bucket is rendered to one offscreen buffer and blurred once; per-element
     * blurring is unusably slow at 4K. Boundaries are tighter near zero so the
     * sharp band stays genuinely sharp.
     */
    bandEdges: [0, 0.015, 0.07, 0.2, 0.48, 1.0001],
  },

  bokeh: {
    /** Below this blur (px) a mark is drawn flat — the rim would be invisible. */
    rimOnsetBlur: 6,
    /** Gradient stop positions and their multiplier on the element's alpha at
     *  full rim strength. The rim sits at 0.8 of the mark's extent. */
    centreDim: 0.45,
    midDim: 0.24,
    rimStop: 0.8,
    edgeDim: 0.6,
  },

  background: {
    /** Computed at 1/8 resolution, then upscaled with smoothing. */
    downscale: 8,
    blobs: { count: [5, 8], radius: [0.18, 0.55], lift: [0.035, 0.1] },
    /** Blur applied at the reduced resolution, so 8x this in frame terms. */
    blur: 7,
    /** Strength of the soft one-corner directional lift. */
    cornerLift: 0.055,
  },

  bloom: {
    /** Only marks at or below this blur (px) and above this alpha bloom. */
    blurCutoff: 4,
    minOpacity: 0.55,
    /** Two radii: a tight core glow and a wide generous halo. */
    passes: [
      { blur: 22, alpha: 0.32 },
      { blur: 70, alpha: 0.18 },
    ],
  },

  finish: {
    /** Alpha of pure black at the far corner. */
    vignette: 0.22,
    /** Radius (as a fraction of the half-diagonal) where the vignette starts. */
    vignetteStart: 0.42,
    grain: { alpha: 0.03, tile: 1024, spread: 26 },
  },
} as const;

export type DensityName = keyof typeof CONFIG.density;

export const DENSITY_NAMES = Object.keys(CONFIG.density) as DensityName[];
