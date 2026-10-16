// One data row per version. Composition ids use a hyphen (Remotion forbids
// underscores); rendered files use an underscore: DataMap-Blue -> DataMap_Blue.mp4.
// Root.tsx registers a 3840x2160, 30fps,
// 600-frame composition for every row. To add a colourway, copy a row,
// give it a new id and change the colours (see README).

export type DataMapRow = {
  id: string;
  look: "datamap";
  seed: number;
  bgTop: string;
  bgBottom: string;
  tag: string;
  highlight: string;
  accent: string;
};

export type PlexusRow = {
  id: string;
  look: "plexus";
  seed: number;
  bgTop: string;
  bgBottom: string;
  line: string;
  tag: string;
};

export type CircuitWarpRow = {
  id: string;
  look: "circuitwarp";
  seed: number;
  bgEdge: string;
  bgCenter: string;
  dim: string;
  bright: string;
};

export type SoftGradientRow = {
  id: string;
  look: "softgradient";
  seed: number;
  base: string;
  baseWeight: number;
  warp: number;
  power: number; // weight exponent: higher = purer colour regions
  lift: number; // 0..1 airy white swirl
  grain: number;
  // radius = gaussian sigma in frame heights; weight = blend strength;
  // at = optional anchor (0..1 of frame width/height); drift scales the path.
  // angle (degrees) + stretch elongate a blob along a direction.
  blobs: { color: string; radius: number; weight: number; at?: [number, number]; drift?: number; angle?: number; stretch?: number }[];
};

export type WirePeaksRow = {
  id: string;
  look: "wirepeaks";
  seed: number;
  bg: string;
  bgTop: string;
  mesh: string;
  numbers: string;
  glow: number; // 0 = none
  meshAlpha: number;
};

export type VersionRow = DataMapRow | PlexusRow | CircuitWarpRow | SoftGradientRow | WirePeaksRow;

export const VERSIONS: VersionRow[] = [
  {
    id: "DataMap-Blue",
    look: "datamap",
    seed: 1059,
    bgTop: "#0A2244",
    bgBottom: "#06142E",
    tag: "#C8E0FF",
    highlight: "#FFFFFF",
    accent: "#A8F0FF",
  },
  {
    id: "PlexusGlobe-Navy",
    look: "plexus",
    seed: 1937,
    bgTop: "#04082A",
    bgBottom: "#0A0E3A",
    line: "#E8ECF8",
    tag: "#FFFFFF",
  },
  {
    id: "CircuitWarp-Violet",
    look: "circuitwarp",
    seed: 2183,
    bgEdge: "#0A0A3A",
    bgCenter: "#04041A",
    dim: "#7A7AFF",
    bright: "#E8E8FF",
  },
  {
    id: "SoftGradient-Lime",
    look: "softgradient",
    seed: 4028,
    base: "#FFF46A",
    baseWeight: 0.5,
    warp: 0.1,
    power: 2.0,
    lift: 0.36,
    grain: 0.01,
    // at: [x, y] in 0..1 of the frame, y measured from the bottom.
    blobs: [
      { color: "#C8F05A", radius: 0.24, weight: 1.6, at: [0.74, 0.3], angle: 20, stretch: 1.25 },
      { color: "#7AF0B0", radius: 0.25, weight: 2.4, at: [0.97, 0.36], drift: 0.5, angle: 90, stretch: 1.5 },
      { color: "#7AE8D8", radius: 0.14, weight: 1.1, at: [0.65, 0.7], drift: 0.6, angle: 25, stretch: 1.3 },
      { color: "#F0C890", radius: 0.09, weight: 0.3, at: [0.35, 0.22], drift: 0.6 },
      { color: "#C8B8E0", radius: 0.08, weight: 0.3, at: [0.56, 0.62], drift: 0.6 },
      { color: "#FFF46A", radius: 0.15, weight: 1.0, at: [0.03, 0.55], drift: 0.4, angle: 90, stretch: 1.6 },
    ],
  },
  {
    id: "SoftGradient-Peach",
    look: "softgradient",
    seed: 4029,
    base: "#FFE0C8",
    baseWeight: 0.5,
    warp: 0.11,
    power: 1.7,
    lift: 0.36,
    grain: 0.01,
    blobs: [
      { color: "#FFA08A", radius: 0.24, weight: 1.2, at: [0.78, 0.34], angle: 35, stretch: 1.5 },
      { color: "#FFB8D0", radius: 0.24, weight: 1.1, at: [0.3, 0.7], angle: -25, stretch: 1.6 },
      { color: "#D0B8F0", radius: 0.2, weight: 1.0, at: [0.66, 0.76], angle: 30, stretch: 1.8 },
      { color: "#FFE89A", radius: 0.26, weight: 0.9, at: [0.22, 0.25] },
      { color: "#B8F0D8", radius: 0.12, weight: 0.5, at: [0.92, 0.85], drift: 0.6 },
      { color: "#FFE0C8", radius: 0.3, weight: 1.0, at: [0.5, 0.45] },
    ],
  },
  {
    id: "WirePeaks-White",
    look: "wirepeaks",
    seed: 1056,
    bg: "#141418",
    bgTop: "#141418",
    mesh: "#E8E8EC",
    numbers: "#FFFFFF",
    glow: 0,
    meshAlpha: 0.42,
  },
  {
    id: "WirePeaks-Cyan",
    look: "wirepeaks",
    seed: 1056,
    bg: "#04101E",
    bgTop: "#061829",
    mesh: "#4AD8F0",
    numbers: "#C8F4FF",
    glow: 0.9,
    meshAlpha: 0.42,
  },
];
