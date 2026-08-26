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
    /** Grid cell size for the height field / marching squares, world units. */
    cell: 1.5,
    /** Sampled window: x ∈ [-xHalf, xHalf], z ∈ [camZ - back, camZ + depth]. */
    xHalf: 100,
    back: 9,
    depth: 228,
    /** Base spatial frequency of the noise (1/world-units). Lower = broader hills. */
    noiseScale: 0.018,
    octaves: 3,
    /** Peak-to-mid height of the terrain. */
    amp: 2.3,
    /** How fast the noise field breathes, in noise-t per second. Subtle. */
    breatheSpeed: 0.045,
  },

  contours: {
    /** Number of iso-height levels. */
    levels: 14,
    /** Line width in WORLD units (LineMaterial worldUnits) — near lines render
     * thick, far ones thin, for free. */
    lineWidth: 0.048,
    /** Distance band over which lines fade into the horizon haze. */
    fadeStart: 75,
    fadeEnd: 175,
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
    /** Exponent biasing pin x toward the camera corridor (1 = uniform). */
    centerBias: 1.35,
    stemHeight: 2.0,
    stemRadius: 0.032,
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
    intensity: 1.15,
    /** High enough that the plum background and dim far lines don't bloom. */
    luminanceThreshold: 0.24,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  },

  vignette: {
    offset: 0.28,
    darkness: 0.52,
  },

  /** Final 2D grain layer opacity. */
  grainAlpha: 0.04,
} as const;
