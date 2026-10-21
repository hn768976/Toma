// ---------------------------------------------------------------------------
// COLOURS - one row per look. Change a hex value here and re-render; nothing
// else needs touching. (Hex is sRGB, exactly as it appears in the output.)
// ---------------------------------------------------------------------------
export const PALETTE = {
  FilmBurn:      { whiteHot: "#FFF6D8", yellow: "#FFC830", orange: "#FF7A1A", red: "#C81A0A", char: "#140600", strip: "#1E1D1E" },
  VintageColour: { leakA: "#C83A2A", leakB: "#E88A3A", leakC: "#2A8A9A", vignette: "#A08C70", speckA: "#F4F0E6", speckB: "#A6CED2", speckC: "#D2705E", speckD: "#E6D6A6" },
  VintageMono:   { leakA: "#8C8C8C", leakB: "#B4B4B4", leakC: "#6E6E6E", vignette: "#A0A0A0", speckA: "#F4F4F4", speckB: "#C8C8C8", speckC: "#E0E0E0", speckD: "#FFFFFF" },
  FilmGate:      { frame: "#FFFFFF", surround: "#000000", edgeCode: "#C0642A", scratch: "#C8C8C8" },
  PrismGlints:   { haze: "#0E1C1E", rays: "#3A5A60", core: "#F2FAFF", streak: "#9CC8FF" },
  BokehWarm:     { a: "#C8964A", b: "#E8D2A8", c: "#5A3A1A" },
  Starburst:     { core: "#F6FAFF", rays: "#EEF4FF", haze: "#8A9298" },
} as const;

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
