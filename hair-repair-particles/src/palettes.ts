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
  /** overall flare strength (lower on light strands to avoid clipping) */
  flareGain: number;
  /** how far the strand fades into the background at the wide end shot */
  haze: number;
};

/** Version 1 – the warm olive / amber look of the reference. */
const reference: Palette = {
  bgCenter: "#5c5843",
  bgEdge: "#17170f",
  bokeh: ["#b9741f", "#a8601c", "#c88a30", "#8f5518"],
  damagedDark: "#1d1712",
  damagedMid: "#453524",
  damagedLight: "#7d6950",
  healthy: "#5a3a19",
  healthyHighlight: "#a37c48",
  healthyShadow: "#2a1a09",
  frontGlow: "#ffd9a0",
  bead: "#c8862e",
  beadRim: "#ffd79a",
  flareCore: "#fff4f6",
  flareTint: "#ffb8c8",
  flareGain: 1,
  haze: 0.3,
};

/**
 * Version 2 – cool sapphire palette: the strand is sealed to a glossy jet
 * black, with aqua molecules and blue bokeh.
 */
const sapphire: Palette = {
  bgCenter: "#2f5672",
  bgEdge: "#0a1120",
  bokeh: ["#3fc4ff", "#5f8dff", "#7fe6ff", "#8f7dff"],
  damagedDark: "#17161d",
  damagedMid: "#4a4756",
  damagedLight: "#8c8a9c",
  healthy: "#0b0d12",
  healthyHighlight: "#7f9cc8",
  healthyShadow: "#040507",
  frontGlow: "#bff3ff",
  bead: "#22b6ea",
  beadRim: "#c9f7ff",
  flareCore: "#f4feff",
  flareTint: "#8fd8ff",
  flareGain: 0.9,
  haze: 0.04,
};

export const PALETTES: Record<Variant, Palette> = { reference, sapphire };
