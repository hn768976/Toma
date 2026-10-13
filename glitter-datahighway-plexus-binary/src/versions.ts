// One data row per version. To add a colourway, copy a row, give it a new
// id and change the colours. Root.tsx registers every row as a composition.
import type { BinaryVersion } from "./looks/binary";
import type { GlitterVersion } from "./looks/glitter/particles";
import type { HighwayVersion } from "./looks/highway";
import type { LowPolyVersion } from "./looks/lowPoly";
import type { PlexusLandscapeVersion } from "./looks/plexusLandscape";

export const HIGHWAY: { id: string; v: HighwayVersion }[] = [
  {
    id: "DataHighway-Multicolour",
    v: {
      colors: [[40, "#2A6AFF"], [25, "#3AD8F8"], [15, "#2AE8B8"], [10, "#FF8A3A"], [5, "#FF6AC8"], [5, "#FFFFFF"]],
      horizon: "#E8F4FF",
      haze: "#5AA8FF",
      unlit: "#0A1238",
    },
  },
];

export const PLEXUS_LANDSCAPE: { id: string; v: PlexusLandscapeVersion }[] = [
  {
    id: "PlexusLandscape-BlueAmber",
    v: {
      nodes: [[75, "#3A8AFF"], [18, "#FFB04A"], [7, "#FFFFFF"]],
      link: "#3A6ACA",
      linkAlpha: 0.3,
      horizon: "#0A1A4A",
    },
  },
];

export const LOW_POLY: { id: string; v: LowPolyVersion }[] = [
  {
    id: "LowPolyPlexus-Blue",
    v: { line: "#3A8AFF", lineAlpha: 0.55, facet: "#3AC8FF", node: "#8AC8FF", bgTop: "#04082A", bgBottom: "#0A1A6A" },
  },
  {
    id: "LowPolyPlexus-Violet",
    v: { line: "#8A5AFF", lineAlpha: 0.55, facet: "#C08AFF", node: "#D2B8FF", bgTop: "#0E0428", bgBottom: "#2A0A5A" },
  },
];

export const BINARY: { id: string; v: BinaryVersion }[] = [
  { id: "BinaryPlane-Blue", v: { head: "#E8FFFF", tail: "#3AC8FF", dim: "#1A4A8A" } },
  { id: "BinaryPlane-Green", v: { head: "#E8FFE8", tail: "#3AF06A", dim: "#0A3A1A" } },
];

export const GLITTER: { id: string; v: GlitterVersion }[] = [
  {
    id: "GlitterVortex-Gold",
    v: { glitter: [[34, "#F8E0A0"], [34, "#E8B860"], [24, "#FFF4D8"], [8, "#B07A2A"]], haze: "#8A5A24", hazeCore: "#C89048" },
  },
  {
    id: "GlitterVortex-Silver",
    v: { glitter: [[34, "#F0F4FF"], [34, "#C8D0E0"], [24, "#FFFFFF"], [8, "#8AA8E0"]], haze: "#4A5A78", hazeCore: "#8A9AB8" },
  },
];
