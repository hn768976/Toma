import type { EnvLobe, EnvPanel } from "./engine/env";
import type { Look } from "./engine/types";

/**
 * Every "look" setting of chip-ignite: exposure, tone mapping, lights,
 * environment, bloom, depth of field, lens fringe and grain. Version 1 and
 * Version 2 share this file; only the camera move (src/config.ts) differs.
 */
export const LOOK: Look = {
  toneMap: "aces",
  exposure: 0.78,
  msaa: 4,
  bloom: {
    threshold: 0.85,
    knee: 0.5,
    coreIntensity: 0.4,
    coreRadius: 0.6,
    haloIntensity: 0.1,
    haloRadius: 0.8,
    coreLevels: 5,
    haloLevels: 8,
  },
  dof: { enabled: true, bokehScale: 5.0, focusRange: 19 },
  fringe: { amount: 0.012, power: 1.6 },
  vignette: { strength: 0.3, inner: 0.34, outer: 1.35, center: [0.64, 0.4], aspect: 1 },
  grade: {
    contrast: 1.1,
    saturation: 1.0,
    gamma: 1.3,
    lift: [0, 0, 0],
    gain: [1, 1, 1],
  },
  grain: 0.03,
  dither: 1,
  sharpen: 0.3,
};

/** Lights. The board lies in the XY plane and +Z is up. */
export const LIGHTS = {
  key: { color: "#f3f6ff", intensity: 4.6, pos: [26, -22, 38] as [number, number, number] },
  fill: { color: "#ffe2c4", intensity: 0.3, pos: [-30, 10, 30] as [number, number, number] },
  envIntensity: 1.0,
  /** peak strength of the orange light the ignited chip throws */
  ignition: 30,
};

export const ENV_AMBIENT = "#0a0a0a";
export const ENV_LOBES: EnvLobe[] = [
  { dir: [0.75, -0.5, 0.45], color: "#fffaf4", intensity: 4.5, power: 5 },
  { dir: [0.1, 0.2, 1], color: "#ffffff", intensity: 1.4, power: 3 },
  { dir: [-0.8, 0.5, 0.3], color: "#ffe9d2", intensity: 0.35, power: 5 },
];
export const ENV_PANELS: EnvPanel[] = [
  { pos: [34, -26, 26], size: [34, 22], color: "#f6f9ff", intensity: 7 },
  { pos: [0, 0, 52], size: [26, 26], color: "#ffffff", intensity: 2.2 },
  { pos: [-40, 20, 14], size: [10, 40], color: "#eef2ff", intensity: 0.8 },
];

/** Material and effect strengths that shape the look. */
export const MATERIAL_LOOK = {
  /** brightness multiplier of the silver copper pattern on the board */
  boardSilver: "#a9a9a7",
  tileSilver: "#f2f2ee",
  /** HDR brightness of the glowing lines (1 = white point before bloom) */
  lineIntensity: 1.6,
  boardLineIntensity: 1.2,
  /** extra brightness of the leading edge while the lines spread */
  lineHead: 1.2,
  chipGlow: 2.2,
  flareIntensity: 5,
  /** flare size as a fraction of the frame height */
  flareSize: 0.42,
  ledIntensity: 7.0,
  edgeIntensity: 0.0,
};

/** Depth of field (blur size in 1080p pixels, sharp range in cm). */
export const DOF = { bokeh: 5.0, range: 19 };
