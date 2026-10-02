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
};

export const DUST_VERSIONS: DustVersion[] = [
  { id: "DustSmoke-Sepia", bg: "#2A2116", bgLight: "#4A3B26", speck: "#D8C49A", beam: 1, smoke: 0, smokeColor: "#000000", vignette: 0.55, grain: 0.02, speckGain: 1 },
  { id: "DustSmoke-Teal", bg: "#0F2A28", bgLight: "#1B3E3A", speck: "#9FD8CC", beam: 0.8, smoke: 1, smokeColor: "#5E8C86", vignette: 0.5, grain: 0.02, speckGain: 1 },
  // Pure black 0,0,0 background for Screen/Add blending over footage: no beam, no vignette, no grain.
  { id: "DustSmoke-WhiteOnBlack", bg: "#000000", bgLight: "#000000", speck: "#FFFFFF", beam: 0, smoke: 0, smokeColor: "#000000", vignette: 0, grain: 0, speckGain: 1 },
];
