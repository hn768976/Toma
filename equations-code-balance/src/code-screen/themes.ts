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
  /** Soft halo on code text (CSS text-shadow alpha). */
  codeGlow: number;
};

export const DARK: CodeTheme = {
  backdrop: "#071440",
  screen: "linear-gradient(160deg, #0a1d5c 0%, #0b2163 45%, #091a50 100%)",
  panel: "rgba(4, 10, 40, 0.45)",
  panelBorder: "rgba(150, 175, 255, 0.28)",
  editor: "rgba(6, 22, 80, 0.5)",
  gutterText: "#34427a",
  activeLine: "rgba(120, 140, 255, 0.10)",
  uiText: "#c9d2ff",
  uiMuted: "#6d79ad",
  accent: "#7c8cff",
  promptBar: "linear-gradient(90deg, rgba(40, 150, 255, 0.55), rgba(60, 200, 255, 0.6))",
  promptBorder: "rgba(140, 220, 255, 0.9)",
  promptText: "#eef8ff",
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
  aiGradient: ["#b9a4ff", "#7ef3ff"],
  aiGlow: 1.5,
  sphereDot: ["#7f86ff", "#b46cff"],
  sphereOpacity: 1,
  bloom: "rgba(80, 90, 255, 0.22)",
  grain: 0.022,
  codeGlow: 0.45,
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
  aiGradient: ["#6a45e0", "#1497b8"],
  aiGlow: 0.55,
  sphereDot: ["#4a4fe0", "#7a3fd6"],
  sphereOpacity: 0.85,
  bloom: "rgba(110, 90, 230, 0.16)",
  grain: 0.018,
  codeGlow: 0,
};
