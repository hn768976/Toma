/**
 * Top-level configuration. Everything that governs how much of a thing there
 * is, how big it is, or when it happens is declared here.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 480; // 16.0s, one-shot — not a loop.

/** Cloud geometry, in composition (4K) pixels. */
export const CLOUD = {
  centerX: WIDTH / 2,
  /**
   * Flat bottom edge of the silhouette. Chosen so the cloud's optical centre
   * lands slightly above the frame's centre, which leaves the ring room to
   * clear the top edge.
   */
  baselineY: 1343,
  /**
   * The three overlapping lobes. Radii differ and — importantly — so do the
   * centre heights: three circles on a shared centreline read as a caterpillar
   * rather than a cloud. Offsets are relative to (centerX, baselineY).
   */
  lobes: [
    { dx: -320, dy: -140, r: 168 }, // left — smallest, sits lowest
    { dx: -10, dy: -296, r: 274 }, // centre — largest and highest
    { dx: 286, dy: -198, r: 214 }, // right — medium, between the two
  ],
  /** Height of the slab that joins the lobes into a flat-bottomed mass. */
  skirtHeight: 180,
  /** Horizontal inset of that slab, so the shoulders stay rounded. */
  skirtInset: 38,
} as const;

/** Widest horizontal extent of the silhouette, used to size the ring. */
export const CLOUD_WIDTH =
  Math.max(...CLOUD.lobes.map((l) => l.dx + l.r)) -
  Math.min(...CLOUD.lobes.map((l) => l.dx - l.r));

/** Vertical centre of the silhouette — the optical centre of the composition. */
export const CLOUD_CENTER_Y =
  CLOUD.baselineY -
  (CLOUD.baselineY -
    Math.min(...CLOUD.lobes.map((l) => CLOUD.baselineY + l.dy - l.r))) /
    2;

export const PARTICLES = {
  /** Total particles, including the free-drifting outliers. */
  count: 2200,
  /** Fraction placed just outside the silhouette, drifting free. */
  outsideFraction: 0.04,
  minRadius: 1.5, // drawn diameter 3px
  maxRadius: 4.0, // drawn diameter 8px
  /**
   * Edge weighting. Acceptance probability falls from 1 at the silhouette
   * boundary to `interiorFloor` deep inside, over `edgeFalloff` pixels.
   * This concentration along the edge is what makes the shape legible.
   */
  edgeFalloff: 62,
  interiorFloor: 0.028,
  /** Resolution of the distance field used for edge weighting. */
  maskDownscale: 4,
};

export const RING = {
  segmentCount: 14,
  /** Ring diameter as a multiple of the cloud's width. */
  diameterFactor: 1.9,
  lineWidth: 15,
  /** Indices of the two long segments — opposite each other on the circle. */
  longSegments: [0, 7],
  /** How much longer a promoted segment is than an ordinary one. */
  longFactor: 3.4,
  /** Ordinary segment length variation, as a multiple of the mean. */
  lengthJitter: 0.45,
  /** One full turn across the composition. */
  rotationTurns: 1,
  /** Travelling brightness wave period, a divisor of DURATION_IN_FRAMES. */
  pulsePeriod: 120,
  /** Angular width of the pulse, in segment indices. */
  pulseWidth: 2.4,
};

export const CIRCUIT = {
  /** Number of independent traces across the frame. */
  traceCount: 120,
  /** Coarse grid the right angles snap to. */
  gridSize: 96,
  /** Segments per trace (inclusive range). */
  minTurns: 3,
  maxTurns: 9,
  lineWidth: 3,
  padSize: 15,
  /** Overall opacity of the trace field — kept low by design. */
  fieldOpacity: 0.6,
  /** Probability a vertex carries a pad. */
  padChance: 0.26,
  /** Probability a trace ends in a short perpendicular stub. */
  stubChance: 0.55,
  padBlinkPeriodMin: 90,
  padBlinkPeriodMax: 240,
};

export const STARS = {
  count: 520,
  minRadius: 1.2,
  maxRadius: 3.4,
  twinklePeriodMin: 110,
  twinklePeriodMax: 290,
};

/** Act boundaries, in frames. */
export const TIMING = {
  backdropFadeStart: 0,
  backdropFadeEnd: 40,
  ringStart: 40,
  /** Frames between consecutive segments lighting up. */
  ringStagger: 3,
  ringSegmentFade: 8,
  ringEnd: 90,
  assembleStart: 90,
  assembleEnd: 190,
  /** How long one particle takes to fly in. */
  particleFlightFrames: 42,
  /** Spread of per-particle launch delays across the assemble window. */
  particleDelaySpread: 58,
  idleStart: 190,
  /** Breathing: +/-1% scale on a 120-frame sine. */
  breathePeriod: 120,
  breatheAmount: 0.01,
  twinklePeriodMin: 70,
  twinklePeriodMax: 210,
  /** Free-drift excursion cycle for the handful of wandering particles. */
  driftPeriod: 200,
};

export const FINISH = {
  vignetteStrength: 0.22,
  grainAlpha: 0.04,
  grainTileSize: 1024,
  grainTileCount: 6,
};
