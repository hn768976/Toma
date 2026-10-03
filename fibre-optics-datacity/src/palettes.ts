// One data row per version. Add a colourway by adding a row here and a
// <Composition> in Root.tsx (see README "Adding a colourway").

export type FibreOpticPalette = {
  id: string;
  mode: "mono" | "multi";
  tip: string; // mono tip colour (blends to white in the cores)
  strand: string; // strand tint (mono)
  cycle: string[]; // multicolour tip cycle (used when mode === "multi")
  bgTop: string; // background gradient (navy -> black)
  bgBottom: string;
  glow: string; // light from the bundle below frame
  exposure: number;
  strandGain: number;
  hueSpread: number; // multicolour: how much each tip's own hue offset counts
};

export const FIBRE_OPTIC_PALETTES: Record<string, FibreOpticPalette> = {
  Blue: {
    id: "Blue",
    mode: "mono",
    tip: "#4F8CFF",
    strand: "#1C3FB8",
    cycle: [],
    bgTop: "#00073A",
    bgBottom: "#000000",
    glow: "#4F8CFF",
    exposure: 0.95,
    strandGain: 1,
    hueSpread: 0,
  },
  Multicolour: {
    id: "Multicolour",
    mode: "multi",
    tip: "#4F8CFF",
    strand: "#3A3FA8",
    cycle: ["#3F7BFF", "#8A4FFF", "#FF3FC8", "#2FE07A", "#FFB23F"],
    bgTop: "#07052A",
    bgBottom: "#000000",
    glow: "#5A3FD8",
    exposure: 0.72,
    strandGain: 0.55,
    hueSpread: 1.0,
  },
};

export type DataCityPalette = {
  id: string;
  block: string;
  tileCyan: string;
  tileBlue: string;
  tileWhite: string;
  tilePink: string;
  tileRed: string;
  line: string;
  haze: string;
  sky: string;
};

export const DATA_CITY_PALETTES: Record<string, DataCityPalette> = {
  BluePink: {
    id: "BluePink",
    block: "#0A2A6A",
    tileCyan: "#4FD8FF",
    tileBlue: "#3AA0FF",
    tileWhite: "#F2F6FF",
    tilePink: "#FF4FA8",
    tileRed: "#FF2A3A",
    line: "#6FD8FF",
    haze: "#1F5AD8",
    sky: "#2A5FE0",
  },
};

export type GrowingFibresPalette = {
  id: string;
  stemBase: string;
  stemTip: string;
  head: string;
  halo: string;
};

export const GROWING_FIBRES_PALETTES: Record<string, GrowingFibresPalette> = {
  BluePink: {
    id: "BluePink",
    stemBase: "#E04FD8",
    stemTip: "#8FC8FF",
    head: "#8FC8FF",
    halo: "#2F6BFF",
  },
  GreenGold: {
    id: "GreenGold",
    stemBase: "#2FC87A",
    stemTip: "#FFE08A",
    head: "#FFE08A",
    halo: "#E0A030",
  },
};
