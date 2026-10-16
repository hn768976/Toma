import React from "react";
import { DataScreens } from "./looks/datascreens/DataScreens";
import { HUDFrame } from "./looks/hudframe/HUDFrame";
import { PeopleNetwork } from "./looks/network/PeopleNetwork";
import { HUDTunnel } from "./looks/tunnel/HUDTunnel";
import { VitalMonitor } from "./looks/vitalmonitor/VitalMonitor";

// One data row per version. To add a colourway, copy a row, give it a new id
// and change the colours.
export interface Row {
  id: string;
  component: React.FC<never>;
  props: object;
}

export const ROWS: Row[] = [
  {
    id: "DataScreens-WhiteOverlay",
    component: DataScreens,
    props: { ink: "#E8E8E8", dim: "#8C8C8C", background: "#000000" },
  },
  {
    id: "VitalMonitor-Teal",
    component: VitalMonitor,
    props: {
      bgA: "#0A1E26", bgB: "#06121A",
      ecg: "#BFF4FF", pleth: "#BFF4FF", resp: "#BFF4FF", text: "#BFF4FF",
      grid: "#1E4A58", background: "#06121A",
    },
  },
  {
    id: "VitalMonitor-Green",
    component: VitalMonitor,
    props: {
      bgA: "#04120A", bgB: "#04120A",
      ecg: "#5AFF8A", pleth: "#4AE8F0", resp: "#F0E04A", text: "#9AD8AE",
      grid: "#123A22", background: "#04120A",
    },
  },
  {
    id: "HUDTunnel-Blue",
    component: HUDTunnel,
    props: { bgEdge: "#0A1A8A", bgCentre: "#050A3A", line: "#E8F0FF", accent: "#A8E8FF", background: "#050A3A" },
  },
  {
    id: "PeopleNetwork-Navy",
    component: PeopleNetwork,
    props: {
      bgTop: "#0A1040", bgBottom: "#141A5A",
      badgeA: "#D8DCFF", badgeB: "#D8DCFF", glyph: "#1A2066",
      line: "#6A78C8", lineAlpha: 0.55,
      pulse: "#E8ECFF", pulseAdditive: true,
      grain: 0.01, farFade: 0.6, background: "#0A1040",
    },
  },
  {
    id: "PeopleNetwork-White",
    component: PeopleNetwork,
    props: {
      bgTop: "#F6F8FC", bgBottom: "#E4EAF4",
      badgeA: "#2A6AE8", badgeB: "#1AB0C0", glyph: "#FFFFFF",
      line: "#9AAAC4", lineAlpha: 0.75,
      pulse: "#2A6AE8", pulseAdditive: false,
      grain: 0, farFade: 0.55, background: "#F6F8FC",
    },
  },
  {
    id: "HUDFrame-WhiteOverlay",
    component: HUDFrame,
    props: { ink: "#E8E8E8", accent: "#8AE8E0", background: "#000000" },
  },
];
