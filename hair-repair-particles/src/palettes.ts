export type Variant = "reference" | "sapphire";

export type Palette = {
  bgCenter: string;
  bgEdge: string;
  bokeh: string[];
  damagedDark: string;
  damagedMid: string;
  damagedLight: string;
  healthy: string;
  healthyHighlight: string;
  healthyShadow: string;
  frontGlow: string;
  bead: string;
  beadRim: string;
  flareCore: string;
  flareTint: string;
};

/** Version 1 – the warm olive / amber look of the reference. */
const reference: Palette = {
  bgCenter: "#58523f",
  bgEdge: "#181812",
  bokeh: ["#c98a2c", "#b8742a", "#d8a548", "#9c6a2a"],
  damagedDark: "#211a14",
  damagedMid: "#40332a",
  damagedLight: "#6f5f4e",
  healthy: "#70502e",
  healthyHighlight: "#b08a62",
  healthyShadow: "#472d15",
  frontGlow: "#ffd9a0",
  bead: "#f09a3a",
  beadRim: "#ffe0a8",
  flareCore: "#fff4f6",
  flareTint: "#ffb8c8",
};

/** Version 2 – cool sapphire / ice palette: silver strand, aqua molecules. */
const sapphire: Palette = {
  bgCenter: "#2f5672",
  bgEdge: "#0a1120",
  bokeh: ["#3fc4ff", "#5f8dff", "#7fe6ff", "#8f7dff"],
  damagedDark: "#17161d",
  damagedMid: "#4a4756",
  damagedLight: "#8c8a9c",
  healthy: "#6b80a8",
  healthyHighlight: "#cfdcf2",
  healthyShadow: "#16223d",
  frontGlow: "#bff3ff",
  bead: "#22b6ea",
  beadRim: "#c9f7ff",
  flareCore: "#f4feff",
  flareTint: "#8fd8ff",
};

export const PALETTES: Record<Variant, Palette> = { reference, sapphire };
