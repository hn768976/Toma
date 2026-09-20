/**
 * Look presets — one per reference clip.
 *
 * Each entry is a complete description of a version: palette, cell population,
 * travel direction, lighting rig and the DOM grade that sits on top of the
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

export type BackdropSpec = {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  /** Mottling contrast of the procedural tissue texture, 0..1. */
  mottle: number;
  repeat: [number, number];
};

export type CoreGlowSpec = {
  color: string;
  /** Height in world units at the glow's depth. */
  size: number;
  /** Width relative to height. Above 1 gives a horizontal band. */
  aspect: number;
  opacity: number;
  /** Placement as a fraction of the frame, -1..1, from the centre. */
  offset: [number, number];
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
  /** 0 = crisp specks, 1 = wide soft discs. Kept low: nothing should read as defocused. */
  softness: number;
};

export type GradeSpec = {
  /** Screen-blended light bloom. Width and height are percentages of the frame. */
  bloom: { color: string; opacity: number; width: number; height: number; x: number; y: number };
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
  /** Lighting balance knob: raises inner glow and softens the specular. */
  translucency: number;

  /** Total cells requested. The largest `heroCount` of them use the .glb. */
  cellCount: number;
  heroCount: number;
  cellSize: [number, number];
  /** Clear space left between two cell surfaces, in world units. */
  cellMargin: number;
  /** Keep-out radius around the lens, so no cell ever passes through it. */
  cameraClearance: number;

  fov: number;
  /** Depth of the box, in world units. */
  depth: number;
  /** How far behind the lens the box ends. */
  nearZ: number;
  /** Box size beyond the far-plane frustum; the margin that hides every wrap. */
  fill: number;

  /** Direction of travel. Normalised at use, so these need not be unit vectors. */
  flowDirection: [number, number, number];
  /** One speed for the whole population — see the note in flow.ts. */
  flowSpeed: number;
  tumble: number;

  backdrop: BackdropSpec | null;
  coreGlow: CoreGlowSpec | null;
  motes: MoteSpec | null;

  lights: LightSpec[];

  /** Lateral camera drift amplitude in world units. */
  cameraDrift: number;
  /** Camera roll amplitude in degrees. */
  cameraRoll: number;
  /** Slow breathing dolly amplitude in world units. */
  cameraDolly: number;

  grade: GradeSpec;
};

const FPS = 30;
const seconds = (s: number) => Math.round(s * FPS);

/** V1 — near-black field, glossy rim-lit cells, packed full from the first frame. */
const obsidian: BloodLook = {
  id: "V1-Obsidian",
  label: "Obsidian Flow",
  reference: "de3308e7 · 10.03s · dark field, rim-lit cells",
  durationInFrames: seconds(10.034),

  background: "#070203",
  fogColor: "#0b0304",
  fogDensity: 0.053,

  cellColor: "#e01c22",
  cellColorSpread: 0.16,
  cellEmissive: "#3a0407",
  cellEmissiveIntensity: 0.5,
  specular: "#ffb9a8",
  shininess: 46,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.85,

  cellCount: 1150,
  heroCount: 12,
  cellSize: [0.3, 1.0],
  cellMargin: 0.28,
  cameraClearance: 1.4,

  fov: 46,
  depth: 34,
  nearZ: 2.5,
  fill: 1.25,

  flowDirection: [0, 0, 1],
  flowSpeed: 1.6,
  tumble: 0.34,

  backdrop: { color: "#1a0406", emissive: "#120203", emissiveIntensity: 0.5, mottle: 0.5, repeat: [2, 2] },
  coreGlow: { color: "#48070b", size: 30, aspect: 1.6, opacity: 0.3, offset: [0, 0], inset: 3, pulse: 0.1 },
  motes: { count: 70, color: "#ff8a7a", size: [0.02, 0.06], opacity: 0.3, softness: 0.25 },

  lights: [
    { kind: "ambient", color: "#2a0507", intensity: 0.5 },
    { kind: "point", color: "#ffd9c8", intensity: 420, position: [7, 9, 4], distance: 70, decay: 2 },
    { kind: "point", color: "#ff5a48", intensity: 240, position: [-9, -5, -6], distance: 65, decay: 2 },
    { kind: "directional", color: "#ff3d33", intensity: 0.55, position: [0, 0, -12] },
  ],

  cameraDrift: 0.5,
  cameraRoll: 1.4,
  cameraDolly: 0.15,

  grade: {
    bloom: { color: "#5e0a10", opacity: 0.26, width: 66, height: 52, x: 50, y: 48 },
    vignette: { color: "#000000", opacity: 0.66, start: 38 },
    tint: { color: "#2a0206", opacity: 0.14, blend: "multiply" },
    grain: 0.05,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V2 — cells cross left to right; a low horizontal glow sunk into the background. */
const vesselCore: BloodLook = {
  id: "V2-VesselCore",
  label: "Vessel Core",
  reference: "022d81ce · 18.53s · horizontal flow, minimal blended light",
  durationInFrames: seconds(18.534),

  background: "#2e0507",
  fogColor: "#7c0d12",
  fogDensity: 0.058,

  cellColor: "#c8161c",
  cellColorSpread: 0.2,
  cellEmissive: "#5c0509",
  cellEmissiveIntensity: 0.55,
  specular: "#ff9f8c",
  shininess: 38,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.7,

  cellCount: 1200,
  heroCount: 12,
  cellSize: [0.3, 1.0],
  cellMargin: 0.28,
  cameraClearance: 1.6,

  fov: 56,
  depth: 30,
  nearZ: 2.5,
  fill: 1.28,

  // Straight across the frame, left to right.
  flowDirection: [1, 0, 0],
  flowSpeed: 2.9,
  tumble: 0.42,

  backdrop: { color: "#8e1016", emissive: "#3d0508", emissiveIntensity: 0.5, mottle: 0.55, repeat: [2, 2] },
  // A wide, dim band tinted to the fog rather than a bright white core: the
  // light is meant to sit inside the background, not on top of it.
  coreGlow: { color: "#b8484a", size: 16, aspect: 5.5, opacity: 0.22, offset: [0, -0.04], inset: 4, pulse: 0.05 },
  motes: { count: 110, color: "#ffd8c8", size: [0.02, 0.055], opacity: 0.32, softness: 0.22 },

  lights: [
    { kind: "ambient", color: "#5a0a0e", intensity: 0.9 },
    { kind: "point", color: "#ffb9a4", intensity: 320, position: [6, 7, 2], distance: 55, decay: 2 },
    { kind: "point", color: "#c01018", intensity: 180, position: [-7, -6, -10], distance: 55, decay: 2 },
    { kind: "directional", color: "#ff7c68", intensity: 0.45, position: [-4, 2, 6] },
  ],

  cameraDrift: 0.35,
  // Near-zero roll, so the crossing motion stays level on screen.
  cameraRoll: 0.25,
  cameraDolly: 0,

  grade: {
    // Wide and shallow, matching the horizontal band in the scene.
    bloom: { color: "#e07a6a", opacity: 0.2, width: 92, height: 22, x: 50, y: 49 },
    vignette: { color: "#3d0508", opacity: 0.72, start: 36 },
    tint: { color: "#b3141a", opacity: 0.12, blend: "soft-light" },
    grain: 0.045,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V3 — white light in the upper-left corner; the cells stream out of it. */
const crimsonGold: BloodLook = {
  id: "V3-CrimsonGold",
  label: "Crimson & Gold",
  reference: "be5b4ffd · 18.04s · crimson field, gold-speckled cells",
  durationInFrames: seconds(18.04),

  background: "#b00f18",
  fogColor: "#c2121c",
  fogDensity: 0.055,

  cellColor: "#c41019",
  cellColorSpread: 0.14,
  cellEmissive: "#7a0a10",
  cellEmissiveIntensity: 0.5,
  specular: "#ffd9a8",
  shininess: 44,
  speckle: 0.32,
  speckleColor: "#f0a93c",
  translucency: 0.45,

  cellCount: 1100,
  heroCount: 12,
  cellSize: [0.3, 1.0],
  cellMargin: 0.28,
  cameraClearance: 1.6,

  fov: 50,
  depth: 34,
  nearZ: 2.5,
  fill: 1.3,

  // Out of the upper-left light: rightwards, downwards and toward the lens.
  flowDirection: [0.52, -0.4, 0.76],
  flowSpeed: 2.2,
  tumble: 0.4,

  backdrop: { color: "#b81018", emissive: "#8c0c14", emissiveIntensity: 0.75, mottle: 0.3, repeat: [2, 2] },
  // The one bright light in the set, parked in the upper-left corner.
  coreGlow: { color: "#ffffff", size: 22, aspect: 1.15, opacity: 0.92, offset: [-0.6, 0.47], inset: 4, pulse: 0.08 },
  motes: { count: 240, color: "#ffcf7a", size: [0.025, 0.08], opacity: 0.5, softness: 0.3 },

  lights: [
    { kind: "ambient", color: "#8e0c14", intensity: 1.1 },
    // Key light from the upper left, matching the glow's corner.
    { kind: "point", color: "#fff0d8", intensity: 520, position: [-13, 10, -14], distance: 70, decay: 2 },
    { kind: "point", color: "#ff5a4a", intensity: 200, position: [9, -7, -6], distance: 55, decay: 2 },
    { kind: "directional", color: "#ffb36b", intensity: 0.45, position: [-6, 5, 6] },
  ],

  cameraDrift: 0.45,
  cameraRoll: 1.2,
  cameraDolly: 0.12,

  grade: {
    bloom: { color: "#ffd9c0", opacity: 0.4, width: 58, height: 58, x: 19, y: 25 },
    vignette: { color: "#6b0209", opacity: 0.6, start: 42 },
    tint: { color: "#ff2b1f", opacity: 0.16, blend: "overlay" },
    grain: 0.05,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V4 — cells hold position and turn slowly against a dark red field. */
const luminous: BloodLook = {
  id: "V4-Luminous",
  label: "Slow Turn",
  reference: "89469653 · 19.63s · cells turning in place, dark red field",
  durationInFrames: seconds(19.634),

  background: "#3a0709",
  fogColor: "#4e0a0d",
  fogDensity: 0.058,

  cellColor: "#b8141c",
  cellColorSpread: 0.22,
  cellEmissive: "#5a080d",
  cellEmissiveIntensity: 0.5,
  specular: "#ffb3a4",
  shininess: 32,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.8,

  cellCount: 620,
  heroCount: 12,
  cellSize: [0.4, 1.3],
  cellMargin: 0.32,
  cameraClearance: 2.2,

  fov: 52,
  depth: 30,
  nearZ: 2.5,
  fill: 1.25,

  // Almost stationary: the motion is the turn, not the travel.
  flowDirection: [0, 0, 1],
  flowSpeed: 0.12,
  tumble: 0.3,

  backdrop: { color: "#5e0c10", emissive: "#3a0608", emissiveIntensity: 0.55, mottle: 0.45, repeat: [2, 2] },
  coreGlow: { color: "#7a1418", size: 30, aspect: 1.4, opacity: 0.3, offset: [0, 0], inset: 4, pulse: 0.07 },
  motes: { count: 70, color: "#ffbcac", size: [0.02, 0.055], opacity: 0.22, softness: 0.25 },

  lights: [
    { kind: "ambient", color: "#5a1014", intensity: 0.75 },
    { kind: "point", color: "#ffc4b0", intensity: 380, position: [8, 8, 4], distance: 55, decay: 2 },
    { kind: "point", color: "#c4303a", intensity: 190, position: [-9, -6, -8], distance: 55, decay: 2 },
    { kind: "directional", color: "#e0564c", intensity: 0.4, position: [-2, 4, 8] },
  ],

  // With the cells holding still, the camera carries what movement there is.
  cameraDrift: 0.85,
  cameraRoll: 1.8,
  cameraDolly: 0.4,

  grade: {
    bloom: { color: "#8c1a1e", opacity: 0.24, width: 70, height: 58, x: 50, y: 48 },
    vignette: { color: "#200405", opacity: 0.74, start: 34 },
    tint: { color: "#5e0c10", opacity: 0.16, blend: "multiply" },
    grain: 0.045,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V5 — wide deep field, many small cells, background light sunk into the field. */
const deepField: BloodLook = {
  id: "V5-DeepField",
  label: "Deep Field",
  reference: "8f4c18de · 17.05s colour (+17.05s matte) · wide field, many small cells",
  durationInFrames: seconds(17.045),

  background: "#5c0a0a",
  fogColor: "#7a1010",
  fogDensity: 0.058,

  cellColor: "#c9161c",
  cellColorSpread: 0.18,
  cellEmissive: "#5e080c",
  cellEmissiveIntensity: 0.45,
  specular: "#ff9a86",
  shininess: 28,
  speckle: 0,
  speckleColor: "#ffb36b",
  translucency: 0.55,

  cellCount: 1800,
  heroCount: 10,
  cellSize: [0.26, 0.72],
  cellMargin: 0.18,
  cameraClearance: 3.4,

  fov: 62,
  depth: 30,
  nearZ: 2.5,
  fill: 1.28,

  flowDirection: [0, 0, 1],
  flowSpeed: 1.5,
  tumble: 0.42,

  backdrop: { color: "#7a0c0e", emissive: "#4e0608", emissiveIntensity: 0.5, mottle: 0.45, repeat: [2, 2] },
  // Tinted to the fog and held low, so it reads as the field brightening
  // rather than as a lamp sitting in front of it.
  coreGlow: { color: "#96201f", size: 34, aspect: 1.5, opacity: 0.26, offset: [0, 0], inset: 4, pulse: 0.05 },
  motes: { count: 80, color: "#ff9d8a", size: [0.015, 0.045], opacity: 0.22, softness: 0.2 },

  lights: [
    { kind: "ambient", color: "#8a1014", intensity: 1.2 },
    { kind: "directional", color: "#ffb0a0", intensity: 1.1, position: [4, 8, 10] },
    { kind: "point", color: "#ff6a58", intensity: 300, position: [-10, -6, -14], distance: 70, decay: 2 },
  ],

  cameraDrift: 0.4,
  cameraRoll: 1,
  // Zero: a moving camera would make one speed look like several.
  cameraDolly: 0,

  grade: {
    bloom: { color: "#8c0f14", opacity: 0.2, width: 78, height: 66, x: 50, y: 50 },
    vignette: { color: "#3a0405", opacity: 0.42, start: 50 },
    tint: { color: "#a01016", opacity: 0.14, blend: "multiply" },
    grain: 0.04,
    fadeIn: 0,
    fadeOut: 0,
  },
};

/** V6 — cells cross right to left through a muted ember field. */
const emberBokeh: BloodLook = {
  id: "V6-EmberBokeh",
  label: "Ember Drift",
  reference: "617f6ddf · 10.01s · muted brown-red, right-to-left flow",
  durationInFrames: seconds(10.008),

  background: "#3a1512",
  fogColor: "#6b2a22",
  fogDensity: 0.056,

  cellColor: "#a33a2e",
  cellColorSpread: 0.2,
  cellEmissive: "#43110c",
  cellEmissiveIntensity: 0.4,
  specular: "#ffcbb0",
  shininess: 60,
  speckle: 0.25,
  speckleColor: "#ffd9a0",
  translucency: 0.6,

  cellCount: 900,
  heroCount: 12,
  cellSize: [0.3, 1.0],
  cellMargin: 0.28,
  cameraClearance: 1.6,

  fov: 44,
  depth: 32,
  nearZ: 2.5,
  fill: 1.3,

  // Straight across the frame, right to left.
  flowDirection: [-1, 0, 0],
  flowSpeed: 2.3,
  tumble: 0.36,

  backdrop: { color: "#5e2019", emissive: "#2e0c08", emissiveIntensity: 0.5, mottle: 0.5, repeat: [2, 2] },
  coreGlow: { color: "#8a3a28", size: 26, aspect: 2.2, opacity: 0.2, offset: [0, 0], inset: 4, pulse: 0.07 },
  // Crisp sparkle, not defocused discs.
  motes: { count: 320, color: "#ffd2a8", size: [0.022, 0.07], opacity: 0.5, softness: 0.3 },

  lights: [
    { kind: "ambient", color: "#4a1a14", intensity: 0.9 },
    { kind: "point", color: "#ffd0ae", intensity: 340, position: [6, 8, 5], distance: 55, decay: 2 },
    { kind: "point", color: "#c4503a", intensity: 170, position: [-8, -6, -9], distance: 55, decay: 2 },
    { kind: "directional", color: "#e07a58", intensity: 0.4, position: [0, -4, -10] },
  ],

  cameraDrift: 0.35,
  cameraRoll: 0.25,
  cameraDolly: 0,

  grade: {
    bloom: { color: "#b5613f", opacity: 0.26, width: 84, height: 44, x: 48, y: 50 },
    vignette: { color: "#180705", opacity: 0.78, start: 32 },
    tint: { color: "#7a2c1e", opacity: 0.2, blend: "soft-light" },
    grain: 0.06,
    fadeIn: 0,
    fadeOut: 0,
  },
};

export const LOOKS = [obsidian, vesselCore, crimsonGold, luminous, deepField, emberBokeh];

export const LOOKS_BY_ID: Record<string, BloodLook> = Object.fromEntries(
  LOOKS.map((look) => [look.id, look]),
);
