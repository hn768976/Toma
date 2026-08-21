/**
 * Every tunable for the Data Tunnel effect.
 *
 * World space
 * -----------
 *   x = lateral, y = up, z = depth.
 *   The camera sits on the corridor axis looking toward -z and flies forward,
 *   so "ahead" is a more negative z.
 *
 * Two dot-grid planes run the length of the corridor, one below the axis and
 * one above. Both bow away from the axis toward the sides, which is what gives
 * the far edge of each plane its arc and keeps a dark band open across the
 * middle of the frame.
 *
 * Loop safety
 * -----------
 * The camera advances exactly `motion.cellsPerLoop` grid cells over the loop,
 * so the grid lands back on itself. Anything indexed per dot is therefore
 * hashed on `row mod cellsPerLoop`, not on the raw row, or the dots would
 * carry different random values after the wrap. Drifting elements (dust,
 * nebula) wrap over the same distance.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10s

export const config = {
  /** ---------------- Corridor ---------------- */
  tunnel: {
    /** Distance from the corridor axis to each plane at the centre line. */
    halfHeight: 2.6,
    /** Columns of dots either side of centre. Total is 2n + 1. */
    columns: 90,
    /** Grid spacing, world units. */
    spacingX: 0.165,
    spacingZ: 0.38,
    /**
     * How far the planes bow away from the axis at the sides. This is what
     * arcs the far edge of each plane; at 0 the corridor is two flat slabs and
     * the boundary is a flat horizontal line.
     */
    curve: 0.8,
    /** Depth window that gets drawn, world units from the camera. */
    near: 0.55,
    far: 27,
    /** Dots fade in over this depth as they rush past the camera. */
    nearFade: { start: 0.8, end: 4.5 },
    /** ...and fade out into the distance over this one. */
    farFade: { start: 7.5, end: 23 },
  },

  /** ---------------- Dots ---------------- */
  dot: {
    /** Size in world units; screen size is focal * size / depth. */
    width: 0.104,
    height: 0.062,
    /** Clamp in screen pixels. */
    minPx: 0.55,
    maxPx: 9,
    /** Per-dot brightness spread. */
    intensity: { min: 0.68, max: 1 },
    /**
     * A brightness wave travelling down the corridor. Whole cycles per loop
     * only, and the row period must divide `motion.cellsPerLoop`.
     */
    wave: { rowPeriod: 24, cyclesPerLoop: 2, depth: 0.5 },
    /** Fraction of grid positions that are simply missing, for texture. */
    dropout: 0.08,
  },

  /** ---------------- Camera ---------------- */
  camera: {
    fovXDeg: 78,
    /** Height above the corridor axis. Slightly below centre looks better. */
    axisOffsetY: -0.12,
    /** Slow drift, world units / degrees. All whole cycles per loop. */
    driftX: 0.22,
    driftY: 0.12,
    rollDeg: 1.1,
    driftXPhase: 0.0,
    driftYPhase: 0.37,
    rollPhase: 0.2,
  },

  /** ---------------- Motion ---------------- */
  motion: {
    /**
     * Grid cells the camera advances over one loop. This is THE loop
     * invariant: the grid repeats every `spacingZ`, so an integer number of
     * cells puts the corridor back exactly where it started.
     */
    cellsPerLoop: 96,
  },

  /** ---------------- Palette ---------------- */
  palette: {
    /** Deep navy void. */
    background: "#03081c",
    /** Slightly lifted blue at the frame edges. */
    backgroundEdge: "#07123a",
    /** Dots near the camera — deeper blue. */
    dotNear: "#1B5CFF",
    /** Dots at mid distance — the dominant cyan. */
    dotMid: "#2F9FFF",
    /** Dots far away, near white-cyan. */
    dotFar: "#7BCEFF",
    /** Nebula clouds. */
    nebulaA: "#1A4FC8",
    nebulaB: "#1C5FD0",
    /** Floating dust. */
    dust: "#74C2FF",
    /**
     * Scattered light in the medium. Deliberately much bluer than the dots:
     * this is light that has travelled through the volume, not the sources.
     */
    fog: "#1C40E0",
  },

  /** ---------------- Nebula ---------------- */
  nebula: {
    count: 26,
    /** Blob radius in world units. */
    radius: { min: 1.6, max: 5.5 },
    alpha: 0.24,
    /** Blur applied to the whole nebula layer, px. */
    blurPx: 46,
    /** Blobs are biased toward the corridor axis so the haze sits mid-frame. */
    spreadX: 3.4,
    spreadY: 2.0,
  },

  /** ---------------- Dust ---------------- */
  dust: {
    count: 130,
    size: { min: 0.012, max: 0.05 },
    minPx: 0.8,
    maxPx: 10,
    alpha: 0.5,
    spreadX: 4.2,
    spreadY: 2.8,
    /** Dust closer than this gets a depth-of-field blur. */
    blurNearerThan: 6,
    maxBlurPx: 7,
  },

  /**
   * ---------------- Atmospheric fog ----------------
   * The corridor is a lit volume, not a black void: light scatters in the
   * medium, so the space around the grids never reaches black and the gaps
   * between dots glow. This is the single biggest thing separating a flat
   * dot grid from something that reads as atmosphere.
   *
   * Unlike bloom, this blurs the RAW dot buffer — every dot contributes, not
   * just the bright ones — so the fog tracks where the grid actually is,
   * bright at the planes and thinning across the dark middle band.
   */
  fog: {
    enabled: true,
    levels: [
      { blurPx: 45, alpha: 0.62 },
      { blurPx: 170, alpha: 0.5 },
    ],
    strength: 1,
  },

  /** ---------------- Glow / bloom ---------------- */
  bloom: {
    enabled: true,
    /**
     * Threshold-extracted the same way as the streaks piece: the dot buffer is
     * multiplied by itself, which squares colour and alpha and crushes the dim
     * dots, so only genuinely bright ones bleed.
     */
    levels: [
      { blurPx: 5, alpha: 0.55 },
      { blurPx: 18, alpha: 0.4 },
      { blurPx: 52, alpha: 0.18 },
      { blurPx: 120, alpha: 0.08 },
    ],
    strength: 1,
  },

  /** ---------------- Post ---------------- */
  post: {
    vignetteStrength: 0.66,
    vignetteInner: 0.3,
    /** Extra darkening of the far centre, so the vanishing point stays deep. */
    coreShadow: { strength: 0.5, radius: 0.5 },
  },

  seed: 0xd0774e,
} as const;

export type TunnelConfig = typeof config;
