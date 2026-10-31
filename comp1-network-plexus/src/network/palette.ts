export type RGB = [number, number, number];

export type NetworkPalette = {
  name: string;
  bgCenter: RGB;
  bgEdge: RGB;
  bgHaze: RGB;
  lineMain: RGB;
  lineAlt: RGB;
  lineAccent: RGB;
  nodeCore: RGB;
  nodeHalo: RGB;
  dotA: RGB;
  dotB: RGB;
  ring: RGB;
  panel: RGB;
  sparkle: RGB;
  dust: RGB;
};

/** Version 1 – matches the reference: deep teal-navy, steel-blue/lavender links, orange HUD. */
export const PALETTE_REFERENCE: NetworkPalette = {
  name: "reference",
  bgCenter: [0.058, 0.108, 0.142],
  bgEdge: [0.012, 0.028, 0.042],
  bgHaze: [0.06, 0.1, 0.15],
  lineMain: [0.42, 0.58, 0.95],
  lineAlt: [0.62, 0.55, 0.92],
  lineAccent: [1.0, 0.48, 0.16],
  nodeCore: [1.0, 0.96, 1.0],
  nodeHalo: [0.92, 0.6, 0.86],
  dotA: [0.45, 0.85, 1.0],
  dotB: [1.0, 0.56, 0.22],
  ring: [1.0, 0.42, 0.1],
  panel: [0.45, 0.66, 1.0],
  sparkle: [1.0, 0.72, 0.9],
  dust: [0.55, 0.7, 0.85],
};

/** Version 2 – alternative palette: violet-black space, teal/cyan links, magenta HUD. */
export const PALETTE_ALT: NetworkPalette = {
  name: "alt",
  bgCenter: [0.12, 0.05, 0.16],
  bgEdge: [0.03, 0.01, 0.045],
  bgHaze: [0.16, 0.06, 0.2],
  lineMain: [0.15, 0.95, 0.82],
  lineAlt: [0.35, 0.75, 1.0],
  lineAccent: [1.0, 0.18, 0.62],
  nodeCore: [0.92, 1.0, 0.98],
  nodeHalo: [0.3, 1.0, 0.85],
  dotA: [0.4, 1.0, 0.85],
  dotB: [1.0, 0.3, 0.7],
  ring: [1.0, 0.16, 0.58],
  panel: [0.35, 1.0, 0.8],
  sparkle: [0.6, 1.0, 0.92],
  dust: [0.6, 0.5, 0.9],
};
