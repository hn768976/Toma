import type { FabricPalette } from "./fabric";

export const FABRIC_COLOURWAYS = {
  iridescent: {
    lit: "#F4D8E4",
    foldA: "#4AD8F0",
    foldB: "#9A4AE8",
    trough: "#2A2A8A",
    background: "#2A2A8A",
    sheen: "#FFF4FA",
  },
  champagne: {
    lit: "#FFF2E0",
    foldA: "#E8C080",
    foldB: "#E8A8A0",
    trough: "#8A5A3A",
    background: "#8A5A3A",
    sheen: "#FFF8EE",
  },
} satisfies Record<string, FabricPalette>;
