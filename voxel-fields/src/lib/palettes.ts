// One row per composition. To add a colourway, add one row: it becomes a new
// composition automatically (see README, "How to add a palette").

import type { LookId } from "./fields";

export type Palette = {
  /** Composition id (letters, digits, "-"). Output file: id with "-" -> "_". */
  id: string;
  look: LookId;
  /** Column colours, lightest first. Neighbouring columns share colours in bands. */
  colors: string[];
  /** Relative share of each colour (same length as colors). */
  weights: number[];
  /** Optional accent picked for a few small patches (e.g. aqua). */
  accent?: { color: string; amount: number };
  /** Saturated colour the walls shift toward as they go down into a gap. */
  tint: string;
  /** Colour the deepest gaps and the void fall to. */
  deep: string;
  /** Cool sky fill colour. */
  sky: string;
};

export const PALETTES: Palette[] = [
  // Look 1 - Voxel Canyon
  {
    id: "VoxelCanyon-Green",
    look: "canyon",
    colors: ["#ffffff", "#e6f7ec", "#c4eed3", "#94dfb0", "#56c886", "#26a95e"],
    weights: [3.4, 3, 2.4, 1.6, 0.9, 0.5],
    tint: "#1fb455",
    deep: "#06281a",
    sky: "#dff3ff",
  },
  {
    id: "VoxelCanyon-White",
    look: "canyon",
    colors: ["#ffffff", "#f2f3f4", "#e2e4e6", "#cdd0d3", "#b0b4b8", "#90959a"],
    weights: [3.4, 3, 2.4, 1.6, 0.9, 0.5],
    tint: "#7d8287",
    deep: "#0b0c0d",
    sky: "#e6eef7",
  },
  {
    id: "VoxelCanyon-Blue",
    look: "canyon",
    colors: ["#ffffff", "#e4f1fb", "#bddcf4", "#88c2ec", "#4598db", "#1f6cc2"],
    weights: [3.4, 3, 2.4, 1.6, 0.9, 0.5],
    accent: { color: "#56dcd8", amount: 0.06 },
    tint: "#2a7fd8",
    deep: "#05162e",
    sky: "#dcecff",
  },
  // Look 2 - Voxel Wave
  {
    id: "VoxelWave-Blue",
    look: "wave",
    colors: ["#ffffff", "#eef6fc", "#d8eaf8", "#b8d9f2", "#90c4ea"],
    weights: [3, 3, 2.4, 1.6, 1],
    accent: { color: "#8fe2e2", amount: 0.05 },
    tint: "#5aa9e6",
    deep: "#2b4c6b",
    sky: "#e2f0ff",
  },
  {
    id: "VoxelWave-Mint",
    look: "wave",
    colors: ["#ffffff", "#eefaf3", "#d4f2e1", "#b2e6c9", "#88d4aa"],
    weights: [3, 3, 2.4, 1.6, 1],
    tint: "#5cc690",
    deep: "#2b5a43",
    sky: "#e6f6ff",
  },
];
