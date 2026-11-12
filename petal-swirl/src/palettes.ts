export type Palette = {
  background: string;
  disc: string;
  hole: string;
  sky: string;
  ground: string;
  hemiIntensity: number;
  key: string;
  keyIntensity: number;
  fill: string;
  fillIntensity: number;
  sheen: string;
  exposure: number;
};

export const PALETTES: Record<"pearl" | "blush", Palette> = {
  // Version 1: matches the reference - pearl white discs, cool lavender
  // shadows and a soft warm key light.
  pearl: {
    background: "#8e919f",
    disc: "#f4f4f3",
    hole: "#c4c6ce",
    sky: "#e1e6f6",
    ground: "#b9b9bd",
    hemiIntensity: 1.85,
    key: "#fcfae6",
    keyIntensity: 2.0,
    fill: "#c4cbe0",
    fillIntensity: 0.3,
    sheen: "#fbf5c8",
    exposure: 0.93,
  },
  // Version 2: alternative palette - blush rose discs under a golden
  // late-afternoon key with mauve shadows.
  blush: {
    background: "#9a6c78",
    disc: "#f5d8dc",
    hole: "#b0808a",
    sky: "#fff0f2",
    ground: "#b88a90",
    hemiIntensity: 1.45,
    key: "#ffe1c6",
    keyIntensity: 1.65,
    fill: "#c99ad6",
    fillIntensity: 0.45,
    sheen: "#ffe6ea",
    exposure: 1.0,
  },
};
