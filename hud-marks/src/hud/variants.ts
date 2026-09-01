import { DENSE_FIELD } from "./fields/dense";
import { PRINT_FIELD } from "./fields/print";
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

  dense: {
    palette: {
      bg: "#030305",
      ink: "#FFFFFF",
      dim: "#6A6A72",
      accent: "#E8452E",
      panel: "#C8C8D0",
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
    layout: "centredCluster",
    pitch: 85,
    stroke: 3,
    peakCount: 48,
    phases: [
      { name: "black", from: 0, to: 15 },
      { name: "wave1", from: 15, to: 45 },
      { name: "pause1", from: 45, to: 60 },
      { name: "wave2", from: 60, to: 95 },
      { name: "pause2", from: 95, to: 110 },
      { name: "wave3", from: 110, to: 140 },
      { name: "hold", from: 140, to: 230 },
      { name: "clear", from: 230, to: 250 },
      { name: "black", from: 250, to: 300 },
    ],
    field: DENSE_FIELD,
    flicker: { chance: 0.06, level: 0.26, minDur: 2, maxDur: 3 },
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

  print: {
    palette: {
      bg: "#F4F2EE",
      ink: "#14120E",
      dim: "#8A867E",
      accent: "#1A5CD4",
      panel: "#2A2620",
    },
    vocabulary: [
      "cropMark",
      "registrationTarget",
      "colourBar",
      "dotColumn",
      "chevron",
      "diagonalPair",
      "crossedX",
      "squarePanel",
      "tickRow",
      "circleOutline",
      "dash",
    ],
    layout: "registration",
    pitch: 130,
    stroke: 3,
    peakCount: 33,
    phases: [
      { name: "paper", from: 0, to: 20 },
      { name: "arrive", from: 20, to: 120 },
      { name: "hold", from: 120, to: 250 },
      { name: "depart", from: 250, to: 300 },
    ],
    field: PRINT_FIELD,
    // No flicker: a two-frame drop is a screen artefact. Print gets a slower,
    // gentler under-inking instead.
    flicker: null,
    inkVariation: { chance: 0.05, level: 0.72, minDur: 4, maxDur: 7 },
    // No glitch either — horizontal slice tearing reads as an error on paper.
    glitch: null,
    grain: { alpha: 0.03, tile: 256, frames: 6 },
    paper: { alpha: 0.03 },
  },
};

// Keeps each version's declared vocabulary honest: a mark type that is not in
// its variant's list is a mistake in the field data, not a silent extra shape.
for (const [name, variant] of Object.entries(VARIANTS)) {
  for (const mark of variant.field) {
    if (!variant.vocabulary.includes(mark.type)) {
      throw new Error(
        `${name}: mark "${mark.id}" uses ${mark.type}, which is not in this variant's vocabulary`,
      );
    }
  }
}
