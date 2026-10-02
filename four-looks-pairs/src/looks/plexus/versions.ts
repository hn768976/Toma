/** One row per version. */
export type PlexusVersion = {
  id: string;
  /** Node colours with relative weights. */
  nodes: Array<{ color: string; weight: number }>;
  link: string;
  linkAlpha: number;
  bgCenter: string;
  bgEdge: string;
};

export const PLEXUS_VERSIONS: PlexusVersion[] = [
  {
    id: "PlexusSphere-BlueViolet",
    nodes: [
      { color: "#BFD3FF", weight: 0.6 }, // pale blue
      { color: "#6A86E8", weight: 0.32 }, // blue
      { color: "#9A6CFF", weight: 0.08 }, // violet accents
    ],
    link: "#B4C8FF",
    linkAlpha: 0.42,
    bgCenter: "#1E2530",
    bgEdge: "#11161E",
  },
  {
    id: "PlexusSphere-TealWhite",
    nodes: [
      { color: "#EAFBFF", weight: 0.58 }, // white
      { color: "#3FC8C0", weight: 0.34 }, // teal
      { color: "#7DF5F0", weight: 0.08 }, // aqua accents
    ],
    link: "#A6ECE6",
    linkAlpha: 0.4,
    bgCenter: "#1A2630",
    bgEdge: "#0D151C",
  },
];
