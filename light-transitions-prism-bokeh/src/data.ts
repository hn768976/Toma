// One data row per version. To add a colourway, copy a row, give it a new
// `id` (composition id) and `file` (output name), and change the colours.
import type { FlareBurstParams } from "./looks/FlareBurst";
import type { LightLeakParams } from "./looks/LightLeak";
import type { LightSweepParams } from "./looks/LightSweep";
import type { PrismLightParams } from "./looks/PrismLight";
import type { RedBokehParams } from "./looks/RedBokeh";

export type VersionRow =
  | { id: string; file: string; look: "lightSweep"; params: LightSweepParams }
  | { id: string; file: string; look: "flareBurst"; params: FlareBurstParams }
  | { id: string; file: string; look: "lightLeak"; params: LightLeakParams }
  | { id: string; file: string; look: "prismLight"; params: PrismLightParams }
  | { id: string; file: string; look: "redBokeh"; params: RedBokehParams };

export const VERSIONS: VersionRow[] = [
  // Look 1 — Light Sweep (8s transition)
  { id: "LightSweep-Violet", file: "LightSweep_Violet", look: "lightSweep",
    params: { streak: "#C878FF", bandDeep: "#0A0030", bandMid: "#3A10C8", bandBright: "#2A00FF", bandAccent: "#7A00D0" } },
  { id: "LightSweep-Gold", file: "LightSweep_Gold", look: "lightSweep",
    params: { streak: "#FFD88A", bandDeep: "#1A0A00", bandMid: "#8A4A0A", bandBright: "#FFB040", bandAccent: "#D05A00" } },
  // Look 2 — Flare Burst (6s transition)
  { id: "FlareBurst-VioletGold", file: "FlareBurst_VioletGold", look: "flareBurst",
    params: { glow: "#8A4AFF", core: "#FFC870", whiteout: "#FFF4E0", ghost: "#FF6AC8" } },
  { id: "FlareBurst-Cyan", file: "FlareBurst_Cyan", look: "flareBurst",
    params: { glow: "#3AD8FF", core: "#E6F6FF", whiteout: "#EEF8FF", ghost: "#2AC8B0" } },
  // Look 3 — Light Leak (12s overlay)
  { id: "LightLeak-VioletBlue", file: "LightLeak_VioletBlue", look: "lightLeak",
    params: { deep: "#1A0A6A", mid: "#6A3AFF", core: "#FFFFFF", accent: "#2A8AC8" } },
  { id: "LightLeak-WarmAmber", file: "LightLeak_WarmAmber", look: "lightLeak",
    params: { deep: "#4A1A00", mid: "#FF7A1A", core: "#FFF0D0", accent: "#E83A2A" } },
  // Look 4 — Prism Light (20s loop)
  { id: "PrismLight-Rainbow", file: "PrismLight_Rainbow", look: "prismLight",
    params: { spectrum: ["#E83AC8", "#6A3AFF", "#3A6AFF", "#5AE8FF", "#FFD86A", "#FF8A3A"], coreColor: "#2A0A5A" } },
  // Look 5 — Red Bokeh (20s loop)
  { id: "RedBokeh-RedGold", file: "RedBokeh_RedGold", look: "redBokeh",
    params: { bgCentre: "#E8202A", bgCorner: "#8A0A10", bokehA: "#FF6A6A", bokehB: "#FFFFFF", sparkle: "#FFD86A" } },
];
