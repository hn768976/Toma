/**
 * The ONLY place hex literals appear in this project.
 *
 * paper  - base sheet tone
 * mottle - the broad soft tonal variation blotted over the sheet
 * fibre  - the colour of the individual washi fibre strands
 * motifs - three motif inks, ordered primary / secondary / pale accent
 */
export type Palette = {
  readonly label: string;
  readonly paper: string;
  readonly mottle: string;
  readonly fibre: string;
  readonly motifs: readonly [string, string, string];
};

export const PALETTES = {
  goldWhite: {
    label: "Gold on white",
    paper: "#F7F5F0",
    mottle: "#EFEBE2",
    fibre: "#E4DFD4",
    motifs: ["#C9A34E", "#E8D9A8", "#F0E8D4"],
  },
  goldBlack: {
    label: "Gold on black",
    paper: "#16161A",
    mottle: "#1E1E24",
    fibre: "#26262E",
    motifs: ["#D4A84F", "#F0C46A", "#8A6A2E"],
  },
  redGold: {
    label: "Red and gold",
    paper: "#F7F4EE",
    mottle: "#EFE9DE",
    fibre: "#E4DDD0",
    motifs: ["#D4402E", "#D9A93F", "#F5EAD4"],
  },
  silverGold: {
    label: "Silver and gold",
    paper: "#F8F7F4",
    mottle: "#F0EEE8",
    fibre: "#E6E3DC",
    motifs: ["#B8B4AC", "#C9A34E", "#EDE8DC"],
  },
  indigoGold: {
    label: "Gold on indigo",
    paper: "#1A2438",
    mottle: "#223046",
    fibre: "#2C3A52",
    motifs: ["#C9A34E", "#E8D9A8", "#6A7F9F"],
  },
  sakuraPink: {
    label: "Sakura pink",
    paper: "#FAF6F4",
    mottle: "#F2EAE6",
    fibre: "#E8DED8",
    motifs: ["#E8A8B4", "#D4A84F", "#F5E4E0"],
  },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
