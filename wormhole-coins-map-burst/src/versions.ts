// One data row per version. `id` is the output file name; the Remotion
// composition id is the same with "_" → "-" (Remotion ids disallow "_").
// Add a colourway by adding a row here (see README).
export type WormholePalette = {
  id: string;
  streakA: string;
  streakB: string;
  accent: string;
  white: string;
  haze: string;
  // Wide halo tint of the thick ribbons (in-family with streakA).
  glow: string;
};
export const WORMHOLE_VERSIONS: WormholePalette[] = [
  { id: "Wormhole_Violet", streakA: "#9A5CFF", streakB: "#5C7CFF", accent: "#FF7A4A", white: "#F4EEFF", haze: "#1A2B8C", glow: "#C65CFF" },
  { id: "Wormhole_CyanGold", streakA: "#4FE8FF", streakB: "#3F8CFF", accent: "#FFC860", white: "#F2FBFF", haze: "#0E3A8C", glow: "#5CD8FF" },
];

export type CoinPalette = { id: string; gold: string; silver: string; leakWarm: string; leakCool: string };
export const COIN_VERSIONS: CoinPalette[] = [
  { id: "CoinGrowth", gold: "#A88246", silver: "#4E5A62", leakWarm: "#FF9A4A", leakCool: "#5FA8E8" },
];

export type MapPalette = { id: string; dots: string; hot: string; bg: string; hud: string };
export const MAP_VERSIONS: MapPalette[] = [
  { id: "HologramThreatMap", dots: "#4FD8FF", hot: "#FF8A30", bg: "#020A12", hud: "#9FE8FF" },
];

export type BurstPalette = { id: string; sparkle: string; white: string; glow: string; leaks: string[] };
export const BURST_VERSIONS: BurstPalette[] = [
  { id: "SparkleBurst_Blue", sparkle: "#7FA8FF", white: "#F0F4FF", glow: "#2F5BFF", leaks: ["#6F8CFF", "#B49CFF", "#8FE0FF", "#FFB0E0"] },
  { id: "SparkleBurst_Gold", sparkle: "#FFD27A", white: "#FFF6E6", glow: "#FF8A1F", leaks: ["#FFB347", "#FF8FA8", "#FFD27A", "#FF7AA2"] },
];
