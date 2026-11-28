import { Look } from "./engine/pipeline";

/**
 * Every look setting for the conveyor-parcels composition: exposure and tone
 * mapping, light levels and directions, fog, depth of field, bloom, grade,
 * lens and grain. Version 1 and Version 2 share this file; Version 2 only
 * swaps the colour palette (config.ts) and the grade tints in `GRADE_V2`.
 */

/** Light levels and directions (colours come from the palette in config.ts). */
export const LIGHTS = {
  /** Hard overhead backlight that travels along the belt as a lit zone. */
  key: {
    intensity: 12,
    /** Degrees above the horizon. Low: the parcels throw long shadows towards the lens. */
    elevationDeg: 52,
    /** Sideways lean of the beam (negative = from behind-right). Sets where the glare sits on the rollers. */
    sideways: -0.24,
    shadowRadius: 10,
    shadowMapSize: 4096,
  },
  /** Soft ambient: sky colour from above, ground colour from below. */
  hemisphere: { intensity: 0.7 },
  /** Opacity of the soft dark patch under each parcel. */
  contactShadow: 0.75,
  /** Opacity of the tight, dark core of that shadow right at the carton's edges. */
  contactShadowTight: 0.95,
  /** Image-based light from the procedural warehouse environment. */
  environment: { intensity: 0.18, panelBrightness: 9, wallBrightness: 0.5, ceilingBrightness: 0.3, farGlowBrightness: 14, farGlowHeight: 3.2 },
  /** Warm bounce onto the faces turned to the camera while the zone is near. */
  bounce: { base: 0.22, intensity: 0.3 },
  /** Weak shadowless light from straight above: keeps the tops of the cartons readable between light zones. */
  top: { intensity: 1.3 },
  /** Roller surface (see the shader additions in world.ts). */
  rollers: {
    roughness: 0.5,
    specular: 1,
    /** Highlight on the crest of each roller: brightness, and the range of upward tilt it fades in over (0-1). */
    crestBrightness: 0.75,
    crestStart: 0.9,
    crestEnd: 1.0,
    /** The crest highlight is weaker on the left of the frame: weight there, and the range it ramps over. */
    crestLeft: 0.04,
    crestFrom: -0.02,
    crestTo: 0.15,
    /** Streaks per roller pitch along each roller, and a flat ambient lift of the roller colour. */
    streakScale: 0.7,
    /** How much the streaks break the highlight up (0 = continuous line, 1 = fully broken). */
    streakDepth: 0.4,
    baseLift: 0.6,
    /** The highlights fade towards the lens: weight at nearFadeFrom metres rising to 1 at nearFadeTo. */
    nearFadeMin: 0.9,
    nearFadeFrom: 0.85,
    nearFadeTo: 1.5,
    /** Key-light glare across the frame: floor level, peak level, where the peak sits (x / distance) and its width to the left / right. */
    glareLeft: 0.06,
    glareRight: 0.75,
    glareCentre: 0.15,
    glareWidthLeft: 0.05,
    glareWidthRight: 0.1,
    /** Matte (diffuse) share of the key light at the glare's peak. */
    glareDiffuse: 0.9,
    /** Dark groove between rollers: range of the surface's turn towards the lens it fades in over (0-1), and its depth. */
    grooveStart: 0.26,
    grooveEnd: 0.52,
    grooveDepth: 0.85,
    /** Left of the glare the ribs flatten into a satin sheet: how flat (0-1), and the brightness there. */
    leftFlatten: 0.75,
    leftLevel: 0.78,
  },
  /** Brightness of the flat far strip of the belt relative to the roller colour. */
  farBelt: { brightness: 0.22 },
  /** Brightness of the unlit, out-of-focus warehouse behind the parcels. */
  backdrop: { brightness: 1.1 },
};

export const LOOK: Look = {
  msaaSamples: 2,
  exposure: 1.25,
  toneMap: "aces",
  whiteBalance: [1, 1, 1],
  fog: {
    color: [0.084, 0.06, 0.062],
    sunColor: [0.084, 0.06, 0.062],
    sunDir: [0, 1, 0],
    sunPower: 8,
    density: 0.02,
    heightFalloff: 0,
    baseHeight: 0,
    maxOpacity: 0.6,
  },
  dof: {
    enabled: true,
    /** metres along the lens axis: the hero parcel */
    focus: 1.5,
    cocInfinity: 0.11,
    maxCoc: 0.12,
    nearScale: 0.55,
    tiltShift: { amount: 0, centre: 0.5, width: 0.3 },
  },
  bloom: { threshold: 1.0, knee: 0.5, strength: 0.14, tilt: 0.3 },
  grade: {
    blackLevel: 0.0,
    whiteLevel: 1,
    contrast: 1.1,
    pivot: 0.3,
    saturation: 0.68,
    gamma: [1, 1, 1],
    shadowTint: [0.004, 0.002, 0.004],
    highlightTint: [0.014, 0.004, -0.014],
  },
  lens: { vignette: 0, vignetteStart: 0.35, chromaticAberration: 0.0012, softness: 0.0021 },
  grain: { amount: 0.0022, size: 2.4, chroma: 0.08 },
  dither: true,
};

/** Version 2 keeps every value above and only re-tints the grade to suit the cold palette. */
export const GRADE_V2: Partial<Look["grade"]> = {
  shadowTint: [0, 0.004, 0.012],
  highlightTint: [0, 0, 0],
};

export const lookFor = (variant: "v1" | "v2"): Look =>
  variant === "v1" ? LOOK : { ...LOOK, grade: { ...LOOK.grade, ...GRADE_V2 } };
