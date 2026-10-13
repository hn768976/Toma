import React from "react";
import { AIServerRow } from "./looks/AIServerRow";
import { CodeTowers } from "./looks/CodeTowers";
import { FibreWorldMap } from "./looks/FibreWorldMap";
import { GlassCityDrive } from "./looks/GlassCityDrive";
import { WireframeStreet } from "./looks/WireframeStreet";

// One row per version. To add a colourway, copy a row, give it a new id/file
// and change the colours. To rebuild a city, change its seed.
// `frames` is the loop (or story) length; every animated value is periodic in it.
type Row = {
  id: string; // Remotion composition id
  file: string; // output file name (no extension)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<any>;
  frames: number;
  loop: boolean;
  props: Record<string, unknown>;
};

export const VERSIONS: Row[] = [
  {
    id: "CodeTowers-Cyan",
    file: "CodeTowers_Cyan",
    component: CodeTowers,
    frames: 600,
    loop: true,
    props: { seed: 1099, code: "#5AD8F8", edge: "#3AD8F8", tower: "#0A2A4A", haze: "#0FA8E8", fill: "#14A0E8" },
  },
  {
    id: "FibreWorldMap-Story",
    file: "FibreWorldMap_Story",
    component: FibreWorldMap,
    frames: 360,
    loop: false,
    props: { mode: "story", seed: 1108, outline: "#3A8AFF", fill: "#2A5ACA", network: "#FFB04A", tipBlue: "#3AC8FF" },
  },
  {
    id: "FibreWorldMap-HoldLoop",
    file: "FibreWorldMap_HoldLoop",
    component: FibreWorldMap,
    frames: 600,
    loop: true,
    props: { mode: "hold", seed: 1108, outline: "#3A8AFF", fill: "#2A5ACA", network: "#FFB04A", tipBlue: "#3AC8FF" },
  },
  {
    id: "GlassCityDrive-Blue",
    file: "GlassCityDrive_Blue",
    component: GlassCityDrive,
    frames: 600,
    loop: true,
    props: { citySeed: 7311, glass: "#2A6ACA", edge: "#5AC8FF", window: "#6AF8FF", road: "#0A1A3A", skyHorizon: "#1A6ACA" },
  },
  {
    id: "WireframeStreet-BlueCyan",
    file: "WireframeStreet_BlueCyan",
    component: WireframeStreet,
    frames: 600,
    loop: true,
    props: { citySeed: 4141, body: "#0A1A6A", line: "#3A6AFF", glow: "#3AF0F0", skyTop: "#081A6A" },
  },
  {
    id: "WireframeStreet-VioletPink",
    file: "WireframeStreet_VioletPink",
    component: WireframeStreet,
    frames: 600,
    loop: true,
    props: { citySeed: 4141, body: "#1A0A4A", line: "#8A5AFF", glow: "#FF5AC8", glowWarm: "#FF9A4A", skyTop: "#14084A" },
  },
  {
    id: "AIServerRow-Teal",
    file: "AIServerRow_Teal",
    component: AIServerRow,
    frames: 600,
    loop: true,
    props: { seed: 3531, rack: "#1A1E24", glow: "#3AE8D8", text: "#C8FFF8" },
  },
];
