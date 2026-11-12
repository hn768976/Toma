// One data row per colourway. Change a row to recolour the clip.
export type ShardPalette = {
  bg: string; // flat background behind everything
  glow: [string, string, string]; // centre-left glow: hot core, main, outer haze
  darks: string[]; // near-black cel plates
  darkHi: string; // their flat highlight band
  mids: string[]; // glow-lit mid-tone plates
  brights: string[]; // bright splinters, bursts and lightning
  core: string; // white-ish core of the lightning cracks
  hairline: string; // thin dark cracks
  bolt: string; // the big jagged bolt
};

export const SHARD_PALETTES: Record<"neon" | "ice", ShardPalette> = {
  neon: {
    bg: "#0A0418",
    glow: ["#FF10E0", "#D02AE8", "#7A3AFF"],
    darks: ["#020006", "#04010A", "#06020E", "#15123A", "#1A1648", "#120E40"],
    darkHi: "#241046",
    mids: ["#7A3CFF", "#6A2AE8", "#8A40FF", "#5A30E0", "#C02AE0", "#7A3CFF"],
    brights: ["#FF2AC8", "#7A3AFF", "#2AC8FF", "#FFA020", "#FF3A4A", "#2AC8FF", "#2AC8FF"],
    core: "#FFF4FC",
    hairline: "#06020C",
    bolt: "#FFB020",
  },
  ice: {
    bg: "#040A1E",
    glow: ["#4AE8FF", "#2A9AFF", "#2A6AFF"],
    darks: ["#000208", "#01040E", "#020612", "#040A1A", "#061238", "#081A48"],
    darkHi: "#10285A",
    mids: ["#2A6AFF", "#2AB8FF", "#4AE8FF", "#1E58E8", "#2A8AF0"],
    brights: ["#4AE8FF", "#2A6AFF", "#D8F4FF", "#FFFFFF", "#4AE8FF", "#8AD8FF", "#2A6AFF"],
    core: "#FFFFFF",
    hairline: "#01030A",
    bolt: "#D8F4FF",
  },
};
