// One data row per version. To add a version, add a row here; Root.tsx
// registers a composition for every row automatically.

export type CloudRow = {
  id: string;
  /** glowing traces, pads, light lines */
  line: string;
  /** rack body colour */
  rack: string;
  /** cloud body colour */
  cloud: string;
  /** blinking-light palette: [main, white, accent1, accent2] */
  lights: [string, string, string, string];
  /** floor base colour */
  floor: string;
};

export const CLOUD_ROWS: CloudRow[] = [
  {
    id: "CloudServers_Blue",
    line: "#4FF0F0",
    rack: "#2A5AA8",
    cloud: "#6FB8FF",
    lights: ["#4FF0F0", "#FFFFFF", "#FF9A3F", "#FF3A3A"],
    floor: "#071230",
  },
  {
    id: "CloudServers_Violet",
    line: "#A87CFF",
    rack: "#3A2A78",
    cloud: "#B89CFF",
    lights: ["#A87CFF", "#FFFFFF", "#FF4FD8", "#FF3AA0"],
    floor: "#0E0A2C",
  },
];

export type TrailsRow = {
  id: string;
  /** trail colours from inner/darker to outer/lighter */
  from: string;
  to: string;
  /** accent dash colour */
  accent: string;
  /** dash head tint (whitened core) */
  head: string;
};

export const TRAILS_ROWS: TrailsRow[] = [
  { id: "LightTrails_Blue", from: "#3F7BFF", to: "#9FD8FF", accent: "#FF8A3F", head: "#E8F4FF" },
  { id: "LightTrails_RedOrange", from: "#FF4A2A", to: "#FFB070", accent: "#FFE6B0", head: "#FFF2E0" },
];

export type GoldRow = {
  id: string;
  direction: "rising" | "falling";
  /** bars per column, left to right */
  columns: number[];
};

export const GOLD_ROWS: GoldRow[] = [
  { id: "GoldBarChart_Rising", direction: "rising", columns: [2, 3, 5, 6, 8, 10, 12] },
  { id: "GoldBarChart_Falling", direction: "falling", columns: [12, 10, 8, 6, 5, 4, 3] },
];

import type { FlagId } from "./looks/trade/flags";
export type { FlagId };

export type TradeSide = {
  /** Natural Earth ADM0_A3 code; the largest polygon is used (contiguous US, mainland China) */
  iso: string;
  flag: FlagId;
  /** container colour */
  containers: string;
  /** key light colour on this side */
  light: string;
  /** optional flag placement on the map's bounding box: [offsetU, offsetV, repeat] */
  flagUV?: [number, number, number];
};

export type TradeRow = {
  id: string;
  left: TradeSide;
  right: TradeSide;
};

export const TRADE_ROWS: TradeRow[] = [
  {
    id: "TradeWar_USA_China",
    left: { iso: "USA", flag: "USA", containers: "#1F3FA8", light: "#7FA8FF" },
    right: { iso: "CHN", flag: "China", containers: "#C8161E", light: "#FF5A3A", flagUV: [-0.12, 0.22, 1] },
  },
];

export type FilesRow = {
  id: string;
  item: "document" | "folder";
  glass: string;
  edge: string;
  background: string;
  grid: string;
};

export const FILES_ROWS: FilesRow[] = [
  { id: "FileWave_Documents", item: "document", glass: "#9FC8FF", edge: "#FFFFFF", background: "#020814", grid: "#2A4A8A" },
  { id: "FileWave_Folders", item: "folder", glass: "#9FC8FF", edge: "#FFFFFF", background: "#020814", grid: "#2A4A8A" },
];
