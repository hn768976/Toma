import type { Status } from "./data";

export type ColumnSpec = {
  /** Left edge and width as fractions of the frame width. */
  left: number;
  width: number;
  align: "left" | "center" | "right";
  label: string;
};

export type BoardTheme = {
  mode: "lcd" | "flap";
  /** CSS background painted across the whole board. */
  surface: string;
  statusColor: Record<Status, string>;
  uppercase: boolean;
  fontFamily: string;
  /** Every metric is a fraction of the frame width or height, so the 1080p
   *  preview is pixel-for-pixel the same layout as the 4K render. */
  metrics: Record<string, number>;
  lcd?: {
    title: string;
    titleColor: string;
    columnHeaderColor: string;
    textColor: string;
    rowTint: [string, string];
    columns: Record<string, ColumnSpec>;
  };
  flap?: {
    fieldColor: Record<string, string>;
    cellFace: string;
    cellHighlight: string;
    cellShadow: string;
    separator: string;
    divider: string;
  };
};

const MONO = "'Roboto Mono', 'DejaVu Sans Mono', monospace";
const FLAP_MONO = "'Space Mono', 'Roboto Mono', monospace";

export const LCD_THEME: BoardTheme = {
  mode: "lcd",
  surface: "linear-gradient(180deg, #124bc4 0%, #0b3a9e 42%, #072b78 100%)",
  fontFamily: MONO,
  uppercase: false,
  statusColor: {
    "ON TIME": "#2ee06a",
    BOARDING: "#2ee06a",
    "CHECK IN": "#ffffff",
    "LAST CALL": "#ffb02e",
    "GATE CLOSED": "#ff4d5a",
    DELAYED: "#ffb02e",
    CANCELLED: "#ff4d5a",
  },
  metrics: {
    titleY: 0.084,
    titleSize: 0.070,
    planeLeft: 0.083,
    planeSize: 0.072,
    titleLeft: 0.170,
    columnHeaderY: 0.176,
    columnHeaderSize: 0.0335,
    rowsTop: 0.225,
    rowHeight: 0.0630,
    rowFontSize: 0.0385,
  },
  lcd: {
    title: "International Departures",
    titleColor: "#ffffff",
    columnHeaderColor: "#8ab5ff",
    textColor: "#ffffff",
    rowTint: ["rgba(255,255,255,0.085)", "rgba(0,0,0,0.045)"],
    columns: {
      flight: { left: 0.068, width: 0.100, align: "center", label: "FLIGHT" },
      time: { left: 0.194, width: 0.100, align: "center", label: "TIME" },
      destination: { left: 0.320, width: 0.250, align: "left", label: "DESTINATION" },
      gate: { left: 0.573, width: 0.087, align: "right", label: "GATE" },
      remarks: { left: 0.706, width: 0.232, align: "left", label: "REMARKS" },
    },
  },
};

export const FLAP_THEME: BoardTheme = {
  mode: "flap",
  surface: "#0a0a0a",
  fontFamily: FLAP_MONO,
  uppercase: true,
  statusColor: {
    "ON TIME": "#f2f2f2",
    BOARDING: "#f5c518",
    "CHECK IN": "#f2f2f2",
    "LAST CALL": "#f5c518",
    "GATE CLOSED": "#ff3b30",
    DELAYED: "#ff8a2b",
    CANCELLED: "#ff3b30",
  },
  metrics: {
    /** Cell grid. Widths are in cell units and resolved against the frame. */
    sideMargin: 1.0,
    centreGap: 1.6,
    fieldGap: 0.85,
    cellWidthRatio: 0.86,
    cellHeight: 0.0400,
    rowPitch: 0.0556,
    fontSize: 0.0235,
  },
  flap: {
    fieldColor: {
      flight: "#ffffff",
      time: "#f5c518",
      destination: "#f5c518",
    },
    cellFace: "linear-gradient(180deg, #232323 0%, #171717 46%, #0e0e0e 52%, #1a1a1a 100%)",
    cellHighlight: "rgba(255,255,255,0.13)",
    cellShadow: "rgba(0,0,0,0.75)",
    separator: "rgba(255,255,255,0.05)",
    divider: "rgba(255,255,255,0.06)",
  },
};
