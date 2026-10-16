// One data row per version. To add a colourway, copy a row, give it a new id and
// change the colours; Root.tsx registers every row automatically.

export type Hex = `#${string}`;

export type HazardVersion = {
  look: "hazard";
  id: string;
  symbol: "radiation" | "biohazard";
  seed: number;
  symbol_color: Hex; // bright core of the symbol cells
  symbol_edge: Hex; // darker cells at the symbol's edges
  glow: Hex;
  bg: Hex; // dim background "text" cells
  bg_hot: Hex; // occasional hotter cells
  streak_a: Hex;
  streak_b: Hex;
  haze: Hex;
};

export type BrainVersion = {
  look: "brain";
  id: string;
  seed: number;
  holo: Hex; // brain hologram
  holo_rim: Hex;
  scan: Hex; // scanning band
  trace: Hex; // board traces and pulses
  link: Hex;
  board: Hex;
};

export type PhoneVersion = {
  look: "phone";
  id: string;
  seed: number;
  holo: Hex; // hologram line art and floor lights
  highlight: Hex; // secondary highlight
  bg: Hex;
  floor: Hex;
};

export type MapVersion = {
  look: "map";
  id: string;
  seed: number;
  land: Hex;
  panel: Hex;
  readout: Hex;
  bg: Hex;
};

export type HudVersion = {
  look: "hud";
  id: string;
  seed: number;
  widget: Hex;
  streak_a: Hex;
  streak_b: Hex;
  bg: Hex;
  accent: Hex;
};

export type Version = HazardVersion | BrainVersion | PhoneVersion | MapVersion | HudVersion;

export const VERSIONS: Version[] = [
  {
    look: "hazard", id: "HazardGlitch_Radiation", symbol: "radiation", seed: 11,
    symbol_color: "#D8F03A", symbol_edge: "#9AA818", glow: "#E8E040",
    bg: "#D88A2A", bg_hot: "#FF5A1E", streak_a: "#FF8A2A", streak_b: "#E83AC8", haze: "#7A2AB8",
  },
  {
    look: "hazard", id: "HazardGlitch_Biohazard", symbol: "biohazard", seed: 23,
    symbol_color: "#FF3A3A", symbol_edge: "#B01E1E", glow: "#FF5A2A",
    bg: "#A8501C", bg_hot: "#FF8A2A", streak_a: "#FF8A2A", streak_b: "#E83AC8", haze: "#7A2AB8",
  },
  {
    look: "brain", id: "BrainBoard_Blue", seed: 37,
    holo: "#5A8AFF", holo_rim: "#C8D8FF", scan: "#FFD890", trace: "#5A8AFF", link: "#9AB8FF", board: "#0A0E16",
  },
  {
    look: "phone", id: "PhoneHologram_Blue", seed: 41,
    holo: "#3AC8FF", highlight: "#8AE8FF", bg: "#04101C", floor: "#0A2A40",
  },
  {
    look: "phone", id: "PhoneHologram_Violet", seed: 43,
    holo: "#A87AFF", highlight: "#FF7AD8", bg: "#0A0618", floor: "#22143E",
  },
  {
    look: "map", id: "MapPanels_Blue", seed: 53,
    land: "#2A2AE8", panel: "#E8EEFF", readout: "#3AF0A0", bg: "#000006",
  },
  {
    look: "hud", id: "HUDFlythrough_Violet", seed: 67,
    widget: "#C8D8FF", streak_a: "#8A5AFF", streak_b: "#3A7AFF", bg: "#081030", accent: "#B48AFF",
  },
  {
    look: "hud", id: "HUDFlythrough_Cyan", seed: 71,
    widget: "#C8FFF8", streak_a: "#3AE8E8", streak_b: "#3AF08A", bg: "#06222A", accent: "#7AFFD8",
  },
];

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
};

/** sRGB hex -> linear rgb (for shaders that work in linear light). */
export const hexToLinear = (hex: string): [number, number, number] =>
  hexToRgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))) as [
    number,
    number,
    number,
  ];
