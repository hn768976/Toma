// One data row per colourway. Bands go outside -> in: edge, edge2, body, core.
export type FirePalette = {
  bands: [string, string, string, string];
  glow: string; // soft haze around the flames (dithered)
  back: [string, string]; // dim background flame layer (two tones)
  ember: string;
  emberCore: string;
};

export const FIRE_PALETTES: Record<"red" | "blue", FirePalette> = {
  red: {
    bands: ["#5A0A04", "#C82A0A", "#FF7A10", "#FFC830"],
    glow: "#6A1004",
    back: ["#1A0303", "#2C0606"],
    ember: "#E8281A",
    emberCore: "#FF7A30",
  },
  blue: {
    bands: ["#0A1A5A", "#1A5AFF", "#3AD8FF", "#F0FCFF"],
    glow: "#0E2A8A",
    back: ["#020514", "#050C2C"],
    ember: "#2A8AFF",
    emberCore: "#BFF4FF",
  },
};
