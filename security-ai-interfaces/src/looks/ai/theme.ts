// Looks 3 and 5 palettes (shared). "accent" is used for highlights only:
// selection, gauges, globe, network pulses, active states. Body text and
// code stay grey in both versions.
export type AiTheme = {
  name: "mono" | "blue";
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  borderHi: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string; // highlights
  accentText: string; // text drawn ON accent elements
  accentSoftOpacity: number; // highlight fill strength
  green: string;
  globeLand: string;
  globeSea: string;
  code: { kw: string; type: string; str: string; num: string; com: string; plain: string; punct: string };
};

const CODE_GREYS = {
  kw: "#f1f3f5",
  type: "#c7ccd2",
  str: "#9aa1a9",
  num: "#b8bec5",
  com: "#5e656d",
  plain: "#aeb4bb",
  punct: "#7d848c",
};

export const AI_MONO: AiTheme = {
  name: "mono",
  bg: "#08090b",
  panel: "#0e1013",
  panelAlt: "#15181c",
  border: "#262a30",
  borderHi: "#3a4048",
  text: "#e7e9ec",
  textDim: "#8c939b",
  textFaint: "#5b6168",
  accent: "#f2f4f6",
  accentText: "#08090b",
  accentSoftOpacity: 0.08,
  green: "#39d98a",
  globeLand: "#e9edf1",
  globeSea: "#7d858e",
  code: CODE_GREYS,
};

export const AI_BLUE: AiTheme = {
  ...AI_MONO,
  name: "blue",
  accent: "#2f8dff",
  accentText: "#ffffff",
  accentSoftOpacity: 0.14,
  globeLand: "#6fb4ff",
  globeSea: "#2f6fc4",
};
