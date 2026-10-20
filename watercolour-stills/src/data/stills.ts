import type { LayoutKey } from "../layouts";
import { LAYOUTS } from "../layouts";
import type { PaletteKey } from "./palettes";

export const OUTPUT_W = 6000;
export const OUTPUT_H = 3375;
/** paint canvas as a fraction of the output: 1 = paint at full 6000x3375; 0.5 = paint at 3000x1688 and Lanczos-upscale 2x */
export const PAINT_SCALE = 1;

export type StillRow = {
  n: number;
  layout: LayoutKey;
  palette: PaletteKey;
  seed: number;
  density?: number;
  paintScale?: number;
};

// One row per still. Each colourway has its own seed, so the two versions of
// a composition differ in shape as well as colour.
export const STILLS: StillRow[] = [
  { n: 1, layout: "bloomField", palette: "BlushPastel", seed: 1101 },
  { n: 1, layout: "bloomField", palette: "OceanBlues", seed: 1557 },
  { n: 2, layout: "cornerWashes", palette: "SageEucalyptus", seed: 2101 },
  { n: 2, layout: "cornerWashes", palette: "SunsetCoral", seed: 2557 },
  { n: 3, layout: "gradedSky", palette: "OceanBlues", seed: 3101 },
  { n: 3, layout: "gradedSky", palette: "LavenderDusk", seed: 3557 },
  { n: 4, layout: "horizontalBands", palette: "SoftRainbow", seed: 4101 },
  { n: 4, layout: "horizontalBands", palette: "TerracottaEarth", seed: 4557 },
  { n: 5, layout: "splatterDrips", palette: "IndigoNight", seed: 5101 },
  { n: 5, layout: "splatterDrips", palette: "SunsetCoral", seed: 5557 },
  { n: 6, layout: "centreBloom", palette: "LavenderDusk", seed: 6101 },
  { n: 6, layout: "centreBloom", palette: "GoldenOchre", seed: 6557 },
  { n: 7, layout: "edgeFrame", palette: "BlushPastel", seed: 7101 },
  { n: 7, layout: "edgeFrame", palette: "IndigoNight", seed: 7557 },
  { n: 8, layout: "layeredGlazes", palette: "MintPeach", seed: 8101 },
  { n: 8, layout: "layeredGlazes", palette: "OceanBlues", seed: 8557 },
  { n: 9, layout: "looseDots", palette: "SoftRainbow", seed: 9101 },
  { n: 9, layout: "looseDots", palette: "SageEucalyptus", seed: 9557 },
  { n: 10, layout: "brushSwatches", palette: "TerracottaEarth", seed: 10101 },
  { n: 10, layout: "brushSwatches", palette: "BlushPastel", seed: 10557 },
  { n: 11, layout: "saltTexture", palette: "IndigoNight", seed: 11101 },
  { n: 11, layout: "saltTexture", palette: "SageEucalyptus", seed: 11557 },
  { n: 12, layout: "granulatingWash", palette: "OceanBlues", seed: 12101 },
  { n: 12, layout: "granulatingWash", palette: "TerracottaEarth", seed: 12557 },
  { n: 13, layout: "pourDrip", palette: "SunsetCoral", seed: 13101 },
  { n: 13, layout: "pourDrip", palette: "LavenderDusk", seed: 13557 },
  { n: 14, layout: "marbledBlend", palette: "MintPeach", seed: 14101 },
  { n: 14, layout: "marbledBlend", palette: "GoldenOchre", seed: 14557 },
  { n: 15, layout: "abstractHorizon", palette: "LavenderDusk", seed: 15101 },
  { n: 15, layout: "abstractHorizon", palette: "SageEucalyptus", seed: 15557 },
  { n: 16, layout: "confettiDabs", palette: "SoftRainbow", seed: 16101 },
  { n: 16, layout: "confettiDabs", palette: "GoldenOchre", seed: 16557 },
  { n: 17, layout: "diagonalSweep", palette: "IndigoNight", seed: 17101 },
  { n: 17, layout: "diagonalSweep", palette: "BlushPastel", seed: 17557 },
  { n: 18, layout: "halfPage", palette: "OceanBlues", seed: 18101 },
  // development only (not rendered unless asked for by id)
  { n: 0, layout: "test", palette: "OceanBlues", seed: 1 },
];

const pad = (n: number) => String(n).padStart(2, "0");
/** Remotion ids allow no underscores; file names use them. */
export const stillId = (s: StillRow) =>
  `WC-${pad(s.n)}-${LAYOUTS[s.layout].label}-${s.palette}${s.paintScale === 1 ? "-native" : ""}`;
export const fileName = (s: StillRow) => `WC_${pad(s.n)}_${LAYOUTS[s.layout].label}_${s.palette}.png`;
