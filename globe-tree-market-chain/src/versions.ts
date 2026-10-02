// One data row per version. To add a version, append a row to the right
// table; Root.tsx registers a composition for every row automatically.

export type GlobeVersion = {
  id: string; // composition id + output file stem
  primary: string;
  accent: string;
  tag: string;
  bgCenter: string;
  bgEdge: string;
  exposure: number;
  keywords: string[];
};

export const GLOBE_VERSIONS: GlobeVersion[] = [
  {
    id: "KeywordGlobe-TechBlue",
    primary: "#3F8CFF",
    accent: "#7FE8FF",
    tag: "#FFE4EE",
    bgCenter: "#072257",
    bgEdge: "#010412",
    exposure: 1.0,
    keywords: ["TECHNOLOGY", "MOBILE DATA", "BIG DATA", "LOGISTICS", "CLOUD", "NETWORK", "5G", "IOT", "AI", "CYBERSECURITY"],
  },
  {
    id: "KeywordGlobe-BusinessGold",
    primary: "#FFC060",
    accent: "#FF9A30",
    tag: "#FFF3E2",
    bgCenter: "#2E1C10",
    bgEdge: "#05050C",
    exposure: 0.72,
    keywords: ["FINANCE", "INVESTMENT", "GLOBAL TRADE", "ECONOMY", "MARKETS", "BANKING", "GROWTH", "STRATEGY", "FINTECH", "PAYMENTS"],
  },
];

export type TreeVersion = {
  id: string;
  trace: string;
  pad: string;
  canopy: string[]; // icon colours
  bgTop: string;
  bgBottom: string;
  glow: string;
  grass: string;
  // relative weights of icon shapes: heart, circle, plus, leaf, diamond
  iconWeights: [number, number, number, number, number];
};

export const TREE_VERSIONS: TreeVersion[] = [
  {
    id: "CircuitTree-Blue",
    trace: "#5FB8FF",
    pad: "#FF5FA8",
    canopy: ["#4FA8FF", "#7FDCFF", "#3F7CFF", "#A8E4FF"],
    bgTop: "#020818",
    bgBottom: "#0A2152",
    glow: "#3FA0FF",
    grass: "#6FB8FF",
    iconWeights: [3, 3, 2, 1, 2],
  },
  {
    id: "CircuitTree-EcoGreen",
    trace: "#5FE8A0",
    pad: "#FFE07A",
    canopy: ["#5FE8A0", "#9FF5C0", "#3FC888", "#C8FFB0"],
    bgTop: "#020F0C",
    bgBottom: "#05201A",
    glow: "#3FE8A0",
    grass: "#7FE8B0",
    iconWeights: [1, 2, 1, 6, 2],
  },
];

export type MarketVersion = {
  id: string;
  panel: string;
  bg: string;
  green: string;
  red: string;
  text: string;
};

export const MARKET_VERSIONS: MarketVersion[] = [
  { id: "MarketDashboard", panel: "#0E2228", bg: "#06141A", green: "#3FD08A", red: "#E8404A", text: "#C8D6DA" },
];

export type PanelsVersion = { id: string; ice: string; navy: string };
export const PANELS_VERSIONS: PanelsVersion[] = [{ id: "BlockchainPanels-IceBlue", ice: "#9FD8FF", navy: "#020A1A" }];

export type BuildVersion = { id: string; pale: string; lit: string; board: string; trace: string; red: string };
export const BUILD_VERSIONS: BuildVersion[] = [
  { id: "BlockchainBuild-Teal", pale: "#7FD8FF", lit: "#3FFFC0", board: "#03070D", trace: "#2A6FB8", red: "#FF3A2A" },
];
