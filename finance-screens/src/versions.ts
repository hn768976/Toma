// One data row per version. To add a colourway: copy a row, give it a new
// `id` (composition id, letters/digits/dashes) and `file` (output name), and
// change the palette values. Nothing else needs editing.

import type { LookContext, LookInstance } from "./looks/types";
import { montage, type MontagePalette } from "./looks/montage";
import { curvedWall, type WallPalette } from "./looks/curvedWall";
import { barRace, type BarPalette } from "./looks/barRace";
import { tickerLine, type TickerPalette } from "./looks/tickerLine";
import { columnChart, type ColumnPalette } from "./looks/columnChart";
import { dashboard, type DashPalette } from "./looks/dashboard";
import { nightChart, type NightPalette } from "./looks/nightChart";

export type Version =
  | { id: string; file: string; look: "montage"; palette: MontagePalette }
  | { id: string; file: string; look: "curvedWall"; palette: WallPalette }
  | { id: string; file: string; look: "barRace"; palette: BarPalette }
  | { id: string; file: string; look: "tickerLine"; palette: TickerPalette }
  | { id: string; file: string; look: "columnChart"; palette: ColumnPalette }
  | { id: string; file: string; look: "dashboard"; palette: DashPalette }
  | { id: string; file: string; look: "nightChart"; palette: NightPalette };

export const VERSIONS: Version[] = [
  // ---- Look 1 — Finance Montage
  {
    id: "FinanceMontage-Blue",
    file: "FinanceMontage_Blue",
    look: "montage",
    palette: {
      bg: "#06092A",
      glow: "#1A30B8",
      map: "#4A5AFF",
      grid: "#3A5AE8",
      numbers: "#8AA8FF",
      code: "#8AA8FF",
      lineA: "#5AF0FF",
      lineB: "#FF6A8A",
      flare: "#6A8AFF",
      readout: "#CFE0FF",
    },
  },
  // ---- Look 2 — Curved Chart Wall
  {
    id: "CurvedChartWall-Blue",
    file: "CurvedChartWall_Blue",
    look: "curvedWall",
    palette: {
      bg: "#041030",
      panel: "#2A6AC8",
      line: "#FFFFFF",
      curve: "#6AF04A",
      curve2: "#FF5A7A",
      text: "#BFD8FF",
      accents: ["#3AC8FF", "#7AD8FF", "#4A9AFF", "#9AE8FF", "#5AB8E8"],
    },
  },
  {
    id: "CurvedChartWall-Emerald",
    file: "CurvedChartWall_Emerald",
    look: "curvedWall",
    palette: {
      bg: "#03201A",
      panel: "#1AA87A",
      line: "#FFFFFF",
      curve: "#F0C84A",
      curve2: "#7AF0D0",
      text: "#BFF0DC",
      accents: ["#4AF0B0", "#7AF0D0", "#3AC89A", "#B8FFE8", "#5AD8B0"],
    },
  },
  // ---- Look 3 — Bar Race
  {
    id: "BarRace-Cyan",
    file: "BarRace_Cyan",
    look: "barRace",
    palette: {
      bg: "#0A1220",
      screen: "#0E1A2C",
      bar: "#7AE8F0",
      barTop: "#E4FBFF",
      text: "#A8C8E0",
      grid: "#3A6890",
      donuts: ["#FF8A2A", "#F0D040", "#3AC8B0"],
    },
  },
  {
    id: "BarRace-Amber",
    file: "BarRace_Amber",
    look: "barRace",
    palette: {
      bg: "#120E0C",
      screen: "#1A140F",
      bar: "#FFC06A",
      barTop: "#FFF0D8",
      text: "#E0C8A8",
      grid: "#8A6A40",
      donuts: ["#3AC8B0", "#5AD8F0", "#2A9AC8"],
    },
  },
  // ---- Look 4 — Ticker Line
  {
    id: "TickerLine-Blue",
    file: "TickerLine_Blue",
    look: "tickerLine",
    palette: {
      bg: "#0E141E",
      screen: "#1A2230",
      grid: "#4A78B8",
      line: "#AAD8FF",
      down: "#FF4A6A",
      text: "#8AB4E8",
      glow: "#1E4A8A",
      glow2: "#3AA8FF",
    },
  },
  // ---- Look 5 — Column Chart
  {
    id: "ColumnChart-Blue",
    file: "ColumnChart_Blue",
    look: "columnChart",
    palette: {
      bg: "#03080E",
      screen: "#071A2A",
      col0: "#1A6AFF",
      col1: "#5AC8FF",
      donut: ["#4AC85A", "#F0D040", "#F09A2A", "#F04A4A", "#3AC8B8"],
      text: "#8AB0D0",
      grid: "#2A5A90",
      ring: "#5AE0D0",
    },
  },
  {
    id: "ColumnChart-Violet",
    file: "ColumnChart_Violet",
    look: "columnChart",
    palette: {
      bg: "#040208",
      screen: "#0E081C",
      col0: "#6A3AFF",
      col1: "#C08AFF",
      donut: ["#FF4A9A", "#F0B83A", "#E87AD0", "#C8902A", "#FFD070"],
      text: "#B8A0E0",
      grid: "#5A3A9A",
      ring: "#E08AFF",
    },
  },
  // ---- Look 6 — Trading Dashboard
  {
    id: "TradingDashboard-Purple",
    file: "TradingDashboard_Purple",
    look: "dashboard",
    palette: {
      bg: "#0A0A20",
      screen: "#08081C",
      candle: "#E8E8FF",
      glow: "#8A6AFF",
      cards: ["#FF8AB0", "#B08AFF", "#F0E06A", "#FF9A7A"],
      text: "#C8C8F0",
      accent: "#FFA040",
      grid: "#5A5AB0",
      rows: "#6A5AC8",
    },
  },
  // ---- Look 7 — Night Chart
  {
    id: "NightChart-Gold",
    file: "NightChart_Gold",
    look: "nightChart",
    palette: {
      bg: "#000000",
      screen: "#010205",
      cell: "#1A2A40",
      lit: "#6A5AFF",
      line0: "#F0E06A",
      line1: "#FF9A3A",
      line2: "#B8E86A",
      text: "#5A7AA0",
    },
  },
];

export const buildLook = (v: Version, ctx: LookContext): LookInstance => {
  switch (v.look) {
    case "montage":
      return montage(ctx, v.palette);
    case "curvedWall":
      return curvedWall(ctx, v.palette);
    case "barRace":
      return barRace(ctx, v.palette);
    case "tickerLine":
      return tickerLine(ctx, v.palette);
    case "columnChart":
      return columnChart(ctx, v.palette);
    case "dashboard":
      return dashboard(ctx, v.palette);
    case "nightChart":
      return nightChart(ctx, v.palette);
  }
};
