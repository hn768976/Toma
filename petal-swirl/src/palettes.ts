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
  exposure: number;
};

export const PALETTES: Record<"pearl" | "blush", Palette> = {
  // Version 1: matches the reference - pearl white discs, cool lavender
  // shadows and a soft warm key light.
  pearl: {
    background: "#7d7f93",
    disc: "#f3f3f1",
    hole: "#9a9ba8",
    sky: "#dde4fb",
    ground: "#b3ada5",
    hemiIntensity: 1.5,
    key: "#fff3e2",
    keyIntensity: 1.8,
    fill: "#aabcff",
    fillIntensity: 0.4,
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
    exposure: 1.0,
  },
};
