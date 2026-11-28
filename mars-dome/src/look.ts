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
  sun: { intensity: 4.6, elevationDeg: 45, azimuthDeg: 100, shadowRadius: 6, shadowMapSize: 4096 },
  /** Sky / ground ambient: the orange bounce that fills every shadow. */
  hemisphere: { intensity: 0.22 },
  /** Image-based light from the procedural dusty sky. */
  environment: { intensity: 0.2 },
  /** Path lamps and beacons: emissive brightness (they bloom). */
  lampBrightness: 8,
  beaconBrightness: 2.5,
  /**
   * Dome glass. transmit = how much of the scene behind shows through face-on (it dims, it does not veil);
   * grazing = mirror strength at glancing angles; hotspot = a broad bright patch of sky reflected in the
   * near side of the dome, placed at hotspotAt (fractions of the base frame, from the top left).
   */
  glass: { transmit: 0.82, grazing: 0.3, sunGlint: 0.5, hotspot: 0.55, hotspotPower: 110, hotspotAt: [0.93, 0.93] as [number, number] },
};

export const LOOK: Look = {
  exposure: 0.92,
  toneMap: "agx",
  whiteBalance: [1, 1, 1],
  fog: {
    color: [0.34, 0.085, 0.03],
    sunColor: [0.5, 0.16, 0.065],
    sunDir: [0.9, 0.3, -0.3],
    sunPower: 2,
    density: 0.0003,
    heightFalloff: 0.0,
    baseHeight: 0,
    maxOpacity: 0.93,
  },
  dof: {
    enabled: true,
    /** metres along the lens axis: the tower and the buildings around it */
    focus: 56,
    cocInfinity: 0.014,
    maxCoc: 0.045,
    nearScale: 0.45,
  },
  bloom: { threshold: 0.9, knee: 0.5, strength: 0.6, tilt: 0.25 },
  grade: {
    blackLevel: 0.085,
    whiteLevel: 1,
    contrast: 1.12,
    pivot: 0.42,
    saturation: 1,
    gamma: [1, 1, 1],
    shadowTint: [0, 0, 0],
    highlightTint: [0, 0, 0],
  },
  lens: { vignette: 0, vignetteStart: 0.4, chromaticAberration: 0.0015, softness: 0.0006 },
  grain: { amount: 0.0016, size: 2, chroma: 0.3 },
  dither: true,
};
