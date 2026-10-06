import type React from "react";
import { AIAgentsChip, ChipPalette } from "./looks/AIAgentsChip";
import { MonoAIHUD, HudPalette } from "./looks/MonoAIHUD";
import { CandleDashboard, CandlePalette } from "./looks/CandleDashboard";
import { IrisBurst, IrisPalette } from "./looks/IrisBurst";
import { DataSphere, SpherePalette } from "./looks/DataSphere";

// One data row per version. To add a colourway, copy a row, give it a new id
// and change the palette; Root.tsx registers every row as a composition.

type Row<P> = { id: string; component: React.FC<{ palette: P }>; durationInFrames: number; palette: P };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = Row<any>;

export const versions: AnyRow[] = [
  {
    id: "AIAgentsChip-Blue",
    component: AIAgentsChip,
    durationInFrames: 600,
    palette: {
      bgLow: "#041A3A",
      bgHigh: "#062A4A",
      mapDot: "#2A6A9A",
      chipEdge: "#5AE8F0",
      glass: "#0A3672",
      rain: "#3A8AC8",
      speck: "#4AA8E8",
      accent: "#E8843A",
    } satisfies ChipPalette,
  },
  {
    id: "MonoAIHUD-Graphite",
    component: MonoAIHUD,
    durationInFrames: 600,
    palette: {
      bg: "#0A0B0D",
      white: "#E8ECEF",
      grey: "#5A6068",
      mint: "#3AE8B0",
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
    palette: {
      ring: "#3AD8E8",
      cyan: "#3AE8F0",
      purple: "#C84AFF",
      gold: "#FFC83A",
      rimOuter: "#3AD8F0",
      rimInner: "#1A6AE8",
      bg: "#000000",
    } satisfies IrisPalette,
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
];
