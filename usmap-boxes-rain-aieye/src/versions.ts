// One data row per version. Root.tsx registers a composition for each row.
import type { EyePalette } from "./eye/eyePipeline";
import type { MapPalette } from "./usmap/mapPipeline";
import type { RainPalette } from "./rain/rainPipeline";
import type { BoxesPalette } from "./boxes/boxesPipeline";

export const BOXES_VERSIONS: { id: string; palette: BoxesPalette }[] = [
  {
    id: "CardboardBoxes-Kraft",
    palette: { haze: "#F4E8D4", key: "#FFE6C4", sky: "#E8EEF4", ground: "#A07850", floor: "#0A0603" },
  },
];

export const RAIN_VERSIONS: { id: string; palette: RainPalette }[] = [
  {
    id: "ParticleRainStage-Teal",
    palette: {
      rainA: "#5AC8D8", rainB: "#BFF4FF", poolCore: "#9AF0FF", poolGlow: "#2E9CD0",
      sparkleA: "#FFFFFF", sparkleB: "#A8F0FF", bgTop: "#020A12", bgMid: "#0A2A3A",
    },
  },
  {
    id: "ParticleRainStage-Gold",
    palette: {
      rainA: "#E8B04A", rainB: "#FFE8B0", poolCore: "#FFD88A", poolGlow: "#D89A3A",
      sparkleA: "#FFFFFF", sparkleB: "#FFE6A8", bgTop: "#0E0804", bgMid: "#2A1A0A",
    },
  },
];

export const US_MAP_VERSIONS: { id: string; palette: MapPalette }[] = [
  {
    id: "USMap-WhiteAssemble",
    palette: {
      top: "#F2F4F6", sides: "#C8CCD2", edge: "#7E858E", edgeOpacity: 1.0,
      bgCenter: "#FAFBFC", bgEdge: "#E4E8EC",
      shadowColor: "#7C8896", shadowStrength: 1.0,
      keyIntensity: 0.72, fillIntensity: 0.18, envIntensity: 0.44,
      rimIntensity: 0, rimColor: "#7AA8D8", vignette: 0.02,
    },
  },
  {
    id: "USMap-GraphiteAssemble",
    palette: {
      top: "#3A3F46", sides: "#24282E", edge: "#7AA8D8", edgeOpacity: 0.6,
      bgCenter: "#14171C", bgEdge: "#0A0C10",
      shadowColor: "#000000", shadowStrength: 0.85,
      keyIntensity: 1.5, fillIntensity: 0.2, envIntensity: 0.35,
      rimIntensity: 2.2, rimColor: "#7AA8D8", vignette: 0.12,
    },
  },
];

export const AI_EYE_VERSIONS: { id: string; palette: EyePalette }[] = [
  {
    id: "AIEye-Blue",
    palette: {
      bgTop: "#06102A",
      bgBottom: "#0A1A3A",
      scleraCenter: "#DFF0FF",
      scleraEdge: "#9AC0E0",
      dots: "#7CCFA0",
      ring: "#3A7AD8",
      rim: "#BFE6FF",
    },
  },
];
