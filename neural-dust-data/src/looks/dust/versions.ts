// One row per version. Add a row to get a new composition.
export type DustVersion = {
  id: string;
  bg: string; // base background
  bgLight: string; // soft lighter area (top-left); same as bg for none
  speck: string; // speck colour
  beam: number; // light beam strength (0 = no beam)
  smoke: number; // smoke strength (0 = no smoke)
  smokeColor: string;
  vignette: number;
  grain: number; // 0 = no grain and no dither (pure black output)
  speckGain: number;
  /** specks fainter than this (8-bit alpha) are dropped; keeps true black gaps for 2C */
  minAlpha8: number;
};

export const DUST_VERSIONS: DustVersion[] = [
  { id: "DustSmoke-Sepia", bg: "#261B10", bgLight: "#42311B", speck: "#D8C49A", beam: 0.7, smoke: 0, smokeColor: "#000000", vignette: 0.32, grain: 0.02, speckGain: 0.62, minAlpha8: 0 },
  { id: "DustSmoke-Teal", bg: "#10252A", bgLight: "#162E31", speck: "#9FD8CC", beam: 0.4, smoke: 1, smokeColor: "#A6C6C8", vignette: 0.3, grain: 0.02, speckGain: 0.4, minAlpha8: 0 },
  // Pure black 0,0,0 background for Screen/Add blending over footage: no beam, no vignette, no grain.
  { id: "DustSmoke-WhiteOnBlack", bg: "#000000", bgLight: "#000000", speck: "#FFFFFF", beam: 0, smoke: 0, smokeColor: "#000000", vignette: 0, grain: 0, speckGain: 1, minAlpha8: 24 },
];
