import type { EnvLobe, EnvPanel } from "./engine/env";
import type { Look } from "./engine/types";

/**
 * Every "look" setting of ai-chip-reveal: exposure, tone mapping, lights,
 * environment, bloom, depth of field, lens and grain. Version 1 and
 * Version 2 share this file; only the palette (src/config.ts) differs.
 */
export const LOOK: Look = {
  toneMap: "aces",
  exposure: 1.0,
  msaa: 4,
  bloom: {
    threshold: 0.7,
    knee: 0.5,
    coreIntensity: 0.85,
    coreRadius: 0.65,
    haloIntensity: 0.014,
    haloRadius: 0.8,
    coreLevels: 5,
    haloLevels: 6,
  },
  dof: { enabled: true, bokehScale: 5, focusRange: 3.0 },
  fringe: { amount: 0.0, power: 1.5 },
  vignette: { strength: 0, inner: 0.3, outer: 1.2, center: [0.5, 0.5], aspect: 1 },
  grade: {
    contrast: 1.1,
    saturation: 0.92,
    gamma: 1.0,
    lift: [0, 0, 0],
    gain: [1, 1, 1],
  },
  grain: 0.015,
  dither: 1,
  sharpen: 0,
};

/** Lights (colour, intensity, direction in world space; the board faces +Z). */
export const LIGHTS = {
  key: { color: "#eef3ff", intensity: 3.2, pos: [-18, 30, 42] as [number, number, number] },
  fill: { intensity: 0.5, pos: [30, -6, 26] as [number, number, number] },
  rim: { color: "#cfe0ff", intensity: 0.8, pos: [8, 40, -10] as [number, number, number] },
  /** coloured spill lights near the chip (palette.spill) */
  spillIntensity: 9.0,
  /** soft pools of glow colour over the lower half of the board */
  poolIntensity: 11.0,
  envIntensity: 1.0,
};

/** Soft-box panels of the procedural studio environment (reflections). */
export const ENV_PANELS: EnvPanel[] = [
  { pos: [0, 44, 10], size: [60, 26], color: "#f2f6ff", intensity: 7.0 },
  { pos: [-46, 6, 12], size: [22, 60], color: "#ffffff", intensity: 9.0 },
  { pos: [44, -4, 10], size: [12, 40], color: "#ffe2c4", intensity: 3.0 },
  { pos: [0, -42, 12], size: [50, 12], color: "#dfe8ff", intensity: 2.0 },
];
/** grey level of the studio walls (gives metal something to reflect) */
export const ENV_AMBIENT = "#101113";
/** broad soft light of the studio: bright from the upper left front */
export const ENV_LOBES: EnvLobe[] = [
  { dir: [-1, 0.25, 0.2], color: "#f4f7ff", intensity: 2.6, power: 6 },
  { dir: [0.1, 1, 0.15], color: "#eef3ff", intensity: 3.0, power: 6 },
  { dir: [1, -0.2, 0.2], color: "#ffe6cc", intensity: 0.8, power: 6 },
  { dir: [-0.2, 0.2, 1], color: "#f4f7ff", intensity: 0.3, power: 3 },
];

/** Backdrop: a dark grey void with a soft pool of light (display values). */
export const BACKDROP = {
  /** height of the pool centre in screen UV (0 = bottom edge) */
  centerY: 0.05,
  /** display-linear brightness in the pool centre (0.013 = sRGB 30/255) */
  peak: 0.0118,
  /** distance (in frame heights) at which the pool has fallen to half */
  radius: 0.62,
  power: 3.0,
};

/** Depth of field per phase (blur size in 1080p pixels). */
export const DOF = {
  /** blur at the very start (camera at an angle) and by the time it is frontal */
  startBokeh: 10.0,
  closeBokeh: 6.0,
  wideBokeh: 0.0,
  closeRange: 1.6,
};

/** Material and effect strengths that shape the look. */
export const MATERIAL_LOOK = {
  pcb: "#08080a",
  back: "#0c1012",
  /** self-illumination of the white blocks (they clip to white on purpose) */
  whiteEmissive: 0.6,
  /** in the wide shot the white parts and the key light are held back */
  whiteWide: 0.06,
  keyWide: 0.14,
  /** exposure of the wide shot relative to the close-up */
  exposureWide: 0.7,
  /** HDR brightness of the glowing lines (1 = white point before bloom) */
  traceIntensity: 1.0,
  /** the lines are dimmed by this factor once the whole board is in view */
  traceWide: 1.0,
  chipTraceIntensity: 0.42,
  lettersIntensity: 2.0,
  /** in the wide shot the chip reads as one glowing copper square */
  lettersWide: 0.2,
  chipTraceWide: 2.4,
  /** bloom strength of the wide shot relative to the close-up */
  bloomWide: 1.8,
  /** brightness of the back-plate glint during the spin */
  backFlash: 8,
  /** extra exposure at the peak of the white-out flash */
  flashExposure: 10,
  /** sub-frame renders per frame while the whip is happening */
  motionSamples: 6,
  /** shutter length in frames (0.5 = 180 degrees) */
  shutter: 0.7,
};
