import type { LookFactory } from "./kit/engine";
import { pastelBokeh } from "./looks/pastelBokeh";
import { silkLight } from "./looks/silkLight";
import { spotlight } from "./looks/spotlight";
import { starTwinkle } from "./looks/starTwinkle";
import { sunFlare } from "./looks/sunFlare";

// One data row per version. To add a colourway: copy a row, give it a new id
// (letters, digits and dashes) and file name, and change its colours.
export type Variant = { id: string; file: string; make: () => LookFactory };

export const VARIANTS: Variant[] = [
  { id: "SpotlightSparkles-Blue", file: "SpotlightSparkles_Blue", make: () => spotlight({ seed: 1001, bgEdge: "#020A2A", bgCenter: "#0A3A9A", rays: "#6AA8FF", sparkles: ["#FFFFFF", "#E2EEFF", "#C4DAFF"] }) },
  { id: "SpotlightSparkles-Gold", file: "SpotlightSparkles_Gold", make: () => spotlight({ seed: 1001, bgEdge: "#140A02", bgCenter: "#5A3A0A", rays: "#FFC86A", sparkles: ["#FFFFFF", "#FFF2D8", "#FFE0A0"] }) },
  { id: "PastelBokeh-PinkLavender", file: "PastelBokeh_PinkLavender", make: () => pastelBokeh({ seed: 2002, top: "#E8A8F0", mid: "#F8C8E8", bottom: "#FFE8E0" }) },
  { id: "PastelBokeh-MintAqua", file: "PastelBokeh_MintAqua", make: () => pastelBokeh({ seed: 2002, top: "#9AE8E0", mid: "#C8F4EC", bottom: "#F0FFF8" }) },
  { id: "SunFlare-Midday", file: "SunFlare_Midday", make: () => sunFlare({ seed: 3003, skyTop: "#3A8AE8", skyBottom: "#8AC8F8", skyNear: "#8CCCFF", sunCore: "#FFFFFF", sunGlow: "#FFFFFF", pathA: [0.87, 0.48], pathB: [0.66, 0.5], ghostTints: ["#FFC0DC", "#9CF0E4", "#C8A8FF"] }) },
  { id: "SunFlare-GoldenHour", file: "SunFlare_GoldenHour", make: () => sunFlare({ seed: 3003, skyTop: "#E8783A", skyBottom: "#F8C878", skyNear: "#FFE2A8", sunCore: "#FFFBF0", sunGlow: "#FFF5DE", pathA: [0.87, 0.6], pathB: [0.66, 0.64], ghostTints: ["#FFC0A0", "#FFE8A0", "#E8A8C8"] }) },
  { id: "StarTwinkle-Black", file: "StarTwinkle_Black", make: () => starTwinkle({ seed: 4004 }) },
  { id: "SilkLight-PaleBlue", file: "SilkLight_PaleBlue", make: () => silkLight({ seed: 5005, light: "#F4F8FC", base: "#B8D8EC", deep: "#A8CCE8", dust: "#FFFFFF", angleDeg: 62 }) },
];
