// One data row per version. Change a colourway or the ring's elements here.

export type ElementRingRow = {
  id: string;
  colorA: string; // tile colour A
  colorB: string; // tile colour B
  floorGlow: string;
  elements: string[]; // symbols, placed around the ring in this order
};
export const ELEMENT_RING: ElementRingRow[] = [
  {
    id: "ElementRing-Teal",
    colorA: "#2AF0C0",
    colorB: "#3A9AFF",
    floorGlow: "#1FC8B0",
    elements: ["Y", "La", "Ce", "Pr", "Nd", "Sm", "Eu", "Gd", "Tb", "Dy", "Er", "Yb"],
  },
  {
    id: "ElementRing-Violet",
    colorA: "#A06AFF",
    colorB: "#FF6AD8",
    floorGlow: "#8A55F0",
    elements: ["Y", "La", "Ce", "Pr", "Nd", "Sm", "Eu", "Gd", "Tb", "Dy", "Er", "Yb"],
  },
];

export type ChipOnOreRow = { id: string; glow: string };
export const CHIP_ON_ORE: ChipOnOreRow[] = [{ id: "ChipOnOre-Blue", glow: "#4AA8FF" }];

export type EVBatteryRow = {
  id: string;
  module: string;
  tile: string;
  tiles: string[];
};
export const EV_BATTERY: EVBatteryRow[] = [
  {
    id: "EVBatteryPack-Story",
    module: "#2A8AFF",
    tile: "#FF8A2A",
    tiles: ["Nd", "Dy", "Pr", "La", "Ce"],
  },
];

export type ServerStreamsRow = {
  id: string;
  room: string;
  lines: string;
  mirrored: boolean;
};
export const SERVER_STREAMS: ServerStreamsRow[] = [
  { id: "ServerStreams-Blue", room: "#0E2240", lines: "#8AC8FF", mirrored: false },
  { id: "ServerStreams-TealMirrored", room: "#0A2A2E", lines: "#6AF0E0", mirrored: true },
];

export type AIRacksRow = {
  id: string;
  badge: string;
  streak: string;
  head: string;
  rackTint: string;
};
export const AI_RACKS: AIRacksRow[] = [
  { id: "AIRacks-Blue", badge: "#5AC8FF", streak: "#3AA8FF", head: "#F2FAFF", rackTint: "#8FA3BC" },
  { id: "AIRacks-Violet", badge: "#B08AFF", streak: "#8A5AFF", head: "#FFE8FA", rackTint: "#9A94C2" },
];
