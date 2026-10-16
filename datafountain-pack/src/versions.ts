import type { RipplesParams } from "./looks/LiquidRipples";
import type { SilkParams } from "./looks/PastelSilk";
import type { CodePanelsParams } from "./looks/CodePanels";
import type { TealHudParams } from "./looks/TealHUD";
import type { FountainParams } from "./looks/DataFountain";

/**
 * ONE DATA ROW PER VERSION. `id` is the deliverable name; Remotion forbids
 * "_" in composition IDs, so the composition is registered as id with "_"
 * replaced by "-" (e.g. LiquidRipples_White → LiquidRipples-White). To add a colourway, copy a row, give it a new
 * `id`, and change its params — nothing else to touch.
 */
export type Version =
  | { id: string; look: "liquidRipples"; frames: number; loop: boolean; params: RipplesParams }
  | { id: string; look: "pastelSilk"; frames: number; loop: boolean; params: SilkParams }
  | { id: string; look: "codePanels"; frames: number; loop: boolean; params: CodePanelsParams }
  | { id: string; look: "tealHud"; frames: number; loop: boolean; params: TealHudParams }
  | { id: string; look: "dataFountain"; frames: number; loop: boolean; params: FountainParams };

const FOUNTAIN = { bg: "#020A1E", cyan: "#3AE8F0", blue: "#2E8CD8", icon: "#E8F0FF", red: "#FF4A5A", accentBlue: "#3A7CFF" };

export const VERSIONS: Version[] = [
  { id: "DataFountain_Story", look: "dataFountain", frames: 450, loop: false, params: { mode: "story", ...FOUNTAIN } },
  { id: "DataFountain_Loop", look: "dataFountain", frames: 600, loop: true, params: { mode: "loop", ...FOUNTAIN } },
  { id: "CodePanels_Dark", look: "codePanels", frames: 600, loop: true, params: { white: "#E8F0E8", green: "#A8F0C8", orange: "#FF8A3A", flare: "#FFB060" } },
  { id: "TealHUD_Soft", look: "tealHud", frames: 600, loop: true, params: { ink: "#E0F8FF", accent: "#D8F06A", bgDark: "#1A6A7A", bgLight: "#8AC8D0", mist: "#B4DCE4" } },
  { id: "PastelSilk_PinkBlue", look: "pastelSilk", frames: 600, loop: true, params: { palette: ["#A8D0F8", "#F0B0E0", "#C8B0F0", "#FFFFFF"], deep: "#3F86EA" } },
  { id: "PastelSilk_PeachMint", look: "pastelSilk", frames: 600, loop: true, params: { palette: ["#FFD0B8", "#B8F0D8", "#FFF4E0", "#FFFFFF"], deep: "#F2A88C" } },
  { id: "LiquidRipples_White", look: "liquidRipples", frames: 600, loop: true, params: { shading: "satin", liquid: "#EEEEF0" } },
  { id: "LiquidRipples_Black", look: "liquidRipples", frames: 600, loop: true, params: { shading: "ink", liquid: "#08080A" } },
];

export const compositionId = (v: Version) => v.id.replace(/_/g, "-");
