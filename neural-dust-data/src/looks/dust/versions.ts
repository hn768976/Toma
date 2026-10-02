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
  { id: "DustSmoke-Sepia", bg: "#2B2213", bgLight: "#47391F", speck: "#D8C49A", beam: 1, smoke: 0, smokeColor: "#000000", vignette: 0.2, grain: 0.02, speckGain: 0.85 },
  { id: "DustSmoke-Teal", bg: "#122B28", bgLight: "#18332F", speck: "#9FD8CC", beam: 0.4, smoke: 1, smokeColor: "#9CC2BA", vignette: 0.15, grain: 0.02, speckGain: 0.5 },
  // Pure black 0,0,0 background for Screen/Add blending over footage: no beam, no vignette, no grain.
  { id: "DustSmoke-WhiteOnBlack", bg: "#000000", bgLight: "#000000", speck: "#FFFFFF", beam: 0, smoke: 0, smokeColor: "#000000", vignette: 0, grain: 0, speckGain: 1 },
];
