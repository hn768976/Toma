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
  fogDensity: 0.085,
  plateEmissive: 1.1,
  fibreGain: 1.0,
  edge: 1.0,
  light: 1.0,
};

export const FIBRE_VIOLET: FibrePalette = {
  ...FIBRE_CYAN,
  fibre: "#B08AFF",
  pulse: "#FFE6F6",
  fog: "#1A0A3A",
  plate: "#1A1440",
};

export const CHIP_BLUE: FibrePalette = {
  fibre: "#6AD8FF",
  pulse: "#FFFFFF",
  fog: "#1A5AA8",
  plate: "#2A6ACA",
  fogDensity: 0.075,
  plateEmissive: 0.8,
  fibreGain: 1.2,
  edge: 1.2,
  light: 0.3,
};

export const ROWS: AnyRow[] = [
  row<PlexusShellsParams>({
    id: "PlexusShells-TealOrange",
    factory: createPlexusShells,
    params: {
      nodeA: "#2AF0C8",
      nodeB: "#FF9A3A",
      link: "#2AC8B0",
      ring: "#9AF5E2",
      speck: "#FFF6C8",
      accentShare: 0.18,
    },
  }),
  row<LedCubeWallParams>({
    id: "LEDCubeWall-Blue",
    factory: createLedCubeWall,
    params: { block: "#1A5AC8", led: "#8AE8FF", seam: "#020814", key: 0.8, spec: 0.12 },
  }),
  row<LedCubeWallParams>({
    id: "LEDCubeWall-GraphiteAmber",
    factory: createLedCubeWall,
    params: { block: "#2A2C30", led: "#FFB04A", seam: "#050505", key: 1.6, spec: 0.1 },
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
