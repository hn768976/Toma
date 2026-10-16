// One data row per version. To add a colourway, copy a row, give it a new
// `id` (which becomes the composition id) and change its colours.

export type NebulaPalette = {
  deep: string;
  teal: string;
  plum: string;
  mauve: string;
  cream: string;
  ring: string;
  /** hole centre in uv (0..1, y up) and shadow radius in frame heights */
  holeX: number;
  holeY: number;
  holeRadius: number;
};

export type ChampagnePalette = {
  liquid: string;
  glow: string;
  highlight: string;
  vignette: string;
  /** bubble rim colour (darker than the liquid) */
  rim: string;
};

export type DataMontagePalette = {
  bgTop: string;
  bgBottom: string;
  elementDim: string;
  elementBright: string;
  flare: string;
};

export type FireCorePalette = {
  tendrilHot: string;
  tendrilCool: string;
  core: string;
  haze: string;
};

export type BarChartPalette = {
  bgFrom: string;
  bgTo: string;
  ink: string;
  line: string;
};

export type Version =
  | { id: string; look: "nebula"; ref: string; palette: NebulaPalette }
  | { id: string; look: "champagne"; ref: string; palette: ChampagnePalette }
  | { id: string; look: "datamontage"; ref: string; palette: DataMontagePalette }
  | { id: string; look: "firecore"; ref: string; palette: FireCorePalette }
  | { id: string; look: "barchart"; ref: string; palette: BarChartPalette };

/** Remotion ids allow only a-z, A-Z, 0-9 and "-". Output files keep the "_". */
export const compositionId = (v: { id: string }) => v.id.replace(/_/g, "-");

export const VERSIONS: Version[] = [
  {
    id: "NebulaLens_Pastel",
    look: "nebula",
    ref: "1021658938",
    palette: {
      deep: "#0E141A",
      teal: "#4A6A72",
      plum: "#4A2A4A",
      mauve: "#B07A9A",
      cream: "#F8E8C0",
      ring: "#FFF0D8",
      holeX: 0.5,
      holeY: 0.5,
      holeRadius: 0.16,
    },
  },
  {
    id: "Champagne_Gold",
    look: "champagne",
    ref: "14040221",
    palette: { liquid: "#C8A050", glow: "#F0E0B0", highlight: "#FFF6E0", vignette: "#5A3A10", rim: "#6A4A18" },
  },
  {
    id: "Champagne_Rose",
    look: "champagne",
    ref: "14040221",
    palette: { liquid: "#E8A090", glow: "#FCE0D8", highlight: "#FFF0F0", vignette: "#6A2A2A", rim: "#7A3A34" },
  },
  {
    id: "DataMontage_Blue",
    look: "datamontage",
    ref: "1018476988",
    palette: { bgTop: "#0A1438", bgBottom: "#04081E", elementDim: "#3A9AFF", elementBright: "#8AD0FF", flare: "#7A4AFF" },
  },
  {
    id: "FireCore_Ember",
    look: "firecore",
    ref: "4036022599",
    palette: { tendrilHot: "#FF6A1A", tendrilCool: "#C81A0A", core: "#FFF4C8", haze: "#2A0402" },
  },
  {
    id: "FireCore_Electric",
    look: "firecore",
    ref: "4036022599",
    palette: { tendrilHot: "#3AC8FF", tendrilCool: "#1A4AFF", core: "#E8F8FF", haze: "#02061A" },
  },
  {
    id: "BarChart_BlueViolet",
    look: "barchart",
    ref: "1010978468",
    palette: { bgFrom: "#5A3AE8", bgTo: "#2AA8F0", ink: "#FFFFFF", line: "#E0C8FF" },
  },
  {
    id: "BarChart_TealGreen",
    look: "barchart",
    ref: "1010978468",
    palette: { bgFrom: "#0A7A8A", bgTo: "#3AD8A0", ink: "#FFFFFF", line: "#F8F0A0" },
  },
];
