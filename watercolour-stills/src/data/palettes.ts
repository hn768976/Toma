// Pigment palettes. `granulation` says how much the pigments speckle into the
// paper grain (ultramarine, earths and Payne's grey do; dye-like pinks don't).
// To add a palette: add one entry here, then reference its key in stills.ts.

export type Palette = {
  name: string;
  colors: string[];
  granulation: number;
};

export const PALETTES = {
  BlushPastel: {
    name: "Blush Pastel",
    colors: ["#E8A0A8", "#F2C0A0", "#C8B0D8"],
    granulation: 0.12,
  },
  OceanBlues: {
    name: "Ocean Blues",
    colors: ["#3A5AA8", "#4A9AC8", "#5AB8B0"],
    granulation: 0.45,
  },
  SageEucalyptus: {
    name: "Sage & Eucalyptus",
    colors: ["#8AA88A", "#6A9A90", "#B8C08A"],
    granulation: 0.3,
  },
  SunsetCoral: {
    name: "Sunset Coral",
    colors: ["#F07A5A", "#F5A860", "#D85A88"],
    granulation: 0.1,
  },
  LavenderDusk: {
    name: "Lavender Dusk",
    colors: ["#A88AC8", "#7A5AA8", "#8AA0C8"],
    granulation: 0.35,
  },
  TerracottaEarth: {
    name: "Terracotta Earth",
    colors: ["#C0684A", "#A0502A", "#D8B080"],
    granulation: 0.5,
  },
  GoldenOchre: {
    name: "Golden Ochre",
    colors: ["#D8A040", "#F0C850", "#9A6A30"],
    granulation: 0.3,
  },
  IndigoNight: {
    name: "Indigo Night",
    colors: ["#2A3A7A", "#3A4A5A", "#2A5A6A"],
    granulation: 0.55,
  },
  MintPeach: {
    name: "Mint & Peach",
    colors: ["#A8D8C0", "#F5C0A0", "#F5E2A8"],
    granulation: 0.08,
  },
  SoftRainbow: {
    name: "Soft Rainbow",
    // rose, apricot, butter, mint, sky, lilac
    colors: ["#E8A0A8", "#F5A860", "#F5E2A8", "#A8D8C0", "#A8C8E8", "#C8B0D8"],
    granulation: 0.1,
  },
} satisfies Record<string, Palette>;

export type PaletteKey = keyof typeof PALETTES;
