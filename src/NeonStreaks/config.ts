/**
 * Every tunable for the Neon Streaks effect lives here.
 *
 * World space convention
 * ---------------------
 *   x = lateral (right positive)
 *   y = up, the floor is the plane y = 0
 *   z = depth, the camera sits near z = 0 and looks toward -z,
 *       so "far away" is a large negative z.
 *
 * A streak is one continuous path with three parts:
 *   A. a run along the floor, coming toward the camera
 *   B. a quarter-circle bend of radius `bendRadius`
 *   C. a straight climb up an invisible wall at z = wallZ
 *
 * Loop safety
 * -----------
 * Everything periodic is expressed as a whole number of cycles per
 * DURATION_IN_FRAMES, so frame 450 is identical to frame 0 by construction.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15s

export const config = {
  /** ---------------- Streaks ---------------- */
  streaks: {
    /** How many streak paths exist in total (the density envelope gates them). */
    count: 54,
    /**
     * Traversals of the full path per 450-frame loop. Must be whole numbers so
     * the loop closes. Lower = slower, statelier. Picked per streak from this
     * list, biased so far-away streaks get the slower values.
     */
    cyclesPerLoop: [3, 4, 4, 5, 6, 8],
    /** Trail length along the path, in world units. */
    trailLength: { min: 5, max: 21 },
    /** Core thickness in world units; screen width is this / depth * focal. */
    coreWidth: { min: 0.008, max: 0.03 },
    /** Clamp for the white-hot core in screen pixels. */
    coreWidthPx: { min: 0.5, max: 4 },
    /**
     * The climb dims as it rises, as a fraction of the path's top. Keeps the
     * upper half of the frame close to black for a title while the streaks
     * still visibly leave through the top edge.
     */
    climbFade: { startFrac: 0.14, endFrac: 0.82, minAlpha: 0.09 },
    /**
     * How much DEPTH the floor run covers before the bend, in world units.
     * Kept in the same ballpark as `depthFade` so a streak is born already
     * invisible and swims up out of the dark rather than popping in.
     *
     * Keep this in proportion to the bend + climb (~8 units): make the run too
     * long and every streak spends its whole cycle crawling along the floor,
     * and the 90 degree turn — the whole point of the piece — almost never
     * happens on screen.
     */
    runDepth: { min: 16, max: 52 },
    /** Streaks fade out with distance, between these depths. */
    depthFade: { start: 28, end: 66 },
    /**
     * Extra fade over the first stretch of the path, as a multiple of the
     * streak's own trail length. Belt and braces with `depthFade`.
     */
    birthFade: 1.2,
    /**
     * Lateral band the bends land in, as |x| normalised to the frame half-width.
     * The `inner` gap matters for more than composition: a streak running
     * straight at the camera near the frame centre projects its floor run to a
     * near-vertical line, so its 90 degree corner collapses into a hairpin.
     * Keeping the bends off-centre is what makes the turn read — and it leaves
     * the middle of the frame clear for a title.
     */
    lateralBand: { inner: 0.26, outer: 1.0 },
    /**
     * How far the floor run is yawed away from head-on, in degrees. Sweeping
     * outward flattens the run in screen space, which further separates the
     * "along the floor" leg from the "up the wall" leg.
     */
    yawDeg: { min: 8, max: 30 },
    /** Per-streak brightness variation. */
    intensity: { min: 0.45, max: 1 },
    /**
     * Polyline sampling: segments per trail for the core / for the halo passes.
     * Segments are grouped into `bands`, and each band is stroked as ONE
     * continuous path at a constant alpha. Stroking every segment separately
     * makes the round caps overlap under additive blending, which beads the
     * trail into a dotted line.
     */
    coreSegments: 48,
    coreBands: 12,
    haloSegments: 24,
    haloBands: 6,
    /** Tail falloff exponent. Higher = the trail fades out faster behind the head. */
    tailFalloff: 1.7,
  },

  /** ---------------- The bend ---------------- */
  bend: {
    /**
     * Depth (distance in front of the camera) at which a streak turns upward.
     * Varying this per streak is what gives the piece its depth: with a single
     * shared value every climb starts at the same screen height and the floor
     * runs collapse into one flat bundle.
     */
    depth: { near: 5.6, far: 15 },
    /** Quarter-circle radius, world units. Small = crisp 90 degree corner. */
    radius: { min: 0.85, max: 1.7 },
    /** Fraction of the frame height the path must overshoot the top edge by. */
    topOvershoot: 0.22,
  },

  /** ---------------- Camera ---------------- */
  camera: {
    /** Horizontal field of view in degrees. Focal length derives from frame width. */
    fovXDeg: 74,
    /** Eye height above the floor, world units. */
    eyeHeight: 1.3,
    /** Where the horizon (vanishing point) sits, as a fraction of frame height. */
    horizonY: 0.66,
    /** Slow lateral truck, world units. 1 cycle per loop. */
    truckAmp: 0.85,
    /** Tiny height bob, world units. 2 cycles per loop. */
    heightAmp: 0.1,
    /** Roll in degrees. 1 cycle per loop. */
    rollAmpDeg: 0.9,
    /** Phase offsets in turns (0..1) so the axes do not move in lockstep. */
    truckPhase: 0.0,
    heightPhase: 0.31,
    rollPhase: 0.18,
  },

  /** ---------------- Depth of field ---------------- */
  dof: {
    /** Depth that is perfectly sharp, world units from camera. */
    focusDistance: 11,
    /** Blur in px at the near and far extremes. */
    maxBlurPx: 5.5,
    /** Depth range over which blur ramps to max. */
    range: 30,
    /** Blur is quantised into this many buckets so each bucket is one composite. */
    buckets: 4,
  },

  /** ---------------- Palette ---------------- */
  palette: {
    background: "#000308",
    /** White-hot centre of a streak. */
    core: "#EAF4FF",
    /** Inner halo. */
    halo: "#7FC4FF",
    /** Outer halo, the deep electric blue. */
    glow: "#2E6BFF",
    /** Tint of the bloom pyramid. */
    bloom: "#4E8CFF",
    /** Atmospheric haze sitting on the floor line. */
    haze: "#123A7A",
    /** Elliptical pool of light where a streak meets the floor. */
    pool: "#3F86FF",
  },

  /** ---------------- Glow / bloom ---------------- */
  glow: {
    /** Halo pass widths as multiples of the core width. */
    haloWidthMul: 3.4,
    glowWidthMul: 9,
    /** Alpha of each pass. */
    coreAlpha: 1,
    haloAlpha: 0.34,
    glowAlpha: 0.13,
  },
  bloom: {
    /**
     * Bloom is threshold-extracted (the streak buffer multiplied by itself)
     * so only genuinely bright pixels bleed. That is what keeps the frame from
     * washing out to grey.
     */
    enabled: true,
    /** Blur radius in px and additive strength for each pyramid level. */
    levels: [
      { blurPx: 6, alpha: 0.55 },
      { blurPx: 20, alpha: 0.38 },
      { blurPx: 56, alpha: 0.26 },
      { blurPx: 130, alpha: 0.15 },
    ],
    /** Global multiplier on every bloom level. */
    strength: 1,
  },

  /** ---------------- Floor ---------------- */
  floor: {
    /** Opacity of the mirrored geometry. */
    reflectionOpacity: 0.25,
    /** Extra blur on the reflection, px. Glossy, not a mirror. */
    reflectionBlurPx: 5,
    /** The reflection fades to nothing this far below the horizon (0..1 of height). */
    reflectionFade: 0.46,
    /** Pool of light where the streak meets the floor. */
    pool: {
      enabled: true,
      /** Radius in world units. */
      radius: 1.25,
      alpha: 0.38,
    },
    /** Faint haze band on the horizon. */
    haze: {
      alpha: 0.28,
      /** Band height as a fraction of frame height. */
      spread: 0.16,
    },
  },

  /** ---------------- Density envelope ---------------- */
  /**
   * Fraction of `streaks.count` that is visible, over the loop.
   * value(f) = min + (max - min) * (0.5 - 0.5 * cos(2*pi*f/450))
   * -> min at frame 0 and frame 450, max at frame 225. Periodic by construction.
   */
  density: {
    min: 0.34,
    max: 1.0,
    /** Streaks fade in over this many index-units at the threshold, to avoid popping. */
    featherIndices: 6,
  },

  /** ---------------- Post ---------------- */
  post: {
    /** Radial darkening at the frame edges. */
    vignetteStrength: 0.72,
    /** 0 = vignette starts at centre, 1 = only the very corners. */
    vignetteInner: 0.35,
    /** Overall exposure on the streak buffer. */
    exposure: 1,
  },

  /** Seed for the module-scope PRNG. Change it for a whole new arrangement. */
  seed: 0x5eed1e,
} as const;

export type NeonConfig = typeof config;
