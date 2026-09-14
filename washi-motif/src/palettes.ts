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
  /* ── The surface set ──────────────────────────────────────────────────────
     Palettes for the full-bleed textures. Same shape as the motif palettes:
     paper base, mottle, fibre, then three inks. On a watercolour ground the
     three inks are the pigment hues; on a metallic one they are the highlight,
     the deep tone and the sparkle.                                          */
  boardGreen: {
    label: "Board green",
    paper: "#14603A",
    mottle: "#1B6E45",
    fibre: "#2A7E55",
    motifs: ["#A8C4B0", "#7FA890", "#E6EFE8"],
  },
  crimsonWave: {
    label: "Crimson wave",
    paper: "#C4291A",
    mottle: "#A82214",
    fibre: "#D4432F",
    motifs: ["#93190E", "#E1553C", "#7A1409"],
  },
  limePaper: {
    label: "Lime paper",
    paper: "#A9C25E",
    mottle: "#9FB854",
    fibre: "#B8CE74",
    motifs: ["#8AA245", "#C9DC92", "#7A8F3C"],
  },
  goldLeaf: {
    label: "Gold leaf",
    paper: "#C89A2B",
    mottle: "#B5851F",
    fibre: "#DEB755",
    motifs: ["#F2D88C", "#A8731A", "#FFF3CC"],
  },
  vermilionPaper: {
    label: "Vermilion paper",
    paper: "#BE3A28",
    mottle: "#A8301F",
    fibre: "#CE5340",
    motifs: ["#8E2214", "#DD6A55", "#F2CFC6"],
  },
  navyPaper: {
    label: "Navy paper",
    paper: "#2F4A7C",
    mottle: "#26406F",
    fibre: "#3E5C92",
    motifs: ["#8FA6C9", "#1D2F55", "#C7D3E6"],
  },
  peachWash: {
    label: "Peach wash",
    paper: "#FBF1E6",
    mottle: "#F6DCCC",
    fibre: "#F7E2D2",
    motifs: ["#EE93A0", "#F2A85E", "#F6C9A0"],
  },
  sumiGold: {
    label: "Sumi and gold",
    paper: "#232326",
    mottle: "#2C2C30",
    fibre: "#38383D",
    motifs: ["#D3A945", "#EFD68F", "#8A6A2E"],
  },
  amberWash: {
    label: "Amber wash",
    paper: "#EEB84F",
    mottle: "#E0A436",
    fibre: "#F4CE7E",
    motifs: ["#D8921F", "#B4700F", "#FBE7B4"],
  },
  creamPaper: {
    label: "Cream paper",
    paper: "#F2EDE0",
    mottle: "#EAE3D2",
    fibre: "#E2D9C4",
    motifs: ["#C9A34E", "#D8C89B", "#F7F3E8"],
  },
  shiroGold: {
    label: "White and gold",
    paper: "#F7F5EF",
    mottle: "#EFEBE0",
    fibre: "#E5DFD0",
    motifs: ["#E0A93A", "#F2D081", "#C98A22"],
  },
  shiroWhite: {
    label: "White on white",
    paper: "#F1F1F1",
    mottle: "#E9E9E9",
    fibre: "#E1E1E1",
    motifs: ["#FDFDFD", "#E6E6E6", "#D6D6D6"],
  },
  sumiBlack: {
    label: "Sumi black",
    paper: "#2A2A2A",
    mottle: "#232323",
    fibre: "#363636",
    motifs: ["#8A8A8A", "#BFBFBF", "#1B1B1B"],
  },
  skyWash: {
    label: "Sky wash",
    paper: "#F6FBFE",
    mottle: "#DFEFF9",
    fibre: "#EAF4FB",
    motifs: ["#A6D6EE", "#78BFE3", "#CFE7F5"],
  },
  kraftPaper: {
    label: "Kraft paper",
    paper: "#DCC9A0",
    mottle: "#D2BD8E",
    fibre: "#E8DAB8",
    motifs: ["#B49A66", "#EFE3C6", "#9C7F4C"],
  },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
