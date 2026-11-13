export type RGB = [number, number, number];

export type Palette = {
  bgA: RGB;
  bgB: RGB;
  dialA: RGB;
  dialB: RGB;
  ring: RGB;
  ink: RGB;
  metalHi: RGB;
  metalMid: RGB;
  metalLo: RGB;
  wall: RGB;
  shadow: RGB;
  shadowAmt: number;
  sheen: number;
};

const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Version 1 – the cool, airy blue-on-white look of the reference. */
export const frost: Palette = {
  bgA: hex("#8fabc6"),
  bgB: hex("#6f93b4"),
  dialA: hex("#f3f6fd"),
  dialB: hex("#d3ddef"),
  ring: hex("#a9b9cc"),
  ink: hex("#3d5673"),
  metalHi: hex("#fbfcff"),
  metalMid: hex("#c9d6e8"),
  metalLo: hex("#6f89a8"),
  wall: hex("#3f5a78"),
  shadow: hex("#8fa6c6"),
  shadowAmt: 0.55,
  sheen: 0.4,
};

/** Version 2 – alternative palette: champagne gold on midnight charcoal. */
export const midnightGold: Palette = {
  bgA: hex("#2a2420"),
  bgB: hex("#0c0b0d"),
  dialA: hex("#26272c"),
  dialB: hex("#101115"),
  ring: hex("#3a3531"),
  ink: hex("#f1c98a"),
  metalHi: hex("#ffe9c2"),
  metalMid: hex("#d9a35c"),
  metalLo: hex("#6b4520"),
  wall: hex("#1d1610"),
  shadow: hex("#000000"),
  shadowAmt: 0.6,
  sheen: 0.9,
};

export const palettes = { v1: frost, v2: midnightGold } as const;
export type Variant = keyof typeof palettes;
