// One data row per version. Add a colourway by adding a row (see README).
// Composition ids use "-" (Remotion forbids "_"); output files use "_".
import type { AuroraParams } from "./looks/aurora/Aurora";
import type { BrainParams } from "./looks/brain/Brain";
import type { StarDiscParams } from "./looks/stardisc/StarDisc";
import type { DiatomParams } from "./looks/diatoms/Diatoms";
import type { SatParams } from "./looks/satellites/SatelliteNetwork";

export type Row =
  | { id: string; look: "brain"; params: BrainParams }
  | { id: string; look: "aurora"; params: AuroraParams }
  | { id: string; look: "stardisc"; params: StarDiscParams }
  | { id: string; look: "diatoms"; params: DiatomParams }
  | { id: string; look: "satellites"; params: SatParams };

export const ROWS: Row[] = [
  {
    id: "BrainXRay-Gold",
    look: "brain",
    params: { signal: "#FFC85A", core: "#FFFFFF", burst: "#FFB040" },
  },
  {
    id: "BrainXRay-Cyan",
    look: "brain",
    params: { signal: "#C8FFFF", core: "#FFFFFF", burst: "#5AB8FF" },
  },
  {
    id: "SatelliteNetwork-Blue",
    look: "satellites",
    params: { shot: "wide", tint: "#9CCBFF", rim: "#2F8BFF", link: "#CFE6FF", satellites: 96 },
  },
  {
    id: "SatelliteNetwork-Close",
    look: "satellites",
    params: { shot: "close", tint: "#9CCBFF", rim: "#2F8BFF", link: "#CFE6FF", satellites: 60 },
  },
  {
    id: "Aurora-Green",
    look: "aurora",
    params: { green: "#3AF06A", edge: "#C8FFC8", top: "#C878B0", topMix: 0.6, brightness: 3.3 },
  },
  {
    id: "Aurora-VioletGreen",
    look: "aurora",
    params: { green: "#3AF06A", edge: "#C8FFC8", top: "#C86AE8", topMix: 0.9, brightness: 3.3 },
  },
  {
    id: "StarDisc-Orange",
    look: "stardisc",
    params: { core: "#FFD8A0", glow: "#FF8A3A", dust: "#C9CED8", particles: 200000 },
  },
  {
    id: "Diatoms-BrightField",
    look: "diatoms",
    params: { field: "#D8DCDA", objects: 600 },
  },
];
