import type { GlyphVersion } from "./looks/glyphs";
import type { PipeVersion } from "./looks/pipes";
import type { PostSettings } from "./engine/post";

// One data row per version. Add a colourway or metal by adding a row.
const basePost: Omit<PostSettings, "depthScale"> = {
  focusDist: 10, aperture: 0.03, maxCoc: 0.028, bloomThreshold: 1.2, bloomKnee: 0.6,
  bloomIntensity: 0.25, exposure: 1.0, lift: [0, 0, 0], gain: [1, 1, 1], gamma: [1, 1, 1],
  saturation: 1, contrast: 1, vignette: 0.35, grain: 0.015,
};

const steelEnv: PipeVersion["env"] = { panel: [1, 1, 1], top: [1.1, 1.12, 1.18], base: [0.02, 0.021, 0.024] };
const copperEnv: PipeVersion["env"] = { panel: [1.0, 0.94, 0.86], top: [1.1, 1.0, 0.9], base: [0.022, 0.02, 0.018] };
const coolGrade = { lift: [0.0, 0.002, 0.005] as [number, number, number], gain: [0.97, 1.0, 1.04] as [number, number, number] };
const warmGrade = { lift: [0.01, 0.004, 0.0] as [number, number, number], gain: [1.03, 1.0, 0.95] as [number, number, number] };

export const STACKED_STEEL: PipeVersion = {
  kind: "pipes", layout: "stack", wallFrac: 0.05,
  metal: { color: "#c9ccd1", roughness: 0.16, innerRoughness: 0.35, envIntensity: 1.0 },
  env: steelEnv, envSwayDeg: 4, bg: "#0a0b0d",
  camera: { fov: 34, pos: [-6.0, 14.2, 3.6], target: [-0.7, 11.1, -0.6], sway: [0.6, 0.3, 0.2], push: 0, roll: 6 },
  post: { ...basePost, focusDist: 7.6, aperture: 0.012, lift: [0.0, 0.006, 0.016], gain: [0.94, 1.0, 1.08], contrast: 1.06 },
};

const bundleBase: PipeVersion = {
  kind: "pipes", layout: "bundle", wallFrac: 0.15,
  metal: { color: "#c9ccd1", roughness: 0.16, innerRoughness: 0.35, envIntensity: 1.3 },
  env: steelEnv, envSwayDeg: 5, bg: "#060606",
  camera: { fov: 26, pos: [-5.5, -9.0, 9.5], target: [0.0, 1.0, -6], sway: [1.0, 0.4, 0.3], push: 1.2 },
  post: { ...basePost, focusDist: 12.5, aperture: 0.02, bloomIntensity: 0.05, ...coolGrade },
};
export const BUNDLE_STEEL: PipeVersion = bundleBase;
export const BUNDLE_COPPER: PipeVersion = {
  ...bundleBase,
  metal: { color: "#c8784a", roughness: 0.2, innerRoughness: 0.38, envIntensity: 1.3 },
  env: copperEnv,
  post: { ...bundleBase.post, ...warmGrade },
};

// ---------------------------------------------------------------- glyph surfaces

const glyphPost: Omit<PostSettings, "depthScale"> = {
  ...basePost, bloomThreshold: 0.9, bloomKnee: 0.5, bloomIntensity: 0.9, vignette: 0.45,
};

const floorBase: GlyphVersion = {
  kind: "floor", seed: 1090964280,
  palette: [
    { color: "#1aa89a", weight: 40 }, { color: "#2ad86a", weight: 25 },
    { color: "#1a6ad8", weight: 20 }, { color: "#3ae8e8", weight: 10 },
  ],
  accent: "#f0f8c0", glyphFraction: 0.6, bg: "#020406",
  fog: { color: "#03100f", density: 0.006 },
  camera: { fov: 50, pos: [0, 13, 0], target: [0, 13 - Math.tan((40 * Math.PI) / 180) * 10, -10], sway: [0.0, 0.0, 0], orbitDeg: 0 },
  post: { ...glyphPost, focusDist: 21, aperture: 0.05, maxCoc: 0.03, nearScale: 1.0, exposure: 2.8, bloomIntensity: 1.8, saturation: 1.15 },
};
export const FLOOR_GREEN_TEAL: GlyphVersion = floorBase;
export const FLOOR_MAGENTA_BLUE: GlyphVersion = {
  ...floorBase,
  palette: [
    { color: "#d83ab8", weight: 40 }, { color: "#7a3ae8", weight: 25 },
    { color: "#2a6aff", weight: 20 }, { color: "#ff6ac8", weight: 10 },
  ],
  accent: "#ffe8f4", fog: { color: "#0c0414", density: 0.006 },
};

export const GLYPH_WAVE_BLUE: GlyphVersion = {
  kind: "wave", seed: 1456772315,
  palette: [{ color: "#2a8ae8", weight: 1 }, { color: "#7ad8ff", weight: 1 }],
  accent: "#dff6ff", fill: "#06183a", bg: "#020814",
  fog: { color: "#020814", density: 0.004 },
  camera: { fov: 42, pos: [-14.5, 14.0, 3.0], target: [0, 0, 0], sway: [0.4, 0.3, 2.0], orbitDeg: 0, up: [0.25, 0, -1] },
  pixelate: 11, glyphScale: 1.4,
  post: { ...glyphPost, focusDist: 20.5, focusTilt: [-0.5, -0.45], aperture: 0.045, maxCoc: 0.022, nearScale: 0.6, bloomIntensity: 1.2, bloomThreshold: 0.5, exposure: 1.3, saturation: 1.2 },
};

export const BINARY_CUBES: GlyphVersion = {
  kind: "cubes", seed: 1477627859,
  palette: [
    { color: "#2ab8f0", weight: 1 }, { color: "#4a5af0", weight: 1 },
    { color: "#8a4ae8", weight: 1 }, { color: "#c04ae0", weight: 1 },
  ],
  accent: "#ffc85a", bg: "#05041a", nearBump: 0.9,
  camera: { fov: 37, pos: [0, 17.0, 10.0], target: [0, 0, 0.5], sway: [0, 0, 0], orbitDeg: 6 },
  post: { ...glyphPost, focusDist: 19.5, aperture: 0.07, maxCoc: 0.026, bloomIntensity: 1.2, saturation: 1.15 },
};
