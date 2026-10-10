/**
 * One data row per version. To add a colourway: add a row here, then add a
 * <Composition> for it in Root.tsx (see README, "Adding a colourway").
 * All colours are display-referred sRGB hex.
 */
export type NeonFrameColorway = {
  id: string;
  /** Colour ramp stops, cyclic (last stop blends back into the first). */
  ramp: string[];
  /** Counter-rotating secondary ramp, lower weight. */
  ramp2: string[];
  /** Pale haze colours at the strongest glow / frame edge. */
  hazeA: string;
  hazeB: string;
  /** Dark interior. */
  inner: string;
};

export type SpotlightColorway = {
  id: string;
  background: [string, string]; // [bottom/outer, top/inner]
  beamTop: string; // beam core near the apex
  beamBody: string; // beam body colour
  dustTop: string; // dust near the top
  dustMid: string;
  dustBottom: string;
  dustAccent: string; // sparse extra specks (pink / gold)
  accentAmount: number;
  haze: string; // bottom haze
  tealGlow: string; // faint glow around upper beams
};

export type GlitterColorway = {
  id: string;
  glowHot: string; // top-centre glow
  glowMid: string;
  glowOuter: string; // radial glow's outer colour (sides / bottom corners)
  sides: string; // vignette / curtain-fold colour at the sides and bottom
  /** Glitter ramp, bright -> dark. */
  glitter: [string, string, string];
  /** A few accent grains (pale gold / rose). Empty = none. */
  accents: string[];
  accentAmount: number;
};

export const NEON_FRAME: NeonFrameColorway[] = [
  {
    id: "Spectrum",
    // blue -> cyan -> violet -> magenta -> pink -> blue (blue and violet doubled so
    // they dominate and cyan is a brief accent, as in the reference)
    ramp: ["#2A5AFF", "#2A5AFF", "#2AE0F8", "#8A3AFF", "#8A3AFF", "#FF2AD8", "#FF6AC8", "#2A5AFF"],
    ramp2: ["#8A3AFF", "#2A5AFF", "#FF2AD8", "#8A3AFF"],
    hazeA: "#C8B8FF",
    hazeB: "#E8E0FF",
    inner: "#030409",
  },
];

export const SPOTLIGHT: SpotlightColorway[] = [
  {
    id: "TealCrimson",
    background: ["#02060E", "#04101C"],
    beamTop: "#BFE8FF",
    beamBody: "#244E72",
    dustTop: "#BFE8FF",
    dustMid: "#3AA0B8",
    dustBottom: "#FF2A4A",
    dustAccent: "#FF6A8A",
    accentAmount: 0.35,
    haze: "#6E1420",
    tealGlow: "#0E4A60",
  },
  {
    id: "BlueViolet",
    background: ["#02030F", "#050A24"],
    beamTop: "#D8E4FF",
    beamBody: "#2A5AE8",
    dustTop: "#D8E4FF",
    dustMid: "#5A6AFF",
    dustBottom: "#8A3AFF",
    dustAccent: "#FFC84A",
    accentAmount: 0.4,
    haze: "#3A1A8A",
    tealGlow: "#12307A",
  },
];

export const GLITTER: GlitterColorway[] = [
  {
    id: "Gold",
    glowHot: "#FFC030",
    glowMid: "#D07C14",
    glowOuter: "#5A3008",
    sides: "#3A1E08",
    glitter: ["#FFE08A", "#FFB82A", "#C87A10"],
    accents: [],
    accentAmount: 0,
  },
  {
    id: "ChampagneSilver",
    glowHot: "#F4E8D8",
    glowMid: "#8A8A94",
    glowOuter: "#4A4648",
    sides: "#2A2628",
    glitter: ["#FFFFFF", "#E8E4E0", "#B8B0A8"],
    accents: ["#FFE0A0", "#F0B8B8"],
    accentAmount: 0.06,
  },
];
