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
    background: "#868a9c",
    disc: "#f3f4f5",
    hole: "#9a9ba8",
    sky: "#e3e8f8",
    ground: "#a9adb8",
    hemiIntensity: 1.25,
    key: "#fff8ee",
    keyIntensity: 1.95,
    fill: "#b8c6ea",
    fillIntensity: 0.4,
    sheen: "#fff6e8",
    exposure: 1.0,
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
