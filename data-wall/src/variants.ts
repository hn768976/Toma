/**
 * THE single source of truth for every tunable in the piece.
 *
 * Rule for this project: no colour literal and no layout constant lives
 * anywhere else. Adding a third board should mean adding a third key here and
 * nothing more — in particular `layerOrder` is a *value*, not a hardcoded draw
 * order, because the two boards invert it.
 */

export type VariantName = "blue" | "amber";

/** Which of the two mid layers sits on top of the other. */
export type LayerOrder = "chartsFront" | "numbersFront";

export type Palette = {
  /** Deepest background tone, the ground of the whole frame. */
  bgDeep: string;
  /** Slightly lifted tone used for the centre wash. */
  bgWash: string;
  /** Continent fill. Deliberately only a step or two off the background. */
  mapLand: string;
  /** The tone the majority of grid cells are drawn in. */
  numberMid: string;
  /** The brighter minority, and the colour a cell flashes when it rerolls. */
  numberBright: string;
  /** The scattered accent. Red in a blue field, cyan in an amber field. */
  numberAccent: string;
  /** Hairlines between grid cells. */
  gridRule: string;
  candleUp: string;
  candleDown: string;
  volumeBar: string;
  /** One entry per moving-average line, in draw order. */
  maLines: string[];
  /** Colour the vignette darkens towards. */
  vignette: string;
};

export type Tilt = {
  /** Rotation of the plane, degrees. Negative lifts the right-hand edge. */
  rotationDeg: number;
  /** Horizontal shear: plane x is displaced by `shear * y`. */
  shear: number;
  /** Vertical compression standing in for foreshortening. */
  verticalScale: number;
};

export type GridConfig = {
  /** Roughly how many columns the frame should cross. */
  columns: number;
  /** Roughly how many rows the frame should cross. */
  rows: number;
  /** Type size in plane units (≈ device px at 4K). */
  fontSize: number;
  /** Share of grid positions left blank. */
  emptyRatio: number;
  /** Share of populated cells drawn in `numberBright`. */
  brightRatio: number;
  /** Share of populated cells drawn in `numberAccent`. */
  accentRatio: number;
  /** Cells rerolled per second, counted over the *visible* cells. */
  rerollsPerSecond: number;
};

export type ChartConfig = {
  candles: boolean;
  volume: boolean;
  /** Number of moving-average lines; 0 disables the layer entirely. */
  movingAverages: number;
  /** Smoothing lengths, one per line. */
  maLengths: number[];
};

export type VariantConfig = {
  palette: Palette;
  layerOrder: LayerOrder;
  /** Opacity of the number-grid layer as a whole. */
  numbersOpacity: number;
  /** Opacity of the chart layer as a whole. */
  chartOpacity: number;
  tilt: Tilt;
  grid: GridConfig;
  chart: ChartConfig;
  /** Alpha the volume bars are drawn at. */
  volumeAlpha: number;
  /** Alpha of the centre background wash over the deep tone. */
  washAlpha: number;
  /** Alpha the continents are filled at. Low enough to stay a texture. */
  mapAlpha: number;
  /** Vignette strength, 0..1. */
  vignette: number;
  /** Film-grain alpha, 0..1. */
  grain: number;
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /**
   * v1 — a chart sitting on a data backdrop. Numbers behind, charts in front,
   * plane receding to the upper right.
   */
  blue: {
    palette: {
      bgDeep: "#0A0F3A",
      bgWash: "#1A1F5C",
      mapLand: "#202866",
      numberMid: "#6F8FD4",
      numberBright: "#C8D8FF",
      numberAccent: "#F5486B",
      gridRule: "#2A3378",
      candleUp: "#E8ECF5",
      candleDown: "#F5486B",
      volumeBar: "#3F5FD4",
      maLines: ["#F5C43F", "#F5486B", "#4FC4E8"],
      vignette: "#04061C",
    },
    layerOrder: "chartsFront",
    numbersOpacity: 1,
    chartOpacity: 1,
    tilt: { rotationDeg: -12, shear: -0.16, verticalScale: 0.91 },
    grid: {
      columns: 14,
      rows: 20,
      fontSize: 46,
      emptyRatio: 0.12,
      brightRatio: 0.18,
      accentRatio: 0.12,
      rerollsPerSecond: 8,
    },
    chart: {
      candles: true,
      volume: true,
      movingAverages: 3,
      maLengths: [9, 24, 55],
    },
    volumeAlpha: 0.45,
    washAlpha: 0.75,
    mapAlpha: 0.9,
    vignette: 0.22,
    grain: 0.04,
  },

  /**
   * v2 — a data board with charts bleeding through it. Charts behind, numbers
   * in front at reduced opacity, plane mirrored to recede to the upper left,
   * denser grid, and no moving averages (three curves behind a dense grid read
   * as noise).
   */
  amber: {
    palette: {
      bgDeep: "#14100A",
      bgWash: "#3A2E14",
      mapLand: "#4A3A18",
      numberMid: "#C4A05F",
      numberBright: "#FFE8B8",
      numberAccent: "#4FC4E8",
      gridRule: "#4A3A18",
      candleUp: "#FFF4E0",
      candleDown: "#C4553A",
      volumeBar: "#A87A2E",
      maLines: ["#4FC4E8", "#FFE8B8"],
      vignette: "#0A0704",
    },
    layerOrder: "numbersFront",
    numbersOpacity: 0.85,
    chartOpacity: 1,
    tilt: { rotationDeg: 10, shear: 0.16, verticalScale: 0.91 },
    grid: {
      columns: 18,
      rows: 26,
      fontSize: 34,
      emptyRatio: 0.18,
      brightRatio: 0.18,
      accentRatio: 0.12,
      rerollsPerSecond: 8,
    },
    chart: {
      candles: true,
      volume: true,
      movingAverages: 0,
      maLengths: [],
    },
    volumeAlpha: 0.45,
    // The amber field is far darker than the blue one, so the same nominal
    // land tone would jump forward and read as a subject. Both are pulled back
    // until the continents are only a shape you notice second.
    washAlpha: 0.5,
    mapAlpha: 0.45,
    vignette: 0.22,
    grain: 0.04,
  },
};
