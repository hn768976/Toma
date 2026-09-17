// The two colour treatments.
//
// `aurora` tracks the reference clip: deep navy ground, teal/cyan gyri
// rising into a green crest, iced cyan filaments, and warm gold bokeh for
// the complementary accent that keeps it from going monochrome.
//
// `nebula` is the requested dark-blue-and-violet companion: indigo ground,
// royal blue gyri rising into violet, lilac filaments, warm magenta accent
// playing the same complementary role the gold plays in `aurora`.

export type Palette = {
  /** Flat canvas colour behind everything. */
  background: string;
  /** Slightly lifted tone the field fades into at the soft edge. */
  haze: string;
  /** Gyri body ramp, darkest (valley) -> brightest (crest). */
  ridgeLow: string;
  ridgeMid: string;
  ridgeHigh: string;
  /** Thin glowing trace that runs along each gyrus crest. */
  filament: string;
  /** Bokeh tints with the relative weight each is sampled at. */
  bokeh: { color: string; weight: number }[];
};

export const PALETTES = {
  aurora: {
    background: "#04101d",
    haze: "#0a2138",
    ridgeLow: "#041d33",
    ridgeMid: "#0d7fb8",
    ridgeHigh: "#2fd6a2",
    filament: "#a8f4ff",
    bokeh: [
      { color: "#ffd45e", weight: 0.4 }, // warm gold accent
      { color: "#5fe3ff", weight: 0.28 }, // cyan
      { color: "#74ffb4", weight: 0.22 }, // green
      { color: "#e8fbff", weight: 0.1 }, // near-white sparkle
    ],
  },
  nebula: {
    background: "#060819",
    haze: "#151238",
    ridgeLow: "#0d1043",
    ridgeMid: "#4a3ccc",
    ridgeHigh: "#a86bff",
    filament: "#ded0ff",
    bokeh: [
      { color: "#ff8ae0", weight: 0.22 }, // warm magenta accent
      { color: "#8a6bff", weight: 0.28 }, // violet
      { color: "#4d7bff", weight: 0.38 }, // royal blue
      { color: "#f0ecff", weight: 0.12 }, // near-white sparkle
    ],
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
