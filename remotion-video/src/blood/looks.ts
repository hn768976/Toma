/**
 * Look presets — one per reference clip.
 *
 * Each entry is a complete description of a version: palette, cell population,
 * camera behaviour, lighting rig and the DOM grade that sits on top of the
 * WebGPU/WebGL canvas. Durations are the reference durations re-expressed at
 * 30 fps (references were 25 / 30 / variable fps).
 */

export type LightSpec = {
  kind: "ambient" | "point" | "directional";
  color: string;
  intensity: number;
  position?: [number, number, number];
  /** Point lights only: falloff distance in world units. 0 = no falloff. */
  distance?: number;
  decay?: number;
};

export type VesselSpec = {
  /** Inner radius of the vessel tube. */
  radius: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  /** Mottling contrast of the procedural wall texture, 0..1. */
  mottle: number;
  /** How many times the wall texture repeats along the tube. */
  repeat: [number, number];
  /** Ribbed displacement of the tube silhouette. */
  ribs: number;
};

export type CoreGlowSpec = {
  color: string;
  /** Diameter in world units. */
  size: number;
  opacity: number;
  /** Distance in front of the far plane. */
  inset: number;
  /** Breathing amplitude, 0 = constant. */
  pulse: number;
};

export type MoteSpec = {
  count: number;
  color: string;
  size: [number, number];
  opacity: number;
  /** Speed multiplier relative to the cell flow. */
  drift: number;
  /** 0 = crisp specks, 1 = wide soft bokeh discs. */
  softness: number;
};

export type NearLayerSpec = {
  count: number;
  /** Blur radius at 1080p; scaled with the composition width. */
  blurPx: number;
  sizeScale: number;
  opacity: number;
};

export type GradeSpec = {
  /** Screen-blended bloom disc in the centre of frame. */
  bloom: { color: string; opacity: number; size: number; x: number; y: number };
  vignette: { color: string; opacity: number; start: number };
  /** Full-frame colour wash. */
  tint: { color: string; opacity: number; blend: "multiply" | "screen" | "overlay" | "soft-light" };
  grain: number;
  /** Fade from / to black, in frames. 0 = hard cut, like the references. */
  fadeIn: number;
  fadeOut: number;
};

export type BloodLook = {
  id: string;
  label: string;
  reference: string;
  durationInFrames: number;

  background: string;
  fogColor: string;
  fogDensity: number;

  cellColor: string;
  cellColorSpread: number;
  cellEmissive: string;
  cellEmissiveIntensity: number;
  specular: string;
  shininess: number;
  /** Golden speckle overlay on the cell surface, 0..1. */
  speckle: number;
  speckleColor: string;
  /** 0 = matte discs, 1 = translucent jelly (adds a rim-lit fresnel term). */
  translucency: number;

  swarmCount: number;
  heroCount: number;
  cellSize: [number, number];
  /** How much wider than the frame the cell population reaches, 1 = exactly. */
  fill: number;
  depth: number;
  flowSpeed: number;
  tumble: number;
  wobble: number;

  vessel: VesselSpec | null;
  coreGlow: CoreGlowSpec | null;
  motes: MoteSpec | null;
  nearLayer: NearLayerSpec | null;

  lights: LightSpec[];

  fov: number;
  /** Lateral camera drift amplitude in world units. */
  cameraDrift: number;
  /** Camera roll amplitude in degrees. */
  cameraRoll: number;
  /** Extra dolly on top of the cell flow, in world units per second. */
  cameraDolly: number;

  grade: GradeSpec;
};

const FPS = 30;
const seconds = (s: number) => Math.round(s * FPS);

/** V1 — near-black field, glossy rim-lit cells, heavy shallow focus. */
const obsidian: BloodLook = {
  id: "V1-Obsidian",
  label: "Obsidian Flow",
  reference: "de3308e7 · 10.03s · dark field, rim-lit cells, shallow DOF",
  durationInFrames: seconds(10.034),

  background: "#070203",
  fogColor: "#0a0304",
  fogDensity: 0.017,

  cellColor: "#e01c22",
  cellColorSpread: 0.16,
  cellEmissive: "#3a0407",
  cellEmissiveIntensity: 0.5,
  specular: "#ffb9a8",
  shininess: 46,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.85,

  swarmCount: 280,
  heroCount: 16,
  cellSize: [0.4, 1.1],
  fill: 1.25,
  depth: 46,
  flowSpeed: 1.5,
  tumble: 0.34,
  wobble: 0.5,

  vessel: null,
  coreGlow: { color: "#48070b", size: 44, opacity: 0.35, inset: 2, pulse: 0.1 },
  motes: { count: 70, color: "#ff8a7a", size: [0.02, 0.07], opacity: 0.35, drift: 1.1, softness: 0.4 },
  nearLayer: { count: 6, blurPx: 26, sizeScale: 1.7, opacity: 0.7 },

  lights: [
    { kind: "ambient", color: "#2a0507", intensity: 0.5 },
    { kind: "point", color: "#ffd9c8", intensity: 420, position: [7, 9, 4], distance: 70, decay: 2 },
    { kind: "point", color: "#ff5a48", intensity: 240, position: [-9, -5, -6], distance: 65, decay: 2 },
    { kind: "directional", color: "#ff3d33", intensity: 0.55, position: [0, 0, -12] },
  ],

  fov: 46,
  cameraDrift: 0.55,
  cameraRoll: 1.6,
  cameraDolly: 0.18,

  grade: {
    bloom: { color: "#5e0a10", opacity: 0.3, size: 108, x: 50, y: 48 },
    vignette: { color: "#000000", opacity: 0.66, start: 38 },
    tint: { color: "#2a0206", opacity: 0.14, blend: "multiply" },
    grain: 0.05,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V2 — vessel tunnel with a blown white core, dense fast flow. */
const vessel: BloodLook = {
  id: "V2-VesselCore",
  label: "Vessel Core",
  reference: "022d81ce · 18.53s · vessel tunnel, white core glow, dense",
  durationInFrames: seconds(18.534),

  background: "#2a0406",
  fogColor: "#7c0d12",
  fogDensity: 0.034,

  cellColor: "#c8161c",
  cellColorSpread: 0.2,
  cellEmissive: "#5c0509",
  cellEmissiveIntensity: 0.55,
  specular: "#ff9f8c",
  shininess: 38,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.7,

  swarmCount: 320,
  heroCount: 16,
  cellSize: [0.3, 0.95],
  fill: 1.3,
  depth: 50,
  flowSpeed: 3.6,
  tumble: 0.5,
  wobble: 0.45,

  vessel: {
    radius: 12.5,
    color: "#8e1016",
    emissive: "#3d0508",
    emissiveIntensity: 0.3,
    mottle: 0.55,
    repeat: [4, 2],
    ribs: 0.16,
  },
  coreGlow: { color: "#fff3ec", size: 19, opacity: 0.9, inset: 3, pulse: 0.07 },
  motes: { count: 120, color: "#ffd8c8", size: [0.02, 0.06], opacity: 0.4, drift: 1.35, softness: 0.3 },
  nearLayer: { count: 8, blurPx: 22, sizeScale: 2.2, opacity: 0.8 },

  lights: [
    { kind: "ambient", color: "#5a0a0e", intensity: 0.85 },
    { kind: "point", color: "#fff0e6", intensity: 900, position: [0, 0, -44], distance: 85, decay: 1.7 },
    { kind: "point", color: "#ff7c68", intensity: 190, position: [6, 7, 2], distance: 45, decay: 2 },
    { kind: "point", color: "#c01018", intensity: 140, position: [-7, -6, -10], distance: 50, decay: 2 },
  ],

  fov: 62,
  cameraDrift: 0.7,
  cameraRoll: 2.4,
  cameraDolly: 0.5,

  grade: {
    bloom: { color: "#fff1e4", opacity: 0.5, size: 62, x: 50, y: 47 },
    vignette: { color: "#3d0508", opacity: 0.8, start: 36 },
    tint: { color: "#b3141a", opacity: 0.12, blend: "soft-light" },
    grain: 0.045,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V3 — saturated crimson field, gold-speckled cells, rising bubbles. */
const crimson: BloodLook = {
  id: "V3-CrimsonGold",
  label: "Crimson & Gold",
  reference: "be5b4ffd · 18.04s · saturated crimson, gold-speckled cells, bubbles",
  durationInFrames: seconds(18.04),

  background: "#b00f18",
  fogColor: "#c2121c",
  fogDensity: 0.036,

  cellColor: "#c41019",
  cellColorSpread: 0.14,
  cellEmissive: "#7a0a10",
  cellEmissiveIntensity: 0.5,
  specular: "#ffd9a8",
  shininess: 44,
  speckle: 0.32,
  speckleColor: "#f0a93c",
  translucency: 0.45,

  swarmCount: 260,
  heroCount: 15,
  cellSize: [0.35, 1.05],
  fill: 1.2,
  depth: 40,
  flowSpeed: 2.1,
  tumble: 0.42,
  wobble: 0.55,

  vessel: {
    radius: 14,
    color: "#b81018",
    emissive: "#8c0c14",
    emissiveIntensity: 0.45,
    mottle: 0.3,
    repeat: [2, 3],
    ribs: 0.18,
  },
  coreGlow: { color: "#e8343c", size: 70, opacity: 0.2, inset: 2, pulse: 0.12 },
  motes: { count: 260, color: "#ffcf7a", size: [0.025, 0.1], opacity: 0.55, drift: 0.8, softness: 0.65 },
  nearLayer: { count: 7, blurPx: 20, sizeScale: 2.3, opacity: 0.75 },

  lights: [
    { kind: "ambient", color: "#8e0c14", intensity: 1.15 },
    { kind: "point", color: "#ffd9a0", intensity: 330, position: [8, 10, 3], distance: 55, decay: 2 },
    { kind: "point", color: "#ff5a4a", intensity: 220, position: [-9, -7, -8], distance: 55, decay: 2 },
    { kind: "directional", color: "#ffb36b", intensity: 0.5, position: [-3, 6, 6] },
  ],

  fov: 50,
  cameraDrift: 0.6,
  cameraRoll: 1.8,
  cameraDolly: 0.22,

  grade: {
    bloom: { color: "#ff5b52", opacity: 0.3, size: 96, x: 52, y: 46 },
    vignette: { color: "#6b0209", opacity: 0.62, start: 40 },
    tint: { color: "#ff2b1f", opacity: 0.18, blend: "overlay" },
    grain: 0.05,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V4 — blown-out white core, oversized soft cells, pink haze. */
const luminous: BloodLook = {
  id: "V4-Luminous",
  label: "Luminous Artery",
  reference: "89469653 · 19.63s · blown white core, large soft cells, pink vignette",
  durationInFrames: seconds(19.634),

  background: "#5e0a0d",
  fogColor: "#b8383c",
  fogDensity: 0.034,

  cellColor: "#b8141c",
  cellColorSpread: 0.22,
  cellEmissive: "#6e0a10",
  cellEmissiveIntensity: 0.6,
  specular: "#ffc8bd",
  shininess: 30,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.9,

  swarmCount: 300,
  heroCount: 16,
  cellSize: [0.32, 0.95],
  fill: 1.15,
  depth: 44,
  flowSpeed: 2.6,
  tumble: 0.38,
  wobble: 0.5,

  vessel: {
    radius: 11,
    color: "#a8282c",
    emissive: "#8e1a1e",
    emissiveIntensity: 0.9,
    mottle: 0.4,
    repeat: [2, 4],
    ribs: 0.28,
  },
  coreGlow: { color: "#ffffff", size: 21, opacity: 1, inset: 3, pulse: 0.09 },
  motes: { count: 90, color: "#ffe6dc", size: [0.02, 0.07], opacity: 0.35, drift: 1.2, softness: 0.45 },
  nearLayer: { count: 10, blurPx: 34, sizeScale: 2.8, opacity: 0.9 },

  lights: [
    { kind: "ambient", color: "#a03038", intensity: 0.95 },
    { kind: "point", color: "#ffffff", intensity: 1500, position: [0, 1, -38], distance: 95, decay: 1.6 },
    { kind: "point", color: "#ff9d90", intensity: 180, position: [7, 6, 4], distance: 42, decay: 2 },
    { kind: "point", color: "#e0424a", intensity: 120, position: [-8, -5, -6], distance: 45, decay: 2 },
  ],

  fov: 58,
  cameraDrift: 0.8,
  cameraRoll: 2.8,
  cameraDolly: 0.35,

  grade: {
    bloom: { color: "#ffffff", opacity: 0.62, size: 70, x: 50, y: 48 },
    vignette: { color: "#5e0a0d", opacity: 0.72, start: 34 },
    tint: { color: "#ff8f88", opacity: 0.09, blend: "screen" },
    grain: 0.04,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V5 — wide deep field, many small cells, flat even light. Has a matte pass. */
const deepField: BloodLook = {
  id: "V5-DeepField",
  label: "Deep Field",
  reference: "8f4c18de · 17.05s colour (+17.05s matte) · wide field, many small cells",
  durationInFrames: seconds(17.045),

  background: "#5c0a0a",
  fogColor: "#7a1010",
  fogDensity: 0.016,

  cellColor: "#c9161c",
  cellColorSpread: 0.18,
  cellEmissive: "#5e080c",
  cellEmissiveIntensity: 0.45,
  specular: "#ff9a86",
  shininess: 28,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.55,

  swarmCount: 660,
  heroCount: 14,
  cellSize: [0.2, 0.6],
  fill: 1.35,
  depth: 58,
  flowSpeed: 1.9,
  tumble: 0.45,
  wobble: 0.4,

  vessel: {
    radius: 17,
    color: "#7a0c0e",
    emissive: "#4e0608",
    emissiveIntensity: 0.5,
    mottle: 0.45,
    repeat: [2, 4],
    ribs: 0.2,
  },
  coreGlow: { color: "#3a0406", size: 30, opacity: 0.4, inset: 2, pulse: 0.06 },
  motes: { count: 80, color: "#ff9d8a", size: [0.015, 0.05], opacity: 0.25, drift: 1.1, softness: 0.35 },
  nearLayer: null,

  lights: [
    { kind: "ambient", color: "#8a1014", intensity: 1.25 },
    { kind: "directional", color: "#ffb0a0", intensity: 1.1, position: [4, 8, 10] },
    { kind: "point", color: "#ff6a58", intensity: 260, position: [-10, -6, -14], distance: 70, decay: 2 },
  ],

  fov: 68,
  cameraDrift: 0.45,
  cameraRoll: 1.2,
  cameraDolly: 0.15,

  grade: {
    bloom: { color: "#8c0f14", opacity: 0.22, size: 120, x: 50, y: 50 },
    vignette: { color: "#3a0405", opacity: 0.4, start: 50 },
    tint: { color: "#a01016", opacity: 0.14, blend: "multiply" },
    grain: 0.04,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V6 — muted brown-red, sparkling bokeh specks, moody and close. */
const emberBokeh: BloodLook = {
  id: "V6-EmberBokeh",
  label: "Ember Bokeh",
  reference: "617f6ddf · 10.01s · muted brown-red, sparkling bokeh specks",
  durationInFrames: seconds(10.008),

  background: "#3a1512",
  fogColor: "#6b2a22",
  fogDensity: 0.033,

  cellColor: "#a33a2e",
  cellColorSpread: 0.2,
  cellEmissive: "#43110c",
  cellEmissiveIntensity: 0.4,
  specular: "#ffcbb0",
  shininess: 70,
  speckle: 0.25,
  speckleColor: "#ffd9a0",
  translucency: 0.6,

  swarmCount: 140,
  heroCount: 13,
  cellSize: [0.45, 1.5],
  fill: 1.2,
  depth: 42,
  flowSpeed: 1.7,
  tumble: 0.36,
  wobble: 0.6,

  vessel: {
    radius: 15,
    color: "#5e2019",
    emissive: "#2e0c08",
    emissiveIntensity: 0.45,
    mottle: 0.5,
    repeat: [2, 4],
    ribs: 0.22,
  },
  coreGlow: { color: "#8a3a28", size: 64, opacity: 0.16, inset: 2, pulse: 0.1 },
  motes: { count: 420, color: "#ffd2a8", size: [0.03, 0.14], opacity: 0.6, drift: 0.7, softness: 0.85 },
  nearLayer: { count: 8, blurPx: 28, sizeScale: 2.4, opacity: 0.8 },

  lights: [
    { kind: "ambient", color: "#4a1a14", intensity: 0.9 },
    { kind: "point", color: "#ffd0ae", intensity: 300, position: [6, 8, 5], distance: 50, decay: 2 },
    { kind: "point", color: "#c4503a", intensity: 160, position: [-8, -6, -9], distance: 50, decay: 2 },
    { kind: "directional", color: "#e07a58", intensity: 0.4, position: [0, -4, -10] },
  ],

  fov: 44,
  cameraDrift: 0.65,
  cameraRoll: 2,
  cameraDolly: 0.2,

  grade: {
    bloom: { color: "#b5613f", opacity: 0.3, size: 100, x: 48, y: 50 },
    vignette: { color: "#180705", opacity: 0.8, start: 30 },
    tint: { color: "#7a2c1e", opacity: 0.2, blend: "soft-light" },
    grain: 0.06,
    fadeIn: 0,
    fadeOut: 0,
  },
};

export const LOOKS = [obsidian, vessel, crimson, luminous, deepField, emberBokeh];

export const LOOKS_BY_ID: Record<string, BloodLook> = Object.fromEntries(
  LOOKS.map((look) => [look.id, look]),
);
