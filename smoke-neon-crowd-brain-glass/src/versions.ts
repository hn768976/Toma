/**
 * One data row per version. To add a colourway, copy a row, give it a new
 * `id`, and change the colours — Root.tsx registers a composition per row.
 */

export type GlitterSmokeColors = {
  smoke: string; // main smoke tint
  smokeEdge: string; // brighter edge / highlight tint
  bgDeep: string; // background deep tone
  glitter: { color: string; weight: number }[]; // speck palette (weights are relative)
};

export type NeonColors = { a: string; b: string; bg: string };

export type CrowdColors = { crowd: string; glow: string; bg: string };

export type BrainColors = { glow: string; surface: string };

export type GlassColors = {
  tintA: string; // main tint
  tintB: string; // secondary tint
  white: string;
  background: string;
  iridescence: [string, string];
};

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const glitterSmokeVersions: { id: string; colors: GlitterSmokeColors }[] = [
  {
    id: "GlitterSmoke-Blue",
    colors: {
      smoke: "#7F9AC8",
      smokeEdge: "#C9D8F2",
      bgDeep: "#050A1C",
      glitter: [
        { color: "#FFC85A", weight: 4 }, // gold
        { color: "#FF8FBE", weight: 3 }, // pink
        { color: "#FFFFFF", weight: 1.2 }, // white
        { color: "#6FE6E0", weight: 0.7 }, // teal
      ],
    },
  },
  {
    id: "GlitterSmoke-VioletGold",
    colors: {
      smoke: "#9A7CD8",
      smokeEdge: "#DCCBFA",
      bgDeep: "#0B0620",
      glitter: [
        { color: "#FFC95C", weight: 5 }, // gold
        { color: "#FF8FC0", weight: 3 }, // pink
        { color: "#FFF4DE", weight: 1.2 }, // warm white
      ],
    },
  },
];

export const neonVersions: { id: string; colors: NeonColors }[] = [
  { id: "NeonPolygonFrame", colors: { a: "#4FB8FF", b: "#E040FF", bg: "#0A0620" } },
];

export const crowdVersions: { id: string; colors: CrowdColors }[] = [
  { id: "CrowdSpotlight-Blue", colors: { crowd: "#4A6A9A", glow: "#5FE8FF", bg: "#050A1E" } },
  { id: "CrowdSpotlight-Gold", colors: { crowd: "#6A6E76", glow: "#FFC860", bg: "#0C0907" } },
];

export const brainVersions: { id: string; colors: BrainColors }[] = [
  { id: "AIBrainPaths", colors: { glow: "#4FE8FF", surface: "#0E2A5A" } },
];

export const glassVersions: { id: string; colors: GlassColors }[] = [
  {
    id: "GlassTwist-IceBlue",
    colors: {
      tintA: "#9FC8F0",
      tintB: "#C9DDF6",
      white: "#F4F7FC",
      background: "#EEF2F8",
      iridescence: ["#B7A8F5", "#9FE6F0"],
    },
  },
  {
    id: "GlassTwist-Blush",
    colors: {
      tintA: "#F0C0C8",
      tintB: "#F8D2BC", // peach
      white: "#FCF6F4",
      background: "#F8F0EE",
      iridescence: ["#F5B0D8", "#FFD9A8"],
    },
  },
];
