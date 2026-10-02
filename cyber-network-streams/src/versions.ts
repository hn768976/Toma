// One data row per version. To add a version, add a row here; Root.tsx
// registers a composition for every row automatically.

export type CyberFlythroughVersion = {
  id: string;
  teal: string;
  blue: string;
  bgTop: string; // horizon / upper background
  bgBottom: string; // near-black floor side
};
export const cyberFlythroughVersions: CyberFlythroughVersion[] = [
  { id: "CyberFlythrough", teal: "#3FE8D8", blue: "#2A7BD8", bgTop: "#062448", bgBottom: "#020B1A" },
];

export type NetworkHubVersion = {
  id: string;
  theme: "dark" | "light";
  floor: string;
  floorEdge: string;
  node: string;
  line: string;
  glow: number; // glow multiplier
  shadow: number; // contact-shadow strength 0..1
};
export const networkHubVersions: NetworkHubVersion[] = [
  { id: "NetworkHub-DarkBlue", theme: "dark", floor: "#16304A", floorEdge: "#050C16", node: "#2A6AD8", line: "#4FE0FF", glow: 1, shadow: 0.55 },
  { id: "NetworkHub-Light", theme: "light", floor: "#EEF2F6", floorEdge: "#B9C2CC", node: "#2A6AD8", line: "#1F8AD8", glow: 0.45, shadow: 0.7 },
];

export type LightStreamsVersion = {
  id: string;
  panel: string;
  panelBright: string;
  bg: string;
};
export const lightStreamsVersions: LightStreamsVersion[] = [
  { id: "LightStreams-Blue", panel: "#2A6AFF", panelBright: "#4FD8FF", bg: "#020818" },
  { id: "LightStreams-Amber", panel: "#FF8A2A", panelBright: "#FFD27A", bg: "#120602" },
];

export type DataBurstVersion = {
  id: string;
  bg: string;
  teal: string;
  white: string;
  pink: string;
  orange: string;
  blue: string;
  green: string;
};
export const dataBurstVersions: DataBurstVersion[] = [
  { id: "DataBurst", bg: "#03102A", teal: "#2FE4E0", white: "#EAF4FF", pink: "#FF6F8E", orange: "#FFC247", blue: "#2F6BFF", green: "#7DFF6A" },
];

export type FibreStrandsVersion = {
  id: string;
  strandDeep: string;
  strandLight: string;
  head: string;
  backLight: string;
};
export const fibreStrandsVersions: FibreStrandsVersion[] = [
  { id: "FibreStrands-Blue", strandDeep: "#4F8CFF", strandLight: "#BFE0FF", head: "#8FF3FF", backLight: "#1E5BFF" },
  { id: "FibreStrands-Gold", strandDeep: "#FFA040", strandLight: "#FFE0A0", head: "#FFE6B8", backLight: "#FF7A1E" },
];

export type BigDataHudVersion = {
  id: string;
  palette: string[]; // red, orange, yellow, green, cyan, blue, magenta, violet
  text: string;
  dim: string;
};
export const bigDataHudVersions: BigDataHudVersion[] = [
  {
    id: "BigDataHUD",
    palette: ["#F01E1E", "#FF6A00", "#FFD000", "#00B050", "#00B4FF", "#1E5BFF", "#FF1FA0", "#8A3CFF"],
    text: "#FFFFFF",
    dim: "#8A8F99",
  },
];
