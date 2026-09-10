/**
 * The only place in the project where a colour literal may appear.
 *
 * Every palette is a background plus a set of blob colours. Compositions
 * address the colours by index and the index is taken modulo the set length,
 * so a composition with more blobs than the palette has colours simply cycles.
 */

export type Palette = {
  readonly background: string;
  readonly colours: readonly string[];
};

export const PALETTES = {
  cyanMagenta: {
    background: "#0A0A12",
    colours: ["#2ED4E8", "#2E7FE8", "#A83FD4", "#E82ED4"],
  },
  warmSpectrum: {
    background: "#121010",
    colours: ["#E8402E", "#F5A02E", "#2ED4E8", "#2E6FD4"],
  },
  crimsonGlow: {
    background: "#100A14",
    colours: ["#E82E5F", "#C43F9F", "#7B4FD4", "#F5806A"],
  },
  deepBlue: {
    background: "#05081A",
    colours: ["#2E4FD4", "#5F9FE8", "#A8D4F5", "#7B5FE8"],
  },
  violetBlue: {
    background: "#08040F",
    colours: ["#7B2ED4", "#4F3FE8", "#2E7FD4", "#C45FF5"],
  },
  tealPurple: {
    background: "#041014",
    colours: ["#2ED4C4", "#2E9FD4", "#5F7FE8", "#A87FE8"],
  },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export type Rgb = { r: number; g: number; b: number };

export type ResolvedPalette = {
  readonly background: Rgb;
  readonly colours: readonly Rgb[];
};

const parseHex = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
};

export const resolvePalette = (name: PaletteName): ResolvedPalette => {
  const palette = PALETTES[name];
  return {
    background: parseHex(palette.background),
    colours: palette.colours.map(parseHex),
  };
};

/** Blob colour indices cycle through the palette rather than clamping. */
export const paletteColour = (palette: ResolvedPalette, index: number): Rgb =>
  palette.colours[((index % palette.colours.length) + palette.colours.length) % palette.colours.length];
