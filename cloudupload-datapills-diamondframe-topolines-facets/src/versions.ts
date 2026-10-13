import type { CloudParams } from "./looks/cloud";
import type { DataPillsParams } from "./looks/datapills";
import type { DiamondsParams } from "./looks/diamonds";
import type { FacetsParams } from "./looks/facets";
import type { TopoParams } from "./looks/topo";

/**
 * One data row per version. To add a colourway, copy a row, give it a new
 * id and change its colours; Root.tsx registers every row as a composition.
 * Composition ids use "-" (Remotion forbids "_"); the deliverable file name
 * is the id with "-" replaced by "_" (e.g. TopoLines_Silver.mp4).
 */
export type Version =
  | { id: string; look: "topo"; background: string; params: TopoParams }
  | { id: string; look: "facets"; background: string; params: FacetsParams }
  | { id: string; look: "diamonds"; background: string; params: DiamondsParams }
  | { id: string; look: "datapills"; background: string; params: DataPillsParams }
  | { id: string; look: "cloud"; background: string; params: CloudParams };

export const VERSIONS: Version[] = [
  {
    id: "CloudUpload-Blue",
    look: "cloud",
    background: "#04102A",
    params: { accent: "#3FD8FF", glow: "#1C8CFF", background: "#04102A", haze: "#0A3A8A", trace: "#2A7CFF" },
  },
  {
    id: "DataPills-Blue",
    look: "datapills",
    background: "#020A24",
    params: { capsule: "#5AC8FF", line: "#3A8AFF", background: "#020A24", haze: "#1E6AD8" },
  },
  {
    id: "DataPills-Amber",
    look: "datapills",
    background: "#140804",
    params: { capsule: "#FFC86A", line: "#FF8A2A", background: "#140804", haze: "#D8701E" },
  },
  {
    id: "DiamondFrames-BlackGold",
    look: "diamonds",
    background: "#050506",
    params: { edge: "#E8B860", glitter: "#FFE0A0", background: "#050506" },
  },
  {
    id: "DiamondFrames-BlackSilver",
    look: "diamonds",
    background: "#050506",
    params: { edge: "#D8DEE8", glitter: "#FFFFFF", background: "#050506" },
  },
  {
    id: "TopoLines-Silver",
    look: "topo",
    background: "#000000",
    params: { line: "#F0F4FF", glow: "#9AA3B4", sparkle: "#FFFFFF" },
  },
  {
    id: "TopoLines-Cyan",
    look: "topo",
    background: "#000000",
    params: { line: "#8AF8FF", glow: "#2AC8E8", sparkle: "#E8FEFF" },
  },
  {
    id: "FacetedRelief-MidnightBlue",
    look: "facets",
    background: "#03050B",
    params: { metal: "#141A2E", strip: "#F6F0E6", key: "#9FB4FF", background: "#03050B" },
  },
];
