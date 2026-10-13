import { LookFactory } from "./engine/Stage";
import { CircuitParams, createCircuitCubes } from "./looks/CircuitCubes";
import { CloudParams, createCloudNetwork } from "./looks/CloudNetwork";
import { loadLandMask } from "./looks/landmask";
import { createHoloLiquid, HoloParams } from "./looks/HoloLiquid";
import { createRibbonLayers, RibbonParams } from "./looks/RibbonLayers";
import { createSlatRibbon, SlatParams } from "./looks/SlatRibbon";

// One data row per version. Composition ids use "-" (Remotion forbids "_");
// the delivered files are named with "_" (HoloLiquid-HoloBlue → HoloLiquid_HoloBlue.mp4).
// To add a colourway, copy a row, give it a new id
// and change its colours — nothing else needs touching.

type Row<P> = {
  id: string;
  factory: LookFactory<P>;
  params: P;
  /** Async data merged into params once, before the first frame (delayRender). */
  load?: () => Promise<Partial<P>>;
};
const row = <P,>(id: string, factory: LookFactory<P>, params: P, load?: () => Promise<Partial<P>>) =>
  ({ id, factory, params, load }) as Row<unknown>;

export const VERSIONS: Row<unknown>[] = [
  row<RibbonParams>("RibbonLayers-Blue", createRibbonLayers, {
    ribbon: "#1A4AF0",
    shadow: "#4A1AA8",
    key: "#B0D4FF",
    sheen: "#5AA8FF",
  }),
  row<RibbonParams>("RibbonLayers-Coral", createRibbonLayers, {
    ribbon: "#F07A5A",
    shadow: "#A83A5A",
    key: "#FFE2D2",
    sheen: "#FFC0A8",
  }),
  row<CircuitParams>("CircuitCubes-Blue", createCircuitCubes, {
    boardBase: "#0A1A4A",
    boardLine: "#1A3A7A",
    haze: "#3A8ADA",
    cyan: "#5AE8FF",
    blue: "#3A8AFF",
    trace: "#5AC8FF",
    core: "#C8F4FF",
  }),
  row<SlatParams>("SlatRibbon-GraphiteOrange", createSlatRibbon, {
    glow: "#FF8A3A",
    bgTop: "#1A1E28",
    bgBottom: "#3A4250",
    key: "#C8D4E8",
  }),
  row<SlatParams>("SlatRibbon-GraphiteCyan", createSlatRibbon, {
    glow: "#3AD8FF",
    bgTop: "#141A22",
    bgBottom: "#2E3A48",
    key: "#C8DCEC",
  }),
  row<HoloParams>("HoloLiquid-HoloBlue", createHoloLiquid, {
    bands: ["#1A2A9A", "#3AD8D0", "#6A3ADA", "#F8B88A", "#FFFFFF"],
    base: "#1A2A9A",
  }),
  row<HoloParams>("HoloLiquid-GoldRose", createHoloLiquid, {
    bands: ["#8A5A2A", "#E8B85A", "#E87A9A", "#F8E8C8", "#FFFFFF"],
    base: "#8A5A2A",
  }),
  row<CloudParams>(
    "CloudNetwork-Blue",
    createCloudNetwork,
    { floor: "#0A1A4A", dots: "#3A6ACA", glow: "#2A7AFF", glass: "#5A9AFF", line: "#5AB8FF" },
    async () => ({ land: await loadLandMask() }),
  ),
];
