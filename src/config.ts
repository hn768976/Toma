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
    /** Not too tiny: near clip governs depth precision at distance — 0.1
     * makes the far lines z-fight the floor into dashes. */
    near: 0.5,
    far: 400,
    /** Camera height above y=0 at frame 0. Terrain peaks at ~+2.3, so this
     * keeps the lens ~2.3 units clear of the highest hill. */
    baseY: 4.0,
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
    depth: 170,
    /** Base spatial frequency of the noise (1/world-units). Higher = tighter,
     * curvier maze-like ropes — the reference's dense meander. */
    noiseScale: 0.032,
    /** X-frequency multiplier. 1 = isotropic: contours wander equally in both
     * axes, which is what gives the reference its maze of curves and loops. */
    anisoX: 1,
    octaves: 3,
    /** Peak-to-mid height of the terrain: real rolling relief, like the
     * reference's rippled sheet. */
    amp: 1.1,
    /** How fast the noise field breathes, in noise-t per second.
     * 0 = frozen: the rope lines do not move — only the dots travel on them. */
    breatheSpeed: 0,
  },

  contours: {
    /** Number of iso-height levels — sets rope density across the field. */
    levels: 22,
    /** Laplacian smoothing passes on the chained polylines — rounds off the
     * little marching-squares corners so the ropes are pure curves. */
    smoothingPasses: 3,
    /** Line width in WORLD units (LineMaterial worldUnits) — near lines render
     * thick, far ones thin, for free. */
    /** Rope width in PIXELS at 4K output (scaled to the actual render size).
     * Screen-space width keeps far ropes from going sub-pixel, which is what
     * chops world-unit thin lines into dashes. */
    lineWidthPx: 2.6,
    /** HDR multiplier on the nearest lines so they read as neon under bloom. */
    nearGlow: 1.35,
    /** Closed contours (the loops around hilltops and hollows) are part of
     * the look — the reference is full of them. */
    openRopesOnly: false,
    /** Darkest shade in the per-level brightness cycle. */
    shadeMin: 0.38,
    /** Discard stubs shorter than this many points after chaining. */
    minPoints: 5,
    /** Distance band over which lines fade into the horizon haze. Pulled in
     * so far ropes dim before they pack into a solid band at the horizon. */
    fadeStart: 42,
    fadeEnd: 105,
    /** Distance band over which line colour ramps bright → base. */
    nearBrightDist: 22,
    farDimDist: 75,
  },

  pins: {
    count: 200,
    /** Pin field: x ∈ ±xHalf, z ∈ [zMin, zMax]. zMax covers the dolly's end
     * position plus the fade distance — pins past that are never seen. */
    xHalf: 48,
    zMin: -14,
    zMax: 230,
    /** Pins sit on a jittered grid — evenly spaced across the field, with
     * this fraction of a grid cell of seeded jitter so it stays organic. */
    gridJitter: 0.55,
    stemHeight: 2.0,
    stemRadius: 0.026,
    ringRadius: 0.45,
    ringTube: 0.058,
    discRadius: 0.36,
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
    focusWorld: 32,
    /** postprocessing focalLength, normalized [0..1]. Bigger = shallower. */
    focalLength: 0.085,
    /** Bokeh disc size — generous on purpose; the near-pin bokeh is the shot. */
    bokehScale: 13,
    /** Internal DOF buffer height; keeps bokeh consistent across output sizes. */
    height: 720,
  },

  bloom: {
    intensity: 1.05,
    /** High enough that the dark background and floor don't bloom. */
    luminanceThreshold: 0.3,
    luminanceSmoothing: 0.25,
    mipmapBlur: true,
    /** Halo spread of the mipmap bloom. Tight: a wide radius floods the
     * whole frame with haze instead of hugging the ropes. */
    radius: 0.55,
  },

  vignette: {
    offset: 0.28,
    darkness: 0.52,
  },

  /** Final 2D grain layer opacity. */
  grainAlpha: 0.04,
} as const;
