export type RGB = readonly [number, number, number];

export type SilkPalette = {
  bgCenter: RGB;
  bgEdge: RGB;
  veil: RGB;
  sheen: RGB;
  fiber: RGB;
  exposure: number;
};

const rgb = (r: number, g: number, b: number): RGB => [r / 255, g / 255, b / 255];

/** Version 1 — matches the reference: midnight navy silk on charcoal. */
export const MIDNIGHT_NAVY: SilkPalette = {
  bgCenter: rgb(12, 13, 17),
  bgEdge: rgb(27, 30, 38),
  veil: rgb(38, 46, 70),
  sheen: rgb(66, 84, 128),
  fiber: rgb(120, 142, 196),
  exposure: 0.9,
};

/** Version 2 — alternative palette: champagne-gold silk on warm black. */
export const CHAMPAGNE_GOLD: SilkPalette = {
  bgCenter: rgb(12, 9, 7),
  bgEdge: rgb(40, 29, 18),
  veil: rgb(92, 62, 30),
  sheen: rgb(176, 128, 64),
  fiber: rgb(255, 222, 160),
  exposure: 1.0,
};
