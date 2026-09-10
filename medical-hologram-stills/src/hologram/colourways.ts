import type { ColourwayId } from "./types";

export type Colourway = {
  id: ColourwayId;
  // Background field: centre -> corners.
  fieldCentre: string;
  fieldEdge: string;
  // Temperature shift across the field: a cast on the left, a cleaner
  // colour on the right.
  castLeft: string;
  castRight: string;
  // Subject treatment.
  outline: string; // crisp near-white edge
  glow: string; // outer glow around the outline
  fill: string; // translucent interior
  rim: string; // inner rim brightening
  // HUD ring accents.
  arcLeft: string;
  arcRight: string;
  ring: string;
  // Central burst / streak / sparkles.
  burst: string;
  streak: string;
  sparkle: string;
  mesh: string;
};

export const COLOURWAYS: Record<ColourwayId, Colourway> = {
  blue: {
    id: "blue",
    fieldCentre: "#1a3a8a",
    fieldEdge: "#0a1a4a",
    castLeft: "#6a3fd8",
    castRight: "#1e78e6",
    outline: "#d8f4ff",
    glow: "#7fe3ff",
    fill: "#8fe4ff",
    rim: "#c8f4ff",
    arcLeft: "#7a4ae8",
    arcRight: "#22d3ee",
    ring: "#9ed8ff",
    burst: "#e6f8ff",
    streak: "#ffffff",
    sparkle: "#ffffff",
    mesh: "#bfe8ff",
  },
  violet: {
    id: "violet",
    fieldCentre: "#3a1a7a",
    fieldEdge: "#140a3a",
    castLeft: "#c22a9a",
    castRight: "#3d5fe6",
    outline: "#f0d8ff",
    glow: "#d59cff",
    fill: "#c99cff",
    rim: "#f2dcff",
    arcLeft: "#e026c0",
    arcRight: "#4a6ae8",
    ring: "#d9bfff",
    burst: "#f6ecff",
    streak: "#ffffff",
    sparkle: "#ffffff",
    mesh: "#e4d0ff",
  },
};

export const COLOURWAY_IDS = Object.keys(COLOURWAYS) as ColourwayId[];
