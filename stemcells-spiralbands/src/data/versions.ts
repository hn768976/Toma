// One data row per version. Add a colourway by adding a row here (and a
// palette in palettes.ts / bandPalettes if it needs new colours).
import type { CellColors } from "../cells/types";
import type { BandColors } from "../bands/types";
import { CELL_BLUE, CELL_RED, DIV_BLUE, DIV_RED } from "./palettes";
import { BANDS_GRAPHITE, BANDS_WHITE } from "../bands/palettes";

export type CellRow = {
  id: string;
  look: "field" | "hero" | "division";
  frames: number;
  /** Loop length used for grain/dither and closed paths. */
  loopFrames: number;
  seed: number;
  colors: CellColors;
  fragments?: boolean;
};

export type BandRow = {
  id: string;
  look: "bands";
  frames: number;
  loopFrames: number;
  seed: number;
  colors: BandColors;
};

export type Row = CellRow | BandRow;

export const ROWS: Row[] = [
  { id: "CellField-Blue", look: "field", frames: 600, loopFrames: 600, seed: 7, colors: CELL_BLUE },
  { id: "CellField-Red", look: "field", frames: 600, loopFrames: 600, seed: 19, colors: CELL_RED, fragments: true },
  { id: "HeroCell-Blue", look: "hero", frames: 600, loopFrames: 600, seed: 7, colors: CELL_BLUE },
  { id: "CellDivision-Red", look: "division", frames: 360, loopFrames: 360, seed: 3, colors: DIV_RED },
  { id: "CellDivision-Blue", look: "division", frames: 360, loopFrames: 360, seed: 3, colors: DIV_BLUE },
  { id: "SpiralBands-White", look: "bands", frames: 600, loopFrames: 600, seed: 5, colors: BANDS_WHITE },
  { id: "SpiralBands-Graphite", look: "bands", frames: 600, loopFrames: 600, seed: 5, colors: BANDS_GRAPHITE },
];
