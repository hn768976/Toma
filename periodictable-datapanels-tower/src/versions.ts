import type { PanelsParams } from "./looks/dataPanels";
import type { TowerParams } from "./looks/dataTower";
import type { GridParams } from "./looks/elementGrid";
import type { AssembleParams } from "./looks/tableAssemble";
import type { FlyoverParams } from "./looks/tableFlyover";

// One data row per version. To add a colourway, copy a row, give it a new
// id and change its colours – Root.tsx registers every row as a composition.
export type Version =
  | { id: string; look: "flyover"; frames: number; background: string; params: FlyoverParams }
  | { id: string; look: "assemble"; frames: number; background: string; params: AssembleParams }
  | { id: string; look: "panels"; frames: number; background: string; params: PanelsParams }
  | { id: string; look: "grid"; frames: number; background: string; params: GridParams }
  | { id: string; look: "tower"; frames: number; background: string; params: TowerParams };

export const VERSIONS: Version[] = [
  {
    id: "DataPanels-Blue",
    look: "panels",
    frames: 600,
    background: "#020A1E",
    params: {
      panel: "#1A4AB0",
      panelAlpha: 0.4,
      text: "#C8E0FF",
      map: "#A8C8F0",
      mapAlpha: 0.6,
      background: "#020A1E",
      glow: "#2F6FD8",
      haze: "#0E3E5E",
      bloom: 0.45,
    },
  },
  {
    id: "DataTower-Blue",
    look: "tower",
    frames: 600,
    background: "#06124A",
    params: {
      edge: "#8AC8FF",
      digits: "#E2F0FF",
      fill: "#1E5FC8",
      dot: "#3A6AFF",
      fieldA: "#0234A9",
      fieldB: "#02042E",
      glow: 0.3,
    },
  },
  {
    id: "ElementGrid-Grey",
    look: "grid",
    frames: 600,
    background: "#F2F2F4",
    params: { paper: "#F2F2F4", line: "#C8C8CC", text: "#C8C8CC", dot: "#2A2A2E", streak: "#FFFFFF", streakStrength: 0.9 },
  },
  {
    id: "ElementGrid-IceBlue",
    look: "grid",
    frames: 600,
    background: "#EEF4FA",
    params: { paper: "#EEF4FA", line: "#B8D0E8", text: "#B8D0E8", dot: "#1A2A4A", streak: "#FAFDFF", streakStrength: 0.9 },
  },
  {
    id: "TableAssemble-Light",
    look: "assemble",
    frames: 450,
    background: "#E8E8EA",
    params: {
      background: "#F7F7F8",
      backgroundEdge: "#C6C6C9",
      face: "#E4E4E6",
      text: "#000000",
      sub: "#2A2A2E",
      border: "#8A8A90",
      innerRule: "none",
      side: "#D4D4D8",
      gradX: 0.07,
      shadow: "#3A3A44",
      shadowStrength: 0.2,
      sweep: "#FFFFFF",
      sweepStrength: 0.22,
      glow: 0.0,
      glowThreshold: 0.95,
    },
  },
  {
    id: "TableAssemble-Dark",
    look: "assemble",
    frames: 450,
    background: "#0A1020",
    params: {
      background: "#111C34",
      backgroundEdge: "#070B16",
      face: "#0E1A2E",
      faceTop: "rgba(90,200,240,0.16)",
      text: "#F2F8FF",
      sub: "#B8D4EA",
      border: "#5AC8F0",
      innerRule: "none",
      side: "#1E5A78",
      gradX: 0.12,
      shadow: "#000000",
      shadowStrength: 0.55,
      sweep: "#5AC8F0",
      sweepStrength: 0.3,
      glow: 0.55,
      glowThreshold: 0.5,
    },
  },
  {
    id: "TableFlyover-Blue",
    look: "flyover",
    frames: 600,
    background: "#1A2A4A",
    params: { plane: "#1A2A4A", text: "#EEF5FF", sub: "#C9DBF2", haze: "#AFC2D7", hazeMin: 0.38, glow: 0.32 },
  },
  {
    id: "TableFlyover-DarkGold",
    look: "flyover",
    frames: 600,
    background: "#14100A",
    params: { plane: "#14100A", text: "#F0C878", sub: "#D8AE62", haze: "#B07A36", hazeMin: 0.22, glow: 0.55 },
  },
];
