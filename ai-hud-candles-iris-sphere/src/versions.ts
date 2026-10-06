import type React from "react";
import { AIAgentsChip, ChipLayout, ChipPalette } from "./looks/AIAgentsChip";
import { MonoAIHUD, HudPalette } from "./looks/MonoAIHUD";
import { CandleDashboard, CandlePalette } from "./looks/CandleDashboard";
import { IrisBurst, IrisLayout, IrisPalette } from "./looks/IrisBurst";
import { DataSphere, SpherePalette } from "./looks/DataSphere";

// One data row per version. To add a colourway, copy a row, give it a new id
// and change the palette; Root.tsx registers every row as a composition.

// `layout` is optional per look: framing (chip copy space), mirroring (iris).
export type AnyRow = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<any>;
  durationInFrames: number;
  palette: unknown;
  layout?: unknown;
};

const chipBlue: ChipPalette = {
      bgLow: "#041A3A",
      bgHigh: "#062A4A",
      mapDot: "#2A6A9A",
      chipEdge: "#5AE8F0",
      glass: "#0A3672",
      rain: "#3A8AC8",
      speck: "#4AA8E8",
      accent: "#E8843A",
    };

const irisNeon: IrisPalette = {
      ring: "#3AD8E8",
      blue: "#1A6AE8",
      cyan: "#3AE8F0",
      purple: "#C84AFF",
      gold: "#FFC83A",
      rimOuter: "#3AD8F0",
      rimInner: "#1A6AE8",
      bg: "#000000",
    };

export const versions: AnyRow[] = [
  {
    id: "AIAgentsChip-Blue",
    component: AIAgentsChip,
    durationInFrames: 600,
    palette: chipBlue,
  },
  {
    id: "MonoAIHUD-Graphite",
    component: MonoAIHUD,
    durationInFrames: 600,
    palette: {
      light: false,
      bg: "#0A0B0D",
      panel: "#141619",
      white: "#E8ECEF",
      grey: "#5A6068",
      line: "#A0A8B0",
      mint: "#3AE8B0",
      trace: "#78ECE2",
      traceDot: "#A8FFF0",
      accent: "#5AE8F0",
      amber: "#E8963A",
    } satisfies HudPalette,
  },
  {
    id: "CandleDashboard-Teal",
    component: CandleDashboard,
    durationInFrames: 600,
    palette: {
      bg: "#06202E",
      bgTop: "#0A3550",
      panel: "#0A3A55",
      up: "#3AFF6A",
      down: "#FF3A5A",
      bar: "#5AC8E0",
      ui: "#5AC8E0",
      text: "#D8F4FA",
    } satisfies CandlePalette,
  },
  {
    id: "IrisBurst-Neon",
    component: IrisBurst,
    durationInFrames: 450,
    palette: irisNeon,
  },
  {
    id: "DataSphere-WhiteAmber",
    component: DataSphere,
    durationInFrames: 600,
    palette: {
      bg: "#050505",
      amber: "#FFA83A",
      white: "#E8E8E8",
    } satisfies SpherePalette,
  },

  // ---- add-on rows ----
  {
    // same scene and timing as AIAgentsChip-Blue; the camera frames the chip
    // in the left third and leaves the right side as calm map for a title
    id: "AIAgentsChip-LeftCopySpace",
    component: AIAgentsChip,
    durationInFrames: 600,
    palette: chipBlue,
    layout: { chipScreenX: 0.3, mapShiftX: 1.6, rightDim: 0.4 } satisfies ChipLayout,
  },
  {
    id: "MonoAIHUD-Light",
    component: MonoAIHUD,
    durationInFrames: 600,
    palette: {
      light: true,
      bg: "#F2F3F5",
      panel: "#E2E5EA",
      white: "#2A2E34",
      grey: "#4A5058",
      line: "#2A2E34",
      mint: "#1AB88A",
      trace: "#2A2E34",
      traceDot: "#1AB88A",
      accent: "#1AB88A",
      amber: "#D07A1A",
    } satisfies HudPalette,
  },
  {
    // IrisBurst-Neon with the layout mirrored: ring right, planet arc left
    id: "IrisBurst-Mirrored",
    component: IrisBurst,
    durationInFrames: 450,
    palette: irisNeon,
    layout: { side: -1 } satisfies IrisLayout,
  },
];
