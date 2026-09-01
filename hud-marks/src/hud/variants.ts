import { SPARSE_FIELD } from "./fields/sparse";
import type { Variant, VariantName } from "./types";

/**
 * The single source of truth for all three versions: palette, mark vocabulary,
 * layout mode, grid pitch, stroke weight and phase schedule.
 *
 * No colour value and no mark name appears anywhere else in the project.
 */
export const VARIANTS: Record<VariantName, Variant> = {
  sparse: {
    palette: {
      bg: "#000000",
      ink: "#FFFFFF",
      dim: "#7A7A7A",
      accent: "#FFFFFF",
      panel: "#D8D8D8",
    },
    vocabulary: [
      "cornerBracket",
      "dotColumn",
      "chevron",
      "diagonalPair",
      "crossedX",
      "arc",
      "squarePanel",
      "tickRow",
      "circleOutline",
      "dash",
    ],
    layout: "edgeWeighted",
    pitch: 130,
    stroke: 3,
    peakCount: 22,
    phases: [
      { name: "black", from: 0, to: 25 },
      { name: "arrive", from: 25, to: 90 },
      { name: "hold", from: 90, to: 200 },
      { name: "depart", from: 200, to: 265 },
      { name: "stragglers", from: 265, to: 300 },
    ],
    field: SPARSE_FIELD,
    flicker: { chance: 0.13, level: 0.26, minDur: 2, maxDur: 3 },
    inkVariation: null,
    glitch: {
      minGap: 45,
      maxGap: 90,
      minDur: 2,
      maxDur: 3,
      minSlices: 2,
      maxSlices: 4,
      minShift: 20,
      maxShift: 90,
      minSliceH: 10,
      maxSliceH: 58,
      cluster: 320,
    },
    grain: { alpha: 0.03, tile: 256, frames: 6 },
    paper: null,
  },
};
