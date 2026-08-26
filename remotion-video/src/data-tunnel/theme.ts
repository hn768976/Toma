// The ONLY place in the data-tunnel code that may contain a colour literal.
// Everything downstream reads colours from the active Theme, so adding a new
// look means adding a key here and nothing else.

export type ChipPaletteEntry = {
  color: string;
  // Relative likelihood of a chip picking this colour. Weights need not
  // sum to 1 — they are normalised when the chip set is generated.
  weight: number;
};

export type Theme = {
  backgroundDeep: string;
  backgroundMid: string;
  // Fill colours for FILLED chips, violet/blue dominant with magenta and
  // cyan held back as sparse accents.
  chipPalette: ChipPaletteEntry[];
  // Stroke colour for HOLLOW chips.
  outlineGlow: string;
  // The brightest note: used both as a regular (rare) chip fill and as the
  // colour a chip flashes to.
  chipWhite: string;
  sparkle: string;
  vignette: string;
  // Neutral grey the film-grain tiles oscillate around. Mid-grey is the
  // no-op value for the "overlay" blend the grain layer uses.
  grainNeutral: string;
};

export const THEMES = {
  violet: {
    backgroundDeep: "#0A0838",
    backgroundMid: "#1A1466",
    chipPalette: [
      { color: "#7B4FE8", weight: 0.44 }, // chip violet
      { color: "#3F6FE8", weight: 0.38 }, // chip blue
      { color: "#C44FD4", weight: 0.06 }, // chip magenta
      { color: "#4FD4E8", weight: 0.05 }, // chip cyan — the coolest note, rare
      { color: "#E8E4FF", weight: 0.07 }, // chip white — the brightest chips
    ],
    outlineGlow: "#9B7FF5",
    chipWhite: "#E8E4FF",
    sparkle: "#E8E4FF",
    vignette: "#050222",
    grainNeutral: "#808080",
  },

  // A colder, deeper blue. Same structure as violet — two dominant notes,
  // two sparse accents and a white — but the accents run teal and ice
  // instead of magenta and cyan, so the two palettes never read as tints of
  // one another.
  azure: {
    backgroundDeep: "#05122F",
    backgroundMid: "#10306E",
    chipPalette: [
      { color: "#3F7FE8", weight: 0.44 }, // chip azure
      { color: "#2C4FD0", weight: 0.38 }, // chip deep blue
      { color: "#1FA5B8", weight: 0.06 }, // chip teal — the warmest note, rare
      { color: "#7FE8F0", weight: 0.05 }, // chip ice
      { color: "#DCE9FF", weight: 0.07 }, // chip white — the brightest chips
    ],
    outlineGlow: "#6FA5F0",
    chipWhite: "#DCE9FF",
    sparkle: "#DCE9FF",
    vignette: "#020818",
    grainNeutral: "#808080",
  },
} satisfies Record<string, Theme>;

export const THEME_NAMES = ["violet", "azure"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];
