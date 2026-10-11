import { cpuCube, CpuCubeParams } from "./looks/cpuCube";
import { LookFactory } from "./lib/LookCanvas";
import { aiChip, AiChipParams } from "./looks/aiChip";
import { ramMacro, RamParams } from "./looks/ramMacro";
import { wafer, WaferParams } from "./looks/wafer";

// One data row per version. Add a colourway by adding a row.
export interface Version<P> {
  id: string;
  factory: LookFactory<P>;
  params: P;
}

const v = <P,>(id: string, factory: LookFactory<P>, params: P): Version<unknown> =>
  ({ id, factory, params }) as Version<unknown>;

export const VERSIONS: Version<unknown>[] = [
  v<CpuCubeParams>("CPUCube-Blue", cpuCube, { edge: "#5AC8FF", trace: "#3AA8FF", accent: "#FF6A5A", die: "#B8803A", core: "#E8ECF0" }),
  v<CpuCubeParams>("CPUCube-Amber", cpuCube, { edge: "#FFB04A", trace: "#FF8A2A", accent: "#5AE8FF", die: "#B0643A", core: "#F2E2B0" }),
  v<AiChipParams>("AIHologramChip-Teal", aiChip, { line: "#6AD8F0", label: "#9AE8FF", bgTop: "#0A3A50", bgBottom: "#062030" }),
  v<AiChipParams>("AIHologramChip-Violet", aiChip, { line: "#A88AFF", label: "#D8C8FF", bgTop: "#1E1450", bgBottom: "#0C0828" }),
  v<RamParams>("RAMMacro-GreenBlue", ramMacro, { lightA: "#3AFF8A", lightB: "#2A4AFF" }),
  v<RamParams>("RAMMacro-MagentaOrange", ramMacro, { lightA: "#FF3AC8", lightB: "#FF8A2A" }),
  v<WaferParams>("SiliconWafer-SilverPrism", wafer, { seed: 0x5117e4, base: "#9AA89A", grating: "perBlock", diesAcross: 5.5, edge: false, light: "#FFFFFF", fov: 20, pitch: 26, scribe: 0.93 }),
  v<WaferParams>("SiliconWafer-VioletGrating", wafer, { seed: 0x7a1e7, base: "#6A5AB8", grating: "aligned", diesAcross: 22, edge: true, light: "#F4ECFF", fov: 18, pitch: 40, scribe: 0.45 }),
];

// Development-only compositions (model check stills). Not deliverables.
export const DEV_VERSIONS: Version<unknown>[] = [
  v<RamParams>("Dev-RAMCheck-Module", ramMacro, { lightA: "#ffffff", lightB: "#ffffff", mode: "checkModule" }),
  v<RamParams>("Dev-RAMCheck-Row", ramMacro, { lightA: "#3AFF8A", lightB: "#2A4AFF", mode: "checkRow" }),
];
