import * as THREE from "three";

/**
 * Container liveries, sampled off the reference footage.
 *
 * The references split into two fleets. Some yards are photographed in hard
 * daylight with relatively fresh paint and high-chroma corporate colours;
 * others are older stock in flat or golden light where every box has faded
 * toward bone and oxide. Mixing the two reads as neither, so each shot picks
 * the family that matches its reference.
 */

export type PaletteId = "saturated" | "weathered" | "dusk";

export type Palette = {
  colors: string[];
  /** Relative pick weights, same length as colors. */
  weights: number[];
  /** Baseline weathering for the fleet; per-container jitter is added on top. */
  weathering: number;
};

export const PALETTES: Record<PaletteId, Palette> = {
  // Clips 1162584442 and 2217367108: strong reds and blues, clean greys.
  saturated: {
    colors: [
      "#a8342c", "#8f2d27", "#b5473a",
      "#35597f", "#2d4c72", "#4a7099",
      "#2f7a4e", "#3d8b5a",
      "#9aa0a3", "#8b9195", "#b9bec0",
      "#7a2733", "#c0632c",
    ],
    weights: [10, 7, 6, 8, 6, 4, 5, 3, 7, 5, 3, 3, 2],
    weathering: 0.55,
  },
  // Clips 1345063988 / 1345063252 / 1345063383: bleached, oxidised stock.
  weathered: {
    colors: [
      "#cdc3ad", "#d6cdb9", "#bdb3a0",
      "#a04a3c", "#8e4033", "#b35a45",
      "#5f7a54", "#4f6a48",
      "#cc8b45", "#d99a52", "#b87a38",
      "#5c7c93", "#4d6b80",
      "#8a8578",
    ],
    weights: [11, 8, 6, 9, 6, 4, 5, 3, 7, 5, 3, 5, 3, 4],
    weathering: 1.0,
  },
  // Clip 2260573766: dusk, a tighter set dominated by maroon, bone and orange.
  dusk: {
    colors: [
      "#8c2f3c", "#7a2833", "#a03c46",
      "#d2d0cb", "#c4c1ba",
      "#c4763c", "#b06730",
      "#454a80", "#3a3f6e",
    ],
    weights: [10, 6, 5, 9, 5, 8, 5, 4, 3],
    weathering: 0.7,
  },
};

/** Pre-resolved THREE.Color list, so per-instance fills do no parsing. */
export const resolvePalette = (id: PaletteId) => {
  const palette = PALETTES[id];
  // THREE.Color already converts an sRGB hex into the linear working space
  // when colour management is enabled, which it is by default. Converting
  // again here would crush every livery toward black.
  const colors = palette.colors.map((hex) => new THREE.Color(hex));
  // Expand weights into a lookup table so picking is a single array index.
  const table: number[] = [];
  palette.weights.forEach((weight, i) => {
    for (let k = 0; k < weight; k++) table.push(i);
  });
  return { colors, table, weathering: palette.weathering };
};
