import type { TokenKind } from "./code";

/** Colours for the two versions of AI Code Screen. Our own palette. */
export type CodeTheme = {
  backdrop: string; // behind the screen, outside the monitor
  screen: string; // screen background
  panel: string; // sidebar/card fill
  panelBorder: string;
  editor: string; // editor surface
  gutterText: string;
  activeLine: string;
  uiText: string;
  uiMuted: string;
  accent: string;
  promptBar: string;
  promptBorder: string;
  promptText: string;
  cursor: string;
  tokens: Record<TokenKind, string>;
  aiGradient: [string, string];
  aiGlow: number; // glow strength multiplier
  sphereDot: [string, string];
  sphereOpacity: number;
  bloom: string; // soft halo behind the AI mark
  grain: number;
};

export const DARK: CodeTheme = {
  backdrop: "#0a1f5e",
  screen: "linear-gradient(160deg, #12348a 0%, #0e2a78 50%, #0b2266 100%)",
  panel: "rgba(120, 140, 255, 0.07)",
  panelBorder: "rgba(150, 175, 255, 0.28)",
  editor: "rgba(8, 28, 96, 0.55)",
  gutterText: "#4c5888",
  activeLine: "rgba(120, 140, 255, 0.10)",
  uiText: "#c9d2ff",
  uiMuted: "#6d79ad",
  accent: "#7c8cff",
  promptBar: "linear-gradient(90deg, rgba(70, 80, 210, 0.55), rgba(120, 80, 230, 0.45))",
  promptBorder: "rgba(170, 160, 255, 0.85)",
  promptText: "#c7cdf5",
  cursor: "#d8ddff",
  tokens: {
    plain: "#f1f4ff",
    keyword: "#52eeb4",
    builtin: "#8ce6ff",
    self: "#ffffff",
    fn: "#52eeb4",
    cls: "#52eeb4",
    string: "#b9f3d9",
    number: "#9fe6ff",
    comment: "#7088cc",
    op: "#cbd4ff",
  },
  aiGradient: ["#8af5ff", "#ff6fd8"],
  aiGlow: 1.5,
  sphereDot: ["#9a7bff", "#e45cff"],
  sphereOpacity: 1,
  bloom: "rgba(170, 80, 255, 0.38)",
  grain: 0.022,
};

export const LIGHT: CodeTheme = {
  backdrop: "#e6e8ef",
  screen: "linear-gradient(160deg, #f7f8fb 0%, #f1f3f8 50%, #eceff5 100%)",
  panel: "rgba(40, 50, 110, 0.05)",
  panelBorder: "rgba(40, 50, 110, 0.13)",
  editor: "rgba(255, 255, 255, 0.92)",
  gutterText: "#a0a7bf",
  activeLine: "rgba(80, 90, 200, 0.07)",
  uiText: "#2a3152",
  uiMuted: "#8890ad",
  accent: "#5a5fd6",
  promptBar: "linear-gradient(90deg, #ffffff, #f3f1ff)",
  promptBorder: "rgba(90, 95, 214, 0.6)",
  promptText: "#6f7594",
  cursor: "#2a3152",
  tokens: {
    plain: "#1b2140",
    keyword: "#08875a",
    builtin: "#0a6c88",
    self: "#1b2140",
    fn: "#08875a",
    cls: "#08875a",
    string: "#2a7653",
    number: "#0a6c88",
    comment: "#8a91ad",
    op: "#475079",
  },
  aiGradient: ["#1497b8", "#c03aa8"],
  aiGlow: 0.55,
  sphereDot: ["#5a4fe0", "#c03aa8"],
  sphereOpacity: 0.85,
  bloom: "rgba(110, 90, 230, 0.16)",
  grain: 0.018,
};
