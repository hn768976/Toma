// One data row per version. To add a colourway, add a row to the look's table:
// Root.tsx registers a composition for every row automatically.
// `id` becomes the composition id; `file` is the output file name.

export type DotGlobePalette = {
  dots: string; // map + globe dots
  bgTop: string; // background at the top light
  bgBottom: string; // background at the bottom (near-black)
  grid: string; // fine grid lines
  text: string; // code text
  particles: string;
  rim: string; // globe rim glow
};

export type DataMatrixPalette = {
  dots: string;
  accent: string; // orange-ish minority dots and strands
  bg: string;
};

export type FinanceDepthPalette = {
  main: string; // numbers, candles, lines
  dark: string; // darker candle bodies
  up: string; // faint "up" line accent
  down: string; // faint "down" line accent
};

export type HologramPalette = {
  map: string;
  outline: string;
  streak: string;
  streakAlt: string; // violet tint
  bg: string;
  bgDeep: string;
  text: string;
};

export type OverlayPalette = {
  main: string;
  white: string;
  light: string; // light blue
  up: string;
  down: string;
};

type Row<P> = { id: string; file: string; palette: P };

export const DOT_GLOBE: Row<DotGlobePalette>[] = [
  {
    id: "DotMapGlobe-SilverNavy",
    file: "DotMapGlobe_SilverNavy",
    palette: {
      dots: "#C8D0DC",
      bgTop: "#0E1A30",
      bgBottom: "#03060C",
      grid: "#6F86B0",
      text: "#C8D0DC",
      particles: "#FFFFFF",
      rim: "#8FA8D8",
    },
  },
  {
    id: "DotMapGlobe-Teal",
    file: "DotMapGlobe_Teal",
    palette: {
      dots: "#5FE0D0",
      bgTop: "#06202A",
      bgBottom: "#01090C",
      grid: "#3FA8A0",
      text: "#9FF0E6",
      particles: "#E8FFFC",
      rim: "#5FE0D0",
    },
  },
];

export const DATA_MATRIX: Row<DataMatrixPalette>[] = [
  {
    id: "DataMatrix-BlueOrange",
    file: "DataMatrix_BlueOrange",
    palette: { dots: "#3F8CFF", accent: "#FF9A3F", bg: "#05091A" },
  },
  {
    id: "DataMatrix-GreenCyan",
    file: "DataMatrix_GreenCyan",
    palette: { dots: "#3FE0A0", accent: "#5FD8FF", bg: "#03140F" },
  },
];

export const FINANCE_DEPTH: Row<FinanceDepthPalette>[] = [
  {
    id: "FinanceDepth-Blue",
    file: "FinanceDepth_Blue",
    palette: { main: "#7FC0FF", dark: "#2E5F94", up: "#3FD98A", down: "#FF4D5A" },
  },
  {
    id: "FinanceDepth-Gold",
    file: "FinanceDepth_Gold",
    palette: { main: "#FFC870", dark: "#8F6526", up: "#3FD9C8", down: "#FF4D5A" },
  },
];

export const HOLOGRAM: Row<HologramPalette>[] = [
  {
    id: "HologramMap-IceBlue",
    file: "HologramMap_IceBlue",
    palette: {
      map: "#BFE0FF",
      outline: "#EAF6FF",
      streak: "#CFE6FF",
      streakAlt: "#A88CFF",
      bg: "#0A0F2E",
      bgDeep: "#04061A",
      text: "#7FA6E0",
    },
  },
];

export const OVERLAY: Row<OverlayPalette>[] = [
  {
    id: "FinanceOverlay-Teal",
    file: "FinanceOverlay_Teal",
    palette: {
      main: "#3FE0C8",
      white: "#FFFFFF",
      light: "#9CCBFF",
      up: "#3FE07A",
      down: "#FF4D5E",
    },
  },
];

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const LOOP_FRAMES = 600;
export const MATRIX_FRAMES = 450;
