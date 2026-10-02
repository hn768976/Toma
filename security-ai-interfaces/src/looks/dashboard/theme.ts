// Look 1 palettes. Edit colours here; layout and motion are shared.
export type DashTheme = {
  name: "dark" | "light";
  bg: string;
  panel: string;
  panelAlt: string; // inset fields, bar tracks
  border: string;
  bracket: string; // corner accents
  accent: string;
  accent2: string;
  accentSoft: string; // fills under charts / highlights
  red: string;
  redPanel: string;
  amber: string;
  green: string;
  text: string;
  textDim: string;
  track: string;
  mapLand: string;
  mapEdge: string;
  grid: string;
  glow: boolean; // neon halos (dark only)
  shadow: boolean; // soft panel shadows (light only)
  grain: number;
};

export const DASH_DARK: DashTheme = {
  name: "dark",
  bg: "#04080a",
  panel: "#081216",
  panelAlt: "#0c1c21",
  border: "#163a40",
  bracket: "#1fd1c1",
  accent: "#22d6c6",
  accent2: "#3aa8ff",
  accentSoft: "#22d6c6",
  red: "#ff3b4c",
  redPanel: "#18070a",
  amber: "#ffb431",
  green: "#2fe08a",
  text: "#d5ecec",
  textDim: "#6e9296",
  track: "#13292e",
  mapLand: "#0f2c33",
  mapEdge: "#1d5560",
  grid: "#0f2328",
  glow: true,
  shadow: false,
  grain: 0,
};

export const DASH_LIGHT: DashTheme = {
  name: "light",
  bg: "#f1f4f5", // grain overlay darkens the page ~1 %, so start a touch lighter
  panel: "#ffffff",
  panelAlt: "#f3f6f7",
  border: "#d3dbde",
  bracket: "#0b7f78",
  accent: "#0b7f78",
  accent2: "#1f6fbf",
  accentSoft: "#0b7f78",
  red: "#d42639",
  redPanel: "#fff2f3",
  amber: "#c77c00",
  green: "#178a50",
  text: "#283438",
  textDim: "#6c7b80",
  track: "#e3e9eb",
  mapLand: "#dbe5e7",
  mapEdge: "#b6c7cb",
  grid: "#edf1f2",
  glow: false,
  shadow: true,
  grain: 0.015,
};
