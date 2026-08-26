/**
 * Top-level tuning for the whole piece. The camera path, pin field, contour
 * density, noise character, DOF and bloom all live here so a v2 with a
 * different path/look is a data change, not a rewrite.
 *
 * Units: world units. The terrain undulates roughly ±2.3 units; pins are
 * ~2 units tall; the camera flies ~4.6–6.8 units up.
 */
export const CONFIG = {
  camera: {
    fov: 38,
    near: 0.1,
    far: 400,
    /** Camera height above y=0 at frame 0. Terrain peaks at ~+2.3, so this
     * keeps the lens ~2.3 units clear of the highest hill. */
    baseY: 4.6,
    /** Extra height gained across the full duration (the slow rise). */
    rise: 2.2,
    /** Dolly start / total forward travel along +Z over the duration. */
    startZ: -6,
    travel: 118,
    /** Handheld drift: ±amp on a sine, `cycles` full periods per duration. */
    driftAmpX: 2,
    driftCycles: 1.6,
    /** Matching sub-degree yaw sway, degrees. */
    yawDeg: 0.75,
    /** Constant downward pitch, degrees — puts the horizon in the upper third. */
    pitchDownDeg: 6.6,
  },

  terrain: {
    /** Grid cell size for the height field / marching squares, world units.
     * Smaller = smoother curves (cost grows quadratically). */
    cell: 0.8,
    /** Sampled window: x ∈ [-xHalf, xHalf], z ∈ [camZ - back, camZ + depth]. */
    xHalf: 100,
    back: 9,
    depth: 228,
    /** Base spatial frequency of the noise (1/world-units). Higher = tighter,
     * curvier maze-like ropes. */
    noiseScale: 0.026,
    octaves: 3,
    /** Peak-to-mid height of the terrain. Kept low: gentle relief spaces the
     * ropes evenly and stops them stacking/overlapping on screen when seen
     * from the low camera. */
    amp: 1.35,
    /** How fast the noise field breathes, in noise-t per second.
     * 0 = frozen: the rope lines do not move — only the dots travel on them. */
    breatheSpeed: 0,
  },

  contours: {
    /** Number of iso-height levels. */
    levels: 18,
    /** Line width in WORLD units (LineMaterial worldUnits) — near lines render
     * thick, far ones thin, for free. */
    lineWidth: 0.012,
    /** HDR multiplier on the nearest lines so they read as neon under bloom. */
    nearGlow: 1.7,
    /** Distance band over which lines fade into the horizon haze. */
    fadeStart: 55,
    fadeEnd: 140,
    /** Distance band over which line colour ramps bright → base. */
    nearBrightDist: 16,
    farDimDist: 110,
  },

  pins: {
    count: 140,
    /** Pin field: x ∈ ±xHalf (centre-biased), z ∈ [zMin, zMax]. */
    xHalf: 48,
    zMin: -14,
    zMax: 330,
    /** Pins sit on a jittered grid — evenly spaced across the field, with
     * this fraction of a grid cell of seeded jitter so it stays organic. */
    gridJitter: 0.55,
    stemHeight: 2.0,
    stemRadius: 0.026,
    ringRadius: 0.55,
    ringTube: 0.07,
    discRadius: 0.44,
    /** Per-pin uniform scale jitter: 1 ± jitter. */
    scaleJitter: 0.18,
    /** Rise stagger window — every pin's spring has started by this frame. */
    riseWindow: 160,
    /** Ring glow pulse: ±12% on seeded sines. */
    pulseAmount: 0.12,
    /** Occasional per-pin flash: duration in frames, mean period in frames. */
    flashFrames: 4,
    flashMeanPeriod: 1300,
    flashBoost: 2.4,
    avatarVariants: 7,
    /** Fraction of avatars using the cool fill. */
    coolFraction: 0.28,
    /** The bright dot cycling up each stem. */
    stemDotSize: 0.05,
    stemDotCycleSeconds: 1.6,
    stemDotBrightness: 1.8,
  },

  /** Dots traveling along the contour ropes. */
  dots: {
    count: 130,
    /** Travel speed along the iso-line, world units per second. */
    speed: 3.4,
    size: 0.055,
    /** HDR brightness multiplier (pushes them over the bloom threshold). */
    brightness: 2.2,
    /** Seed field for dot starting points. */
    xHalf: 85,
    zMin: -20,
    zMax: 335,
  },

  dof: {
    /** Focus plane distance from the camera, world units (near-middle distance). */
    focusWorld: 40,
    /** postprocessing focalLength, normalized [0..1]. Bigger = shallower. */
    focalLength: 0.07,
    /** Bokeh disc size — generous on purpose; the near-pin bokeh is the shot. */
    bokehScale: 13,
    /** Internal DOF buffer height; keeps bokeh consistent across output sizes. */
    height: 720,
  },

  bloom: {
    intensity: 1.5,
    /** High enough that the dark background and floor don't bloom. */
    luminanceThreshold: 0.22,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
    /** Halo spread of the mipmap bloom — the neon glow radius. */
    radius: 0.75,
  },

  vignette: {
    offset: 0.28,
    darkness: 0.52,
  },

  /** Final 2D grain layer opacity. */
  grainAlpha: 0.04,
} as const;
