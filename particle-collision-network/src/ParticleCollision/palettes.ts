export type RGB = [number, number, number];
export type Palette = {
  name: string;
  bgCenter: string;
  bgMid: string;
  bgEdge: string;
  bgAccent: string; // soft secondary tint (lower right)
  strand: RGB;
  strandWarm: RGB;
  halo: RGB;
  haloOuter: RGB;
  core: RGB;
  dust: RGB;
  wash: RGB;
};

/** Version 1 — matches the reference: navy/indigo space, silver-lavender plexus, molten-orange orbs. */
export const ORIGINAL: Palette = {
  name: "original",
  bgCenter: "#141b40",
  bgMid: "#090d22",
  bgEdge: "#020308",
  bgAccent: "rgba(60,32,80,0.28)",
  strand: [196, 205, 242],
  strandWarm: [255, 196, 160],
  halo: [255, 128, 66],
  haloOuter: [255, 84, 40],
  core: [255, 247, 236],
  dust: [165, 182, 255],
  wash: [255, 112, 62],
};

/** Version 2 — "Aurora": deep teal abyss, mint-cyan plexus, magenta/violet plasma orbs. */
export const AURORA: Palette = {
  name: "aurora",
  bgCenter: "#08323a",
  bgMid: "#051c23",
  bgEdge: "#010406",
  bgAccent: "rgba(18,80,70,0.28)",
  strand: [178, 255, 232],
  strandWarm: [255, 186, 236],
  halo: [255, 70, 178],
  haloOuter: [150, 60, 255],
  core: [255, 240, 252],
  dust: [130, 255, 214],
  wash: [210, 60, 190],
};
