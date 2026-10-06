// One data row per version. Add a colourway by adding a row (see README).

export type BoardRow = {
  look: "board";
  id: string;
  bgTop: string;
  bgBottom: string;
  map: string;
  ring: string;
  tile: string;
  accent: string;
};

export type MarketRow = {
  look: "market";
  id: string;
  direction: "down" | "up";
  tint: string;
  dark: string;
  seed: number;
};

export type MapRow = {
  look: "map";
  id: string;
  base: string;
  dots: string;
  lines: string;
  widgets: [string, string, string, string];
};

export type NetworkRow = {
  look: "network";
  id: string;
  base: string;
  block: string;
  diagram: string;
  panel: string;
  tag: string;
};

export type SecurityRow = {
  look: "security";
  id: string;
  base: string;
  deep: string;
  light: string;
  glow: string;
};

export type VersionRow = BoardRow | MarketRow | MapRow | NetworkRow | SecurityRow;

export const VERSIONS: VersionRow[] = [
  {
    look: "board",
    id: "AIAgentsBoard_Blue",
    bgTop: "#041430",
    bgBottom: "#0A2A5A",
    map: "#2E7A9E",
    ring: "#5AD8FF",
    tile: "#1A3A6A",
    accent: "#5AD8FF",
  },
  { look: "market", id: "MarketMove_CrashRed", direction: "down", tint: "#E0101A", dark: "#1A0204", seed: 11 },
  { look: "market", id: "MarketMove_RallyGreen", direction: "up", tint: "#1AD86A", dark: "#021A0A", seed: 23 },
  {
    look: "map",
    id: "MapDashboard_Blue",
    base: "#061A4A",
    dots: "#9AC8FF",
    lines: "#FFFFFF",
    widgets: ["#E84AC8", "#3AE8F0", "#FFD24A", "#3AE8A0"],
  },
  {
    look: "network",
    id: "AINetworkPanel_BlueWhite",
    base: "#070B14",
    block: "#0A0E18",
    diagram: "#FFFFFF",
    panel: "#5A8AD8",
    tag: "#FF8A2A",
  },
  { look: "security", id: "SecurityHUD_Blue", base: "#020A3A", deep: "#1A4AE8", light: "#8AC8FF", glow: "#4AA8FF" },
];

export const LOOPING: VersionRow["look"][] = ["market", "security"];
