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
  plateEmissive: 0.4,
  fibreGain: 0.85,
  edge: 0.6,
  light: 1.0,
  bgTop: "#000306",
  bgBottom: "#0C4E86",
  collars: false,
  beads: 4,
  beadSize: 0.024,
  beadTint: 0.85,
  endDots: true,
  pool: 0.45,
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
  fog: "#0E3260",
  plate: "#2A6ACA",
  fogDensity: 0.12,
  plateEmissive: 0.06,
  fibreGain: 0.8,
  edge: 0.1,
  light: 0.9,
  bgTop: "#0F3E6E",
  bgBottom: "#062244",
  collars: false,
  beads: 4,
  beadSize: 0.012,
  beadTint: 0.85,
  endDots: true,
  pool: 0,
  dashedEdge: false,
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
    // Spec hex #1A5AC8; red lowered to match the reference frame.
    params: { block: "#0458C4", led: "#8AF0FF", seam: "#0A2E6A", key: 0.66, spec: 0.08 },
  }),
  row<LedCubeWallParams>({
    id: "LEDCubeWall-GraphiteAmber",
    factory: createLedCubeWall,
    params: { block: "#2A2C30", led: "#FFB04A", seam: "#18191C", key: 1.5, spec: 0.08 },
  }),
  row<GlassCubeFieldParams>({
    id: "GlassCubeField-Blue",
    factory: createGlassCubeField,
    // Spec hexes #0A2AB0 / #5A8AFF / #1A4AFF; shifted toward the azure of the reference frame.
    params: { fill: "#0844D0", edge: "#4AA0FF", glow: "#1A5AFF" },
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
