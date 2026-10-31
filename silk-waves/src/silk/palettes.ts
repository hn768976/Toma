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
  bgCenter: rgb(16, 18, 24),
  bgEdge: rgb(25, 28, 38),
  veil: rgb(36, 42, 62),
  sheen: rgb(55, 70, 108),
  fiber: rgb(110, 130, 180),
  exposure: 0.38,
};

/** Version 2 — alternative palette: champagne-gold silk on warm black. */
export const CHAMPAGNE_GOLD: SilkPalette = {
  bgCenter: rgb(18, 13, 9),
  bgEdge: rgb(40, 29, 18),
  veil: rgb(92, 62, 30),
  sheen: rgb(176, 128, 64),
  fiber: rgb(255, 222, 160),
  exposure: 0.58,
};
