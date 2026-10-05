/*
 * One data row per version. To add a colourway, add a row here and a
 * <Composition> line in Root.tsx (see README "Adding a colourway").
 */

export type CircuitVersion = {
  id: string;
  board: string; // board base colour
  trace: string; // trace metal colour
  pulse: string; // pulse / glow colour
  core: string; // pulse core (near white)
  haze: string; // atmospheric haze toward the horizon
};

export type HoloVersion = {
  id: string;
  point: string; // main points / lines
  accent: string; // accent points (rings, windows)
  glass: string; // translucent tower fill
  floor: string;
  fog: string;
};

export type RibbonsVersion = {
  id: string;
  bgTop: string;
  bgNear: string;
  bands: [string, string, string, string];
  flash: string;
};

export const CIRCUIT_VERSIONS: CircuitVersion[] = [
  { id: "CircuitChip-Blue", board: "#020A1E", trace: "#0E3A8A", pulse: "#6FB8FF", core: "#FFFFFF", haze: "#06183A" },
  { id: "CircuitChip-Gold", board: "#0C0702", trace: "#5A3A10", pulse: "#FFC060", core: "#FFF4E0", haze: "#24150A" },
];

export const HOLO_VERSIONS: HoloVersion[] = [
  { id: "HoloCity-Green", point: "#3AFF6A", accent: "#5FFFC8", glass: "#0A3A1A", floor: "#020A04", fog: "#04140A" },
  { id: "HoloCity-Blue", point: "#3AA8FF", accent: "#8FE0FF", glass: "#0A1E3A", floor: "#02060E", fog: "#040C1C" },
];

export const RIBBONS_VERSIONS: RibbonsVersion[] = [
  { id: "NeonRibbons-Purple", bgTop: "#0E0828", bgNear: "#2A1050", bands: ["#2FE0FF", "#3A6BFF", "#8A3AFF", "#FF3AD8"], flash: "#FF3AD8" },
  { id: "NeonRibbons-Gold", bgTop: "#140804", bgNear: "#3A1A08", bands: ["#FFF0C8", "#FFD27A", "#FF9A3A", "#FF5A2A"], flash: "#FF5A2A" },
];
