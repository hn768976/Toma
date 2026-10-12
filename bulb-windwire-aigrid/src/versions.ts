// One data row per version. Root.tsx turns each row into a <Composition>.
// To add a colourway: copy a row, give it a new id/file name and colours.
import type { BulbPalette } from "./looks/bulb/look";
import type { WindwirePalette } from "./looks/windwire/look";
import type { AigridPalette } from "./looks/aigrid/look";

export type Version =
  | { id: string; file: string; look: "bulb"; mode: "story" | "loop"; durationInFrames: number; palette: BulbPalette }
  | { id: string; file: string; look: "windwire"; durationInFrames: number; palette: WindwirePalette }
  | { id: string; file: string; look: "aigrid"; durationInFrames: number; palette: AigridPalette };

export const VERSIONS: Version[] = [
  {
    id: "PlexusBulb-BlueIgnite",
    file: "PlexusBulb_BlueIgnite",
    look: "bulb",
    mode: "story",
    durationInFrames: 450,
    palette: {
      filament: "#E8F4FF",
      envelope: "#7FC0FF",
      plexus: "#BFE0FF",
      haze: "#2A5AB8",
      bgDark: "#020A20",
      bgLight: "#0A2050",
      metal: "#5A78A8",
      spark: "#7FC4FF",
    },
  },
  {
    id: "PlexusBulb-GoldLoop",
    file: "PlexusBulb_GoldLoop",
    look: "bulb",
    mode: "loop",
    durationInFrames: 600,
    palette: {
      filament: "#FFE8B0",
      envelope: "#FFC870",
      plexus: "#FFD890",
      haze: "#B8701A",
      bgDark: "#140A02",
      bgLight: "#3A2008",
      metal: "#A88C5E",
      spark: "#FFC060",
    },
  },
  {
    id: "WireframeWindFarm-Teal",
    file: "WireframeWindFarm_Teal",
    look: "windwire",
    durationInFrames: 600,
    palette: { line: "#3AF0D8", terrain: "#2AA898", horizon: "#BFFFF0", bgTop: "#0A3A38", bgBottom: "#062420" },
  },
  {
    id: "WireframeWindFarm-Blue",
    file: "WireframeWindFarm_Blue",
    look: "windwire",
    durationInFrames: 600,
    palette: { line: "#5AC8FF", terrain: "#2A7AC8", horizon: "#BFE6FF", bgTop: "#061A3A", bgBottom: "#030C20" },
  },
  {
    id: "AIWindGrid-Blue",
    file: "AIWindGrid_Blue",
    look: "aigrid",
    durationInFrames: 600,
    palette: {
      grid: "#3A9AE8",
      turbine: "#5AC8FF",
      badge: "#DFF4FF",
      wave: "#6AD8FF",
      hud: "#A8D8FF",
      bgDeep: "#06143A",
      bgLight: "#0A2A6A",
    },
  },
];
