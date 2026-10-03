// One data row per version. Add a colourway by adding a row here and a
// <Composition> for it in Root.tsx.

export type MapPalette = {
  id: string;
  ocean: string; // background
  land: string;
  coast: string;
  border: string;
  graticule: string;
  text: string; // primary widget text
  textDim: string;
  cyan: string;
  up: string; // green numbers
  down: string; // red numbers
  chart: string; // blue chart colour
  chartHi: string; // bright chart line
  panel: string; // translucent panel fill
  panelEdge: string;
  haze: [number, number, number]; // linear-ish rgb 0..1 added in post
};

export const MAP_PALETTES: MapPalette[] = [
  {
    id: "Blue",
    ocean: "#040C1C",
    land: "#1A3A6A",
    coast: "#3266A6",
    border: "#2E5C96",
    graticule: "rgba(80,140,220,0.34)",
    text: "#EAF6FF",
    textDim: "#9CC4EA",
    cyan: "#8FE6FF",
    up: "#3DF07A",
    down: "#FF3B3B",
    chart: "#2A9BFF",
    chartHi: "#9ADCFF",
    panel: "rgba(14,48,96,0.10)",
    panelEdge: "rgba(120,190,255,0.45)",
    haze: [0.02, 0.08, 0.16],
  },
];

export type CandlePalette = {
  id: string;
  bgCenter: string;
  bgMid: string;
  bgEdge: string;
  up: string;
  down: string;
  area: string; // area fill base colour
  areaEdge: string;
  map: string;
  grid: string;
  flare: string;
  flareGlow: string;
  text: string;
  textDim: string;
  labelUp: string;
  labelDown: string;
};

export const CANDLE_PALETTES: CandlePalette[] = [
  {
    id: "Blue",
    bgCenter: "#0A2A6A",
    bgMid: "#06183E",
    bgEdge: "#01040C",
    up: "#4FE8F0",
    down: "#FF6A5A",
    area: "#2F7BFF",
    areaEdge: "#8CC8FF",
    map: "#5AA0FF",
    grid: "rgba(110,160,255,0.08)",
    flare: "#E8F6FF",
    flareGlow: "#5CB4FF",
    text: "#DCEBFF",
    textDim: "#7F9CC8",
    labelUp: "#4FE8F0",
    labelDown: "#FF6A5A",
  },
  {
    id: "Gold",
    bgCenter: "#1A1206",
    bgMid: "#0E0A05",
    bgEdge: "#020101",
    up: "#FFC860",
    down: "#E84A3A",
    area: "#D98A1E",
    areaEdge: "#FFD58A",
    map: "#E0A040",
    grid: "rgba(255,200,120,0.07)",
    flare: "#FFF6E6",
    flareGlow: "#FFB050",
    text: "#FFEFD2",
    textDim: "#B8935C",
    labelUp: "#FFC860",
    labelDown: "#E84A3A",
  },
];
