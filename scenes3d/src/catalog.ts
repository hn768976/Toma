import { LookFactory } from "./kit/Stage";
import { prepareCircuitTextures } from "./kit/circuit";
import { FibrePalette } from "./kit/fibreKit";
import { createFibreModelCheck } from "./looks/fibreModelCheck";
import { createChipCloud } from "./looks/chipCloud";
import { createFibreLayers } from "./looks/fibreLayers";
import { createGlassCubeField, GlassCubeFieldParams } from "./looks/glassCubeField";
import { createLedCubeWall, LedCubeWallParams } from "./looks/ledCubeWall";
import { createPlexusShells, PlexusShellsParams } from "./looks/plexusShells";

// One data row per version. To add a colourway, copy a row, give it a new
// id and change the colours.

type Row<P> = { id: string; factory: LookFactory<P>; params: P; prepare?: () => Promise<void> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = Row<any>;

const row = <P,>(r: Row<P>): AnyRow => r;

export const FIBRE_CYAN: FibrePalette = {
  fibre: "#3AF0F0",
  pulse: "#FFFFFF",
  fog: "#06304A",
  plate: "#0A2A4A",
  fogDensity: 0.06,
  plateEmissive: 0.45,
  fibreGain: 0.85,
  edge: 0.6,
  light: 0.6,
  bgTop: "#000306",
  bgBottom: "#0C4E86",
  collars: false,
  beads: 4,
  beadSize: 0.016,
  beadTint: 0.75,
  endDots: true,
  pool: 0.6,
  dashedEdge: true,
  circuitRepeat: 2,
};

export const FIBRE_VIOLET: FibrePalette = {
  ...FIBRE_CYAN,
  fibre: "#B08AFF",
  pulse: "#FFE6F6",
  fog: "#1A0A3A",
  plate: "#1A1440",
  bgTop: "#040209",
  bgBottom: "#3A1C7A",
};

export const CHIP_BLUE: FibrePalette = {
  fibre: "#4FE2FF",
  pulse: "#E8FCFF",
  fog: "#154676",
  plate: "#2A6ACA",
  fogDensity: 0.12,
  plateEmissive: 0.12,
  fibreGain: 0.8,
  edge: 0.25,
  light: 0.6,
  bgTop: "#1A4F80",
  bgBottom: "#0F3E6E",
  collars: false,
  beads: 4,
  beadSize: 0.012,
  beadTint: 0.85,
  endDots: true,
  pool: 0,
  dashedEdge: true,
  circuitRepeat: 1,
};

export const ROWS: AnyRow[] = [
  row<PlexusShellsParams>({
    id: "PlexusShells-TealOrange",
    factory: createPlexusShells,
    params: {
      nodeA: "#2AF0C8",
      nodeA2: "#22D8F0",
      nodeB: "#FF9A3A",
      link: "#2AC8B0",
      ring: "#9AF5E2",
      speck: "#FFF0A8",
      accentShare: 0.18,
    },
  }),
  row<LedCubeWallParams>({
    id: "LEDCubeWall-Blue",
    factory: createLedCubeWall,
    params: { block: "#0C5AC8", led: "#8AE8FF", seam: "#0A2E6A", key: 0.75, spec: 0.08 },
  }),
  row<LedCubeWallParams>({
    id: "LEDCubeWall-GraphiteAmber",
    factory: createLedCubeWall,
    params: { block: "#2A2C30", led: "#FFB04A", seam: "#18191C", key: 1.5, spec: 0.08 },
  }),
  row<GlassCubeFieldParams>({
    id: "GlassCubeField-Blue",
    factory: createGlassCubeField,
    params: { fill: "#0A2AB0", edge: "#5A8AFF", glow: "#1A4AFF" },
  }),
  row<GlassCubeFieldParams>({
    id: "GlassCubeField-Emerald",
    factory: createGlassCubeField,
    params: { fill: "#0A6A4A", edge: "#5AF0B0", glow: "#1AC87A" },
  }),
  row<FibrePalette>({
    id: "FibreLayers-Cyan",
    factory: createFibreLayers,
    params: FIBRE_CYAN,
    prepare: prepareCircuitTextures,
  }),
  row<FibrePalette>({
    id: "FibreLayers-Violet",
    factory: createFibreLayers,
    params: FIBRE_VIOLET,
    prepare: prepareCircuitTextures,
  }),
  row<FibrePalette>({
    id: "ChipCloud-Blue",
    factory: createChipCloud,
    params: CHIP_BLUE,
    prepare: prepareCircuitTextures,
  }),
];


// Development composition: one plate with two bundles (kit model check).
export const DEV_ROWS: AnyRow[] = [
  row<FibrePalette>({
    id: "Dev-FibreModelCheck",
    factory: createFibreModelCheck,
    params: FIBRE_CYAN,
    prepare: prepareCircuitTextures,
  }),
];
