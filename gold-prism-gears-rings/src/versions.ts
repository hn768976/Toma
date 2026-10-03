/**
 * One data row per version. Adding a colourway = adding a row here
 * (see README "How to add a colourway").
 */

export type GoldMarketRow = {
  look: "goldMarket";
  id: string;
  /** Share of candles that are "up" (green). */
  upShare: number;
  /** +1 rising trend, -1 falling trend. */
  trend: 1 | -1;
  upColor: string;
  downColor: string;
  tagColor: string;
  tagArrow: "▲" | "▼";
  gold: string;
};

export type PrismRow = {
  look: "prism";
  id: string;
  /** Colours of the light body, from dim to hot. */
  shadow: string;
  body: string;
  accent: string;
  highlight: string;
  /** Background areas. */
  bgDeep: string;
  /** Rainbow fringe strength and width. */
  fringe: number;
  fringeWidth: number;
  /** Rotates the fringe spectrum toward warm (+) or cool (−). */
  fringeWarmth: number;
};

export type GearsRow = {
  look: "gears";
  id: string;
  edge: string;
  bgTop: string;
  bgBottom: string;
};

export type RingRow = {
  look: "ring";
  id: string;
  edge: string;
  band: string;
  /** Metal base colour (linear-ish albedo for PBR). */
  metal: string;
};

export type TerraceRow = {
  look: "terraces";
  id: string;
  top: string;
  bottom: string;
};

export type VersionRow = GoldMarketRow | PrismRow | GearsRow | RingRow | TerraceRow;

export const VERSIONS: VersionRow[] = [
  {
    look: "goldMarket",
    id: "GoldMarket-Bull",
    upShare: 0.8,
    trend: 1,
    upColor: "#3FE87A",
    downColor: "#FF3F4A",
    tagColor: "#3FE8B0",
    tagArrow: "▲",
    gold: "#FFC872",
  },
  {
    look: "goldMarket",
    id: "GoldMarket-Bear",
    upShare: 0.2,
    trend: -1,
    upColor: "#3FE87A",
    downColor: "#FF3F4A",
    tagColor: "#FF4A55",
    tagArrow: "▼",
    gold: "#FFC872",
  },
  {
    look: "prism",
    id: "PrismLeaks-Cool",
    shadow: "#101C2E",
    body: "#5A7AA6",
    accent: "#BBAED0",
    highlight: "#EEF2FF",
    bgDeep: "#0A1638",
    fringe: 1.0,
    fringeWidth: 1.0,
    fringeWarmth: 0,
  },
  {
    look: "prism",
    id: "PrismLeaks-Warm",
    shadow: "#5A2208",
    body: "#FF9A3C",
    accent: "#FFB58C",
    highlight: "#FFE6B0",
    bgDeep: "#2A1206",
    fringe: 1.0,
    fringeWidth: 1.0,
    fringeWarmth: 1,
  },
  { look: "gears", id: "WireframeGears-Blue", edge: "#7FD8FF", bgTop: "#041428", bgBottom: "#0A2A4A" },
  { look: "gears", id: "WireframeGears-Amber", edge: "#FFB050", bgTop: "#140802", bgBottom: "#2A1408" },
  { look: "ring", id: "GoldRingFrame-Gold", edge: "#E8B860", band: "#120E0A", metal: "#E8A24E" },
  { look: "ring", id: "GoldRingFrame-Silver", edge: "#D8DEE8", band: "#0E1014", metal: "#DDE3EC" },
  { look: "terraces", id: "DarkTerraces", top: "#2A2C30", bottom: "#08090A" },
];
