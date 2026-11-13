export type Palette = {
  name: string;
  /** background / fog */
  fog: string;
  skyTop: string;
  skyHorizon: string;
  /** PCB */
  boardBase: string;
  boardDetail: string;
  boardSheen: string;
  /** components */
  compDark: string;
  compMid: string;
  compLight: string;
  led: string;
  padRow: string;
  /** traces: colour near the chip and far from it, plus the unlit colour */
  traceNear: string;
  traceFar: string;
  traceIdle: string;
  /** chip / hologram */
  chipGlow: string;
  chipCore: string;
  holo: string;
  holoRim: string;
  rain: string;
  /** lights */
  ambientSky: string;
  ambientGround: string;
  key: string;
  /** final grade (multiplied in linear space) + saturation */
  tint: [number, number, number];
  saturation: number;
};

/** Reference look of the CPU clip: deep navy board, cyan/teal energy. */
export const NAVY_CYAN: Palette = {
  name: "navy-cyan",
  fog: "#061238",
  skyTop: "#020616",
  skyHorizon: "#10308c",
  boardBase: "#060f34",
  boardDetail: "#2a4cae",
  boardSheen: "#3f8fe8",
  compDark: "#03061a",
  compMid: "#0b1642",
  compLight: "#36549c",
  led: "#c9f4ff",
  padRow: "#35e0d0",
  traceNear: "#58fff0",
  traceFar: "#1d74ff",
  traceIdle: "#143c9c",
  chipGlow: "#39e6ff",
  chipCore: "#e6ffff",
  holo: "#7fdcff",
  holoRim: "#d6fbff",
  rain: "#a9c8ff",
  ambientSky: "#3a5cff",
  ambientGround: "#040820",
  key: "#7fb0ff",
  tint: [0.94, 1.0, 1.08],
  saturation: 0.9,
};

/** Reference look of the padlock clip: more saturated electric blue. */
export const ELECTRIC_BLUE: Palette = {
  ...NAVY_CYAN,
  name: "electric-blue",
  fog: "#041040",
  skyTop: "#01051a",
  skyHorizon: "#0a3aa8",
  boardBase: "#040d3c",
  boardDetail: "#1a44b0",
  boardSheen: "#2f86ff",
  compDark: "#030824",
  compMid: "#0b1c66",
  compLight: "#2f5fd8",
  padRow: "#2fe6c8",
  traceNear: "#4ff2ff",
  traceFar: "#1450ff",
  traceIdle: "#1034a8",
  chipGlow: "#2fd0ff",
  holo: "#86d8ff",
  holoRim: "#e2fbff",
  rain: "#9fc4ff",
  ambientSky: "#2a55ff",
  tint: [0.9, 0.99, 1.14],
  saturation: 1.0,
};

/** Alternative palette: graphite board, molten amber / gold energy. */
export const EMBER_GOLD: Palette = {
  name: "ember-gold",
  fog: "#1c0a05",
  skyTop: "#090302",
  skyHorizon: "#6e2408",
  boardBase: "#231009",
  boardDetail: "#8a3a14",
  boardSheen: "#ff9a4a",
  compDark: "#0f0705",
  compMid: "#3a1a0e",
  compLight: "#a8643a",
  led: "#fff0c8",
  padRow: "#ffb428",
  traceNear: "#ffd866",
  traceFar: "#ff4a12",
  traceIdle: "#7a2a10",
  chipGlow: "#ffa530",
  chipCore: "#fff6dc",
  holo: "#ffc070",
  holoRim: "#fff0d0",
  rain: "#ffcf9a",
  ambientSky: "#ff7a3a",
  ambientGround: "#140604",
  key: "#ffc08a",
  tint: [1.1, 0.99, 0.9],
  saturation: 1.06,
};
