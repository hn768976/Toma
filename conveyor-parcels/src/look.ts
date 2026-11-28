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
    elevationDeg: 40,
    /** Sideways lean of the beam (negative = from behind-right). Sets where the glare sits on the rollers. */
    sideways: -0.24,
    shadowRadius: 7,
    shadowMapSize: 4096,
  },
  /** Soft ambient: sky colour from above, ground colour from below. */
  hemisphere: { intensity: 0.22 },
  /** Image-based light from the procedural warehouse environment. */
  environment: { intensity: 0.3, panelBrightness: 9, wallBrightness: 0.5, ceilingBrightness: 0.3, farGlowBrightness: 14, farGlowHeight: 3.2 },
  /** Warm bounce onto the faces turned to the camera while the zone is near. */
  bounce: { intensity: 0.12 },
  /** Roller surface (see the shader additions in world.ts). */
  rollers: {
    roughness: 0.5,
    specular: 1,
    /** Highlight on the crest of each roller: brightness, and the range of upward tilt it fades in over (0-1). */
    crestBrightness: 0.55,
    crestStart: 0.9,
    crestEnd: 1.0,
    /** The crest highlight is weaker on the left of the frame: weight there, and the range it ramps over. */
    crestLeft: 0.12,
    crestFrom: -0.16,
    crestTo: 0.1,
    /** Streaks per roller pitch along each roller, and a flat ambient lift of the roller colour. */
    streakScale: 0.7,
    baseLift: 0.42,
    /** Key-light glare weight at the left / right of the frame, and the range (x / distance) it ramps over. */
    glareLeft: 0.12,
    glareRight: 1.5,
    glareFrom: -0.04,
    glareTo: 0.17,
  },
  /** Brightness of the flat far strip of the belt relative to the roller colour. */
  farBelt: { brightness: 0.5 },
  /** Brightness of the unlit, out-of-focus warehouse behind the parcels. */
  backdrop: { brightness: 0.26 },
};

export const LOOK: Look = {
  exposure: 1.25,
  toneMap: "aces",
  whiteBalance: [1, 1, 1],
  fog: {
    color: [0.06, 0.045, 0.043],
    sunColor: [0.06, 0.045, 0.043],
    sunDir: [0, 1, 0],
    sunPower: 8,
    density: 0.03,
    heightFalloff: 0,
    baseHeight: 0,
    maxOpacity: 0.7,
  },
  dof: {
    enabled: true,
    /** metres along the lens axis: the hero parcel */
    focus: 1.5,
    cocInfinity: 0.075,
    maxCoc: 0.08,
    nearScale: 0.8,
  },
  bloom: { threshold: 0.85, knee: 0.5, strength: 0.35, tilt: 0.2 },
  grade: {
    blackLevel: 0.05,
    whiteLevel: 1,
    contrast: 1,
    pivot: 0.4,
    saturation: 1,
    gamma: [1, 1, 1],
    shadowTint: [0, 0, 0],
    highlightTint: [0, 0, 0],
  },
  lens: { vignette: 0.15, vignetteStart: 0.35, chromaticAberration: 0.0012, softness: 0.0012 },
  grain: { amount: 0.002, size: 1.6, chroma: 0.25 },
  dither: true,
};

/** Version 2 keeps every value above and only re-tints the grade to suit the cold palette. */
export const GRADE_V2: Partial<Look["grade"]> = {
  shadowTint: [0, 0.004, 0.012],
  highlightTint: [0, 0, 0],
};

export const lookFor = (variant: "v1" | "v2"): Look =>
  variant === "v1" ? LOOK : { ...LOOK, grade: { ...LOOK.grade, ...GRADE_V2 } };
