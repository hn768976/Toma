import { Look } from "./engine/pipeline";

/**
 * Every look setting for the mars-dome composition: exposure and tone mapping,
 * light levels and directions, haze, depth of field, bloom, grade, lens and
 * grain. Version 1 and Version 2 share all of it; Version 2 only changes the
 * camera move (config.ts).
 */

/** Light levels and directions (colours come from the palette in config.ts). */
export const LIGHTS = {
  /** Soft sun from the camera's upper left. */
  sun: { intensity: 3.6, elevationDeg: 60, azimuthDeg: 84, shadowRadius: 18, shadowMapSize: 4096 },
  /** Sky / ground ambient: the orange bounce that fills every shadow. */
  hemisphere: { intensity: 0.6 },
  /** Image-based light from the procedural dusty sky. */
  environment: { intensity: 0.2 },
  /** Path lamps and beacons: emissive brightness (they bloom). */
  lampBrightness: 7,
  beaconBrightness: 1.6,
  /**
   * Dome glass. transmit = how much of the scene behind shows through face-on (it dims, it does not veil);
   * grazing = mirror strength at glancing angles; hotspot = a broad bright patch of sky reflected in the
   * near side of the dome; veil = a faint even sheen of sky over everything behind the glass; placed at hotspotAt (fractions of the base frame, from the top left).
   */
  glass: { transmit: 0.82, grazing: 0.4, veil: 0.035, sunGlint: 0, hotspot: 1.3, hotspotPower: 110, hotspotAt: [0.9, 0.915] as [number, number] },
};

export const LOOK: Look = {
  msaaSamples: 4,
  exposure: 0.92,
  toneMap: "agx",
  whiteBalance: [1, 1, 1],
  fog: {
    color: [0.4, 0.1, 0.028],
    sunColor: [1.15, 0.5, 0.17],
    sunDir: [0.22, 0.07, -1],
    sunPower: 5,
    density: 0.0006,
    heightFalloff: 0.0,
    baseHeight: 0,
    maxOpacity: 0.93,
  },
  dof: {
    enabled: true,
    /** metres along the lens axis: the tower and the buildings around it */
    focus: 56,
    cocInfinity: 0.022,
    maxCoc: 0.035,
    nearScale: 0.55,
  },
  bloom: { threshold: 0.85, knee: 0.5, strength: 0.6, tilt: 0.15 },
  grade: {
    blackLevel: 0.05,
    whiteLevel: 1,
    contrast: 1.16,
    pivot: 0.44,
    saturation: 1.08,
    gamma: [1.12, 1.12, 1.12],
    shadowTint: [0, 0, 0],
    highlightTint: [0, 0, 0],
  },
  lens: { vignette: 0, vignetteStart: 0.4, chromaticAberration: 0.0015, softness: 0 },
  grain: { amount: 0.0034, size: 2, chroma: 0.3 },
  dither: true,
};
