/**
 * Colour palettes. Values are display (sRGB-ish) colours in 0..1; the composite
 * shader works directly in display space with a soft exponential tone curve.
 */
export type RGB = [number, number, number];

export type CountdownPalette = {
  name: string;
  /** Background base and a very faint centre lift. */
  background: RGB;
  backgroundGlow: RGB;
  /** Glitter body colour range (each grain mixes between A and B). */
  glitterA: RGB;
  glitterB: RGB;
  /** Hot white used for the flash at each number's peak. */
  flash: RGB;
  /** Four accent colours for coloured bokeh dots. */
  accents: [RGB, RGB, RGB, RGB];
  /** Two colours for the soft haze that hangs in the dissolving cloud. */
  haze: [RGB, RGB];
  /** Overall bloom strengths [tight, wide]. */
  bloom: [number, number];
  /** Tint of the wide halo bloom around the numbers. */
  halo: RGB;
};

/** V1: matches the reference – cool silver-blue glitter with magenta/teal/green bokeh on black. */
export const COOL: CountdownPalette = {
  name: "cool",
  background: [0.0, 0.0, 0.0],
  backgroundGlow: [0.0, 0.0, 0.0],
  glitterA: [0.88, 0.9, 1.0],
  glitterB: [0.6, 0.66, 1.0],
  flash: [0.95, 0.97, 1.0],
  accents: [
    [0.85, 0.22, 0.95], // magenta / violet
    [0.15, 0.85, 0.85], // teal
    [0.25, 0.85, 0.45], // green
    [0.35, 0.55, 1.0], // blue
  ],
  haze: [
    [0.3, 0.55, 0.85],
    [0.45, 0.42, 0.85],
  ],
  bloom: [0.6, 1.1],
  halo: [0.42, 0.56, 1.0],
};

/** V2: alternative palette – molten gold glitter with ember/rose/amber bokeh on warm black. */
export const EMBER: CountdownPalette = {
  name: "ember",
  background: [0.0, 0.0, 0.0],
  backgroundGlow: [0.0, 0.0, 0.0],
  glitterA: [1.0, 0.86, 0.55],
  glitterB: [1.0, 0.6, 0.28],
  flash: [1.0, 0.8, 0.5],
  accents: [
    [1.0, 0.35, 0.12], // ember orange
    [1.0, 0.72, 0.2], // amber
    [0.95, 0.2, 0.42], // rose red
    [1.0, 0.9, 0.6], // pale gold
  ],
  haze: [
    [0.75, 0.28, 0.06],
    [0.6, 0.12, 0.18],
  ],
  bloom: [0.6, 1.1],
  halo: [1.0, 0.56, 0.22],
};
