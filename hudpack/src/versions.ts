// One data row per version. Composition ids use a hyphen (Remotion does not
// allow underscores); the rendered files use the underscore names, e.g.
// StockScreen-Teal -> StockScreen_Teal.mp4.
// To add a colourway, copy a row, give it a new
// id and change its colours; Root.tsx registers every row automatically.

export type Look = "stock" | "aihud" | "heart" | "map" | "loading";

export interface StockPalette {
  screenTop: string;
  screenBottom: string;
  text: string;
  up: string;
  down: string;
  priceLine: string;
}
export interface HeartPalette {
  glitter: [string, string, string];
  hearts: string;
  /** Heart height as a fraction of frame height. */
  heartHeight: number;
}
export interface MapPalette {
  bgCentre: string;
  bgEdge: string;
  dots: string;
  charts: string;
}
export interface OverlayPalette {
  line: string;
}

export type Version =
  | { id: string; look: "stock"; durationInFrames: number; palette: StockPalette }
  | { id: string; look: "aihud"; durationInFrames: number; palette: OverlayPalette }
  | { id: string; look: "heart"; durationInFrames: number; palette: HeartPalette }
  | { id: string; look: "map"; durationInFrames: number; palette: MapPalette }
  | { id: string; look: "loading"; durationInFrames: number; palette: OverlayPalette };

export const VERSIONS: Version[] = [
  {
    id: "StockScreen-Teal",
    look: "stock",
    durationInFrames: 600,
    palette: { screenTop: "#061A26", screenBottom: "#0A2232", text: "#9ADCF0", up: "#3AE88A", down: "#FF4A6A", priceLine: "#D8F4FF" },
  },
  { id: "AIHUD-WhiteOverlay", look: "aihud", durationInFrames: 600, palette: { line: "#E8E8E8" } },
  {
    id: "ParticleHeart-Pink",
    look: "heart",
    durationInFrames: 300,
    palette: { glitter: ["#FF2A8A", "#FF6AAA", "#FFC8E0"], hearts: "#E8204A", heartHeight: 0.48 },
  },
  {
    id: "ParticleHeart-Red",
    look: "heart",
    durationInFrames: 300,
    palette: { glitter: ["#E8102A", "#FF3A4A", "#FFB0B8"], hearts: "#C8001A", heartHeight: 0.48 },
  },
  {
    id: "ParticleHeart-Gold",
    look: "heart",
    durationInFrames: 300,
    palette: { glitter: ["#E8B040", "#F8D890", "#FFF4D8"], hearts: "#D89A30", heartHeight: 0.48 },
  },
  {
    id: "MarketMap-Blue",
    look: "map",
    durationInFrames: 600,
    palette: { bgCentre: "#0A1A6A", bgEdge: "#040A2A", dots: "#5AE8FF", charts: "#C8E4FF" },
  },
  {
    id: "MarketMap-Gold",
    look: "map",
    durationInFrames: 600,
    palette: { bgCentre: "#2A1A08", bgEdge: "#140A04", dots: "#F0B040", charts: "#F8E0B0" },
  },
  { id: "LoadingHUD-WhiteOverlay", look: "loading", durationInFrames: 360, palette: { line: "#E8E8E8" } },
];

/** Loops repeat exactly every this many frames; stories play once. */
export const fileName = (v: Version) => v.id.replace("-", "_");

export const isLoop = (v: Version) => v.look === "stock" || v.look === "aihud" || v.look === "map";
