// One data row per colourway. Each role lists the colours it may pick from.
export type GraffitiPalette = {
  bg: string;
  wash: string[]; // big soft background colour clouds
  washAlpha: number;
  spray: string[]; // big spray strokes (X, zigzag, circles, loops)
  brush: string[]; // heavy dry brush strokes
  marker: string[]; // tags / scribbles
  symbol: string[]; // stars, arrows, hearts, crowns ...
  pen: string; // thin pen doodles on top
  splat: string[];
  grain: string | null; // paper grain speck colour (null = none)
};

export const GRAFFITI_PALETTES: Record<"neon" | "paper", GraffitiPalette> = {
  neon: {
    bg: "#0A0A0A",
    wash: ["#FFD020", "#FF7A1A", "#FF2A9A", "#FFD020", "#20A8C8", "#FF7A1A", "#FF2A9A", "#FFD020", "#FF2A9A", "#20A8C8"],
    washAlpha: 1,
    spray: ["#FF2A9A", "#FF2A9A", "#FF2A9A", "#FF2A9A", "#FF7A1A", "#FFD020", "#20A8C8"],
    brush: ["#FFFFFF", "#0A0A0A", "#FF2A9A", "#FF7A1A"],
    marker: ["#FF2A9A", "#FFD020", "#0A0A0A", "#FFFFFF", "#20A8C8", "#0A0A0A"],
    symbol: ["#FFFFFF", "#FF2A9A", "#FFD020", "#20A8C8", "#FF7A1A", "#FFFFFF"],
    pen: "#FFFFFF",
    splat: ["#FFFFFF", "#FF2A9A", "#FFD020", "#20A8C8", "#FF7A1A"],
    grain: null,
  },
  paper: {
    bg: "#F4F1EA",
    wash: ["#FF2A9A", "#20A8C8", "#FF2A9A"],
    washAlpha: 0.45,
    spray: ["#FF2A9A", "#20A8C8", "#141414", "#FF2A9A"],
    brush: ["#141414", "#141414", "#FF2A9A"],
    marker: ["#141414", "#FF2A9A", "#20A8C8", "#141414"],
    symbol: ["#141414", "#FF2A9A", "#20A8C8"],
    pen: "#141414",
    splat: ["#141414", "#FF2A9A", "#20A8C8"],
    grain: "#DCD6C8",
  },
};
