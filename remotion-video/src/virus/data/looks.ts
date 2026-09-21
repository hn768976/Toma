// The ten looks.
//
// This file is pure data. Adding an eleventh look means adding one row here and
// nothing else — the rig reads these fields and has no per-look branches.
//
// Colours were sampled from frames of the reference clips rather than written
// from the brief, so a few differ from the prose description; the deviations
// are noted inline.

import type { LookSpec } from "./types";

/** Shared defaults. A row overrides only what makes it different. */
const base = {
  heroIndex: 22,
  core: {
    detail: 4,
    displace: 0.03,
    displaceFreq: 2.2,
    mottleFreq: 4,
    mottleDark: 0.82,
    mottleLight: 1.12,
    mottleContrast: 1.4,
    roughness: 0.72,
    metalness: 0.0,
  },
  spike: {
    scale: 1,
    stalkScale: 1,
    capScale: 1,
    roughness: 0.68,
    metalness: 0.0,
  },
} as const;

export const LOOKS: LookSpec[] = [
  // 1 -------------------------------------------------------------- Pale Mint
  {
    ...base,
    id: "PaleMint",
    name: "Pale Mint",
    seed: 0x1a3c_0001,
    background: {
      kind: "radial",
      inner: "#e9f5ee",
      outer: "#8cc4a8",
      centre: [0.52, 0.55],
      falloff: 1.25,
      dither: 1.2,
    },
    specks: {
      count: 220,
      colour: "#ffffff",
      sizeRange: [0.03, 0.12],
      opacity: 0.4,
    },
    particles: {
      count: 42,
      radiusRange: [0.42, 1.9],
      depthRange: [-20, 3.5],
      spread: 1.12,
      // Dense and thin: the reference reads as fur at distance.
      spikeCount: [74, 88],
    },
    heroIndex: 24,
    core: { ...base.core, displace: 0.035, mottleFreq: 5, roughness: 0.66 },
    spike: { ...base.spike, archetype: "stalk-knob", scale: 1.15, roughness: 0.6 },
    colorways: [{ core: "#1f9350", stalk: "#2fb463", cap: "#3cc470" }],
    lighting: {
      ambient: 0.62,
      keyColour: "#ffffff",
      keyIntensity: 3.2,
      keyPosition: [-6, 7, 9],
      fillColour: "#cfe8da",
      fillIntensity: 0.6,
      fillPosition: [7, -3, 5],
      rimColour: "#ffffff",
      rimIntensity: 0.3,
      rimPosition: [0, 4, -8],
    },
    post: {
      focusDistance: 0,
      focusRange: 6.5,
      bokehScale: 4.0,
      bloomIntensity: 0.12,
      bloomThreshold: 0.92,
      grain: 0.016,
    },
    stillFrames: [80, 260, 470],
  },

  // 2 --------------------------------------------------------------- Lime Sun
  {
    ...base,
    id: "LimeSun",
    name: "Lime Sun",
    seed: 0x1a3c_0002,
    background: {
      kind: "radial",
      inner: "#c2d7e0",
      outer: "#93b2c2",
      centre: [0.5, 0.62],
      falloff: 1.3,
      dither: 1.2,
    },
    flare: {
      at: [0.47, 0.72],
      radius: 0.24,
      intensity: 0.7,
      colour: "#fff6e0",
      streak: 2.2,
    },
    specks: {
      count: 260,
      colour: "#ffffff",
      sizeRange: [0.025, 0.09],
      opacity: 0.45,
    },
    particles: {
      count: 40,
      radiusRange: [0.34, 1.35],
      depthRange: [-19, 0.5],
      spread: 1.15,
      // Very dense, and the clusters are scaled up: in the reference the core
      // is almost entirely buried under the floret layer.
      spikeCount: [68, 84],
    },
    heroIndex: 20,
    core: { ...base.core, displace: 0.04, mottleFreq: 6, mottleContrast: 1.8 },
    spike: { ...base.spike, archetype: "cluster", scale: 1.8, roughness: 0.78 },
    colorways: [
      { core: "#93a82c", stalk: "#7d9626", cap: "#b3c93c", weight: 3 },
      { core: "#a8bd34", stalk: "#6f8a22", cap: "#c6d84a", weight: 2 },
    ],
    lighting: {
      ambient: 1.2,
      keyColour: "#fff4dc",
      keyIntensity: 2.4,
      // High and slightly right, matching the flare position.
      keyPosition: [4, 8, 7],
      fillColour: "#cfe0e8",
      fillIntensity: 0.7,
      fillPosition: [-6, -2, 5],
      rimColour: "#ffffff",
      rimIntensity: 0.35,
      rimPosition: [0, 3, -8],
    },
    post: {
      focusDistance: 0,
      focusRange: 6,
      bokehScale: 4.5,
      bloomIntensity: 0.35,
      bloomThreshold: 0.78,
      grain: 0.016,
    },
    stillFrames: [110, 300, 500],
  },

  // 3 ----------------------------------------------------------- Pastel Multi
  {
    ...base,
    id: "PastelMulti",
    name: "Pastel Multi",
    seed: 0x1a3c_0003,
    background: {
      kind: "radial",
      inner: "#b9cddb",
      outer: "#8098ae",
      centre: [0.44, 0.62],
      falloff: 1.35,
      dither: 1.4,
    },
    specks: {
      count: 180,
      colour: "#ffffff",
      sizeRange: [0.03, 0.1],
      opacity: 0.32,
    },
    particles: {
      count: 38,
      radiusRange: [0.42, 1.7],
      depthRange: [-18, 3.5],
      spread: 1.18,
      spikeCount: [62, 76],
    },
    heroIndex: 19,
    core: { ...base.core, displace: 0.03, mottleFreq: 5, mottleContrast: 1.2 },
    // The brief calls for mushroom caps here, but the reference clearly shows
    // clumped florets, so the field follows the reference.
    spike: { ...base.spike, archetype: "cluster", scale: 1.45, roughness: 0.75 },
    colorways: [
      { core: "#a9c47c", stalk: "#8f74ad", cap: "#9d80bb", weight: 3 },
      { core: "#8aa6c6", stalk: "#94a856", cap: "#a6bb63", weight: 2 },
      { core: "#7fb3a8", stalk: "#bd8496", cap: "#cc93a4", weight: 2 },
      { core: "#c3a2ab", stalk: "#8b9cae", cap: "#98a9ba", weight: 2 },
      { core: "#c6b393", stalk: "#b08a8d", cap: "#bd9699", weight: 1 },
    ],
    lighting: {
      ambient: 1.3,
      keyColour: "#ffffff",
      keyIntensity: 1.9,
      keyPosition: [-5, 7, 8],
      fillColour: "#cfdce8",
      fillIntensity: 0.9,
      fillPosition: [6, -3, 4],
      rimColour: "#ffffff",
      rimIntensity: 0.3,
      rimPosition: [0, 3, -8],
    },
    post: {
      focusDistance: 0,
      // The softest of the ten: a thin focus band and heavy bokeh.
      focusRange: 4.2,
      bokehScale: 7.0,
      bloomIntensity: 0.22,
      bloomThreshold: 0.85,
      grain: 0.017,
    },
    stillFrames: [95, 285, 460],
  },

  // 4 -------------------------------------------------------------- Deep Navy
  {
    ...base,
    id: "DeepNavy",
    name: "Deep Navy",
    seed: 0x1a3c_0004,
    background: {
      kind: "radial",
      inner: "#2b3566",
      outer: "#141935",
      centre: [0.5, 0.66],
      falloff: 1.2,
      // Dark gradients band worst; this one gets the most dither.
      dither: 2.0,
    },
    particles: {
      count: 34,
      radiusRange: [0.4, 1.5],
      depthRange: [-24, 1.5],
      spread: 1.15,
      // Sparse enough that the core stays clearly visible.
      spikeCount: [42, 52],
    },
    heroIndex: 18,
    core: { ...base.core, displace: 0.045, displaceFreq: 2.6, mottleFreq: 5, mottleContrast: 1.6 },
    spike: { ...base.spike, archetype: "stalk-knob", scale: 1.15, capScale: 1.35, roughness: 0.62 },
    colorways: [
      { core: "#8e2b33", stalk: "#c23a44", cap: "#8f74d6", weight: 3 },
      { core: "#7a2530", stalk: "#b03540", cap: "#9d84e0", weight: 2 },
    ],
    lighting: {
      ambient: 0.35,
      keyColour: "#ffe8e0",
      keyIntensity: 2.6,
      keyPosition: [-6, 7, 8],
      fillColour: "#4a5a9c",
      fillIntensity: 0.8,
      fillPosition: [7, -3, 4],
      rimColour: "#6f7fd6",
      rimIntensity: 1.3,
      rimPosition: [-2, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 5,
      bokehScale: 6.0,
      bloomIntensity: 0.3,
      bloomThreshold: 0.72,
      grain: 0.016,
    },
    stillFrames: [70, 250, 480],
  },

  // 5 ---------------------------------------------------------- Electric Blue
  {
    ...base,
    id: "ElectricBlue",
    name: "Electric Blue",
    seed: 0x1a3c_0005,
    background: {
      kind: "radial",
      inner: "#2a4ad8",
      outer: "#0d1c86",
      centre: [0.5, 0.55],
      falloff: 1.15,
      dither: 1.8,
    },
    specks: {
      count: 300,
      colour: "#dce8ff",
      sizeRange: [0.02, 0.06],
      opacity: 0.55,
    },
    particles: {
      count: 24,
      radiusRange: [0.45, 1.6],
      depthRange: [-20, 2],
      spread: 1.12,
      spikeCount: [44, 56],
    },
    heroIndex: 17,
    core: {
      ...base.core,
      displace: 0.05,
      displaceFreq: 2.0,
      // Low frequency and a very wide ramp: this is what marbles the core
      // black-to-white rather than merely speckling it.
      mottleFreq: 1.5,
      mottleDark: 0.01,
      mottleLight: 1.55,
      mottleContrast: 2.2,
      roughness: 0.55,
    },
    spike: { ...base.spike, archetype: "trumpet", scale: 1.3, roughness: 0.55 },
    colorways: [{ core: "#c8ccd2", stalk: "#e8501f", cap: "#f4592e" }],
    lighting: {
      ambient: 0.42,
      keyColour: "#ffffff",
      keyIntensity: 3.1,
      keyPosition: [-5, 7, 9],
      fillColour: "#6f8fe8",
      fillIntensity: 0.55,
      fillPosition: [7, -2, 4],
      rimColour: "#9fb8ff",
      rimIntensity: 0.9,
      rimPosition: [0, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 5.5,
      bokehScale: 5.0,
      bloomIntensity: 0.04,
      bloomThreshold: 0.97,
      grain: 0.018,
    },
    stillFrames: [100, 290, 470],
  },

  // 6 ------------------------------------------------------------ Blood Field
  {
    ...base,
    id: "BloodField",
    name: "Blood Field",
    seed: 0x1a3c_0006,
    background: {
      kind: "radial",
      inner: "#96100f",
      outer: "#050102",
      // Red concentrated centre-left, falling to black at the corners.
      centre: [0.42, 0.5],
      falloff: 1.3,
      dither: 2.2,
    },
    particles: {
      // Dense and flat-packed: particles fill the frame edge to edge across
      // several depth layers, unlike the other nine.
      count: 104,
      radiusRange: [0.42, 1.2],
      depthRange: [-15, 1],
      spread: 1.32,
      spikeCount: [34, 44],
    },
    heroIndex: 44,
    core: {
      ...base.core,
      displace: 0.028,
      mottleFreq: 9,
      mottleDark: 0.68,
      mottleLight: 1.22,
      mottleContrast: 2.2,
      roughness: 0.78,
    },
    spike: { ...base.spike, archetype: "stub-cone", scale: 2.25, roughness: 0.8 },
    colorways: [
      { core: "#c6ccd1", stalk: "#6b1014", cap: "#6b1014", weight: 3 },
      { core: "#b8bfc6", stalk: "#5c0d11", cap: "#5c0d11", weight: 2 },
    ],
    lighting: {
      ambient: 0.4,
      keyColour: "#fff0ea",
      keyIntensity: 1.9,
      keyPosition: [-5, 6, 9],
      fillColour: "#a33a30",
      fillIntensity: 0.7,
      fillPosition: [6, -3, 5],
      rimColour: "#d24030",
      rimIntensity: 0.8,
      rimPosition: [0, 2, -9],
    },
    post: {
      focusDistance: 0,
      // Only a middle band is sharp; everything else goes heavily soft.
      focusRange: 3.0,
      bokehScale: 8.0,
      bloomIntensity: 0.25,
      bloomThreshold: 0.75,
      grain: 0.017,
    },
    stillFrames: [85, 275, 455],
  },

  // 7 ------------------------------------------------------------- Black Cyan
  {
    ...base,
    id: "BlackCyan",
    name: "Black Cyan",
    seed: 0x1a3c_0007,
    background: {
      kind: "flat",
      inner: "#000000",
      outer: "#000000",
      // No dither. This look's black has to encode as true 0,0,0, and a
      // +/-1/255 dither would lift it. There is no gradient here to band.
      dither: 0,
    },
    particles: {
      count: 26,
      radiusRange: [0.38, 1.9],
      depthRange: [-22, 2],
      spread: 1.12,
      spikeCount: [40, 50],
    },
    heroIndex: 16,
    core: { ...base.core, displace: 0.022, mottleFreq: 2.6, mottleDark: 0.62, mottleLight: 1.2 },
    spike: { ...base.spike, archetype: "stalk-teardrop", scale: 1.35, roughness: 0.5 },
    colorways: [
      { core: "#1f9ad6", stalk: "#c3b2cc", cap: "#e8261e", weight: 3 },
      { core: "#2aa6e2", stalk: "#cdbcd6", cap: "#e02b20", weight: 2 },
    ],
    lighting: {
      ambient: 0.22,
      keyColour: "#ffffff",
      keyIntensity: 3.0,
      keyPosition: [-5, 6, 9],
      fillColour: "#2f6f9c",
      fillIntensity: 0.6,
      fillPosition: [7, -3, 4],
      rimColour: "#4fb0e0",
      rimIntensity: 1.1,
      rimPosition: [-1, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 5.5,
      bokehScale: 5.0,
      // Threshold kept high so bloom cannot bleed into the corners and lift
      // them off zero.
      bloomIntensity: 0.18,
      bloomThreshold: 0.93,
      // Grain is off for the same reason as the dither.
      grain: 0,
    },
    stillFrames: [90, 280, 465],
  },

  // 8 ------------------------------------------------------------- Bokeh Dark
  {
    ...base,
    id: "BokehDark",
    name: "Bokeh Dark",
    seed: 0x1a3c_0008,
    background: {
      kind: "radial",
      inner: "#140c0c",
      outer: "#030202",
      centre: [0.5, 0.5],
      falloff: 1.1,
      dither: 2.0,
    },
    bokeh: {
      count: 34,
      colours: ["#a8290f", "#7d1c0c", "#c04428", "#2a2e34", "#4a2820"],
      sizeRange: [2.2, 7.0],
      opacity: 0.4,
    },
    specks: {
      count: 200,
      colour: "#d8cfc4",
      sizeRange: [0.02, 0.07],
      opacity: 0.4,
    },
    particles: {
      count: 30,
      radiusRange: [0.38, 1.45],
      depthRange: [-19, 2],
      spread: 1.1,
      spikeCount: [46, 58],
    },
    heroIndex: 17,
    core: {
      ...base.core,
      // Rough and stony: strong displacement, high-frequency mottle.
      displace: 0.055,
      displaceFreq: 3.2,
      mottleFreq: 8,
      mottleDark: 0.62,
      mottleLight: 1.28,
      mottleContrast: 2.0,
      roughness: 0.85,
    },
    spike: { ...base.spike, archetype: "cluster", scale: 1.5, roughness: 0.6 },
    colorways: [
      { core: "#77879a", stalk: "#a8242f", cap: "#b52836", weight: 3 },
      { core: "#6a7a8c", stalk: "#94202a", cap: "#a3242f", weight: 2 },
    ],
    capAccent: { colour: "#8d7f28", fraction: 0.03 },
    lighting: {
      ambient: 0.4,
      keyColour: "#fff2e8",
      keyIntensity: 2.7,
      keyPosition: [-6, 6, 8],
      fillColour: "#3f5266",
      fillIntensity: 0.7,
      fillPosition: [7, -2, 4],
      rimColour: "#c4664a",
      rimIntensity: 1.0,
      rimPosition: [0, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 3.2,
      bokehScale: 7.5,
      bloomIntensity: 0.28,
      bloomThreshold: 0.8,
      grain: 0.016,
    },
    stillFrames: [105, 295, 475],
  },

  // 9 -------------------------------------------------------------- Glow Blue
  {
    ...base,
    id: "GlowBlue",
    name: "Glow Blue",
    seed: 0x1a3c_0009,
    background: {
      // Dark charcoal, deliberately not black.
      kind: "radial",
      inner: "#232a35",
      outer: "#12151b",
      centre: [0.5, 0.55],
      falloff: 1.2,
      dither: 2.0,
    },
    specks: {
      count: 150,
      colour: "#c8d8ec",
      sizeRange: [0.02, 0.06],
      opacity: 0.35,
    },
    particles: {
      count: 20,
      radiusRange: [0.45, 1.7],
      depthRange: [-18, 1.5],
      spread: 1.08,
      spikeCount: [46, 58],
    },
    heroIndex: 14,
    core: { ...base.core, displace: 0.018, mottleFreq: 3.5, mottleDark: 0.86, mottleLight: 1.14, roughness: 0.5 },
    // Stubby: the stalk is scaled almost out of existence.
    spike: { ...base.spike, archetype: "trumpet", scale: 2.0, stalkScale: 0.22, capScale: 1.15, roughness: 0.65 },
    colorways: [{ core: "#a9c9ea", stalk: "#8e2020", cap: "#93221f" }],
    rimGlow: { colour: "#2f7ed4", size: 2.4, intensity: 1.3 },
    lighting: {
      ambient: 0.55,
      keyColour: "#ffffff",
      keyIntensity: 2.4,
      keyPosition: [-5, 6, 9],
      fillColour: "#3f5f8c",
      fillIntensity: 0.7,
      fillPosition: [6, -3, 4],
      rimColour: "#5f8fd6",
      rimIntensity: 1.2,
      rimPosition: [0, 3, -9],
    },
    post: {
      focusDistance: 0,
      focusRange: 4.5,
      bokehScale: 6.5,
      // Bloom is here to carry the rim glow, not the whole frame.
      bloomIntensity: 0.55,
      bloomThreshold: 0.6,
      grain: 0.016,
    },
    stillFrames: [75, 265, 450],
  },

  // 10 --------------------------------------------------------- Amber Horizon
  {
    ...base,
    id: "AmberHorizon",
    name: "Amber Horizon",
    seed: 0x1a3c_000a,
    background: {
      kind: "vertical",
      inner: "#d08a2e",
      mid: "#4a3528",
      midStop: 0.42,
      outer: "#111d38",
      dither: 2.0,
    },
    specks: {
      count: 220,
      colour: "#b8c8e0",
      sizeRange: [0.02, 0.07],
      opacity: 0.4,
      // Fine specks only in the lower blue region.
      yBand: [0.0, 0.45],
    },
    particles: {
      count: 34,
      radiusRange: [0.4, 1.5],
      depthRange: [-19, 2],
      spread: 1.12,
      spikeCount: [66, 80],
    },
    heroIndex: 18,
    core: {
      ...base.core,
      // Chalky: fine pitting, low-contrast speckle.
      displace: 0.032,
      displaceFreq: 3.0,
      mottleFreq: 9,
      mottleDark: 0.8,
      mottleLight: 1.14,
      mottleContrast: 1.8,
      roughness: 0.9,
    },
    spike: { ...base.spike, archetype: "cluster", scale: 1.4, roughness: 0.7 },
    colorways: [{ core: "#e2ded2", stalk: "#b8493f", cap: "#c65a4c" }],
    capAccent: { colour: "#6d7c38", fraction: 0.12 },
    lighting: {
      ambient: 0.7,
      keyColour: "#ffd9a0",
      keyIntensity: 2.6,
      // Behind the upper edge.
      keyPosition: [1, 9, -3],
      fillColour: "#5f7099",
      fillIntensity: 0.85,
      fillPosition: [-5, -3, 6],
      rimColour: "#ffb066",
      rimIntensity: 1.0,
      rimPosition: [3, 5, -8],
    },
    post: {
      focusDistance: 0,
      focusRange: 4.0,
      bokehScale: 7.0,
      bloomIntensity: 0.3,
      bloomThreshold: 0.75,
      grain: 0.016,
    },
    stillFrames: [88, 282, 468],
  },
];

export const LOOK_BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l]));
