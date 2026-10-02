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
  backdrop: "#03050f",
  screen: "linear-gradient(160deg, #0d1c5a 0%, #0a1648 45%, #08113a 100%)",
  panel: "rgba(120, 140, 255, 0.07)",
  panelBorder: "rgba(140, 160, 255, 0.16)",
  editor: "rgba(8, 18, 66, 0.75)",
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
    plain: "#d6dcf5",
    keyword: "#b58cff",
    builtin: "#5fd0e8",
    self: "#f08fb8",
    fn: "#7cc4ff",
    cls: "#ffcf7a",
    string: "#9fe39a",
    number: "#ffa77a",
    comment: "#5f6a99",
    op: "#9aa6d8",
  },
  aiGradient: ["#5fe6ff", "#b48bff"],
  aiGlow: 1,
  sphereDot: ["#8a7dff", "#c06bff"],
  sphereOpacity: 1,
  bloom: "rgba(110, 120, 255, 0.35)",
  grain: 0.022,
};

export const LIGHT: CodeTheme = {
  backdrop: "#c9ccd6",
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
    plain: "#252b45",
    keyword: "#7a3fd6",
    builtin: "#0b7f99",
    self: "#c23a76",
    fn: "#1f63c4",
    cls: "#a3650a",
    string: "#2b8a2e",
    number: "#c4521c",
    comment: "#8c93ad",
    op: "#5a6286",
  },
  aiGradient: ["#1497b8", "#6a45e0"],
  aiGlow: 0.55,
  sphereDot: ["#1497b8", "#6a45e0"],
  sphereOpacity: 0.85,
  bloom: "rgba(110, 90, 230, 0.16)",
  grain: 0.018,
};
