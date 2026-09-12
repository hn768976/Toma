// Two skins for the same motion piece.
//
// `signal` reproduces the reference clip: near-black blue-grey chrome with a
// bright sky-cyan accent. `meridian` is the alternate cut -- a deeper,
// teal-leaning "dark cyan" palette on an ink that carries a green cast.

export type Theme = {
  name: string;
  bg: string;
  bgGradient: string;
  panel: string;
  panelAlt: string;
  card: string;
  cardAlt: string;
  border: string;
  borderStrong: string;
  grid: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentDim: string;
  accentGlow: string;
  bar: string;
  barActive: string;
};

export const SIGNAL: Theme = {
  name: "signal",
  bg: "#0B0E12",
  bgGradient:
    "radial-gradient(120% 90% at 50% -10%, #141A22 0%, #0B0E12 55%, #080A0D 100%)",
  panel: "#0D1115",
  panelAlt: "#0F1318",
  card: "#13161D",
  cardAlt: "#171B23",
  border: "rgba(120, 170, 200, 0.10)",
  borderStrong: "rgba(120, 170, 200, 0.20)",
  grid: "rgba(120, 170, 200, 0.045)",
  text: "#E6EDF3",
  textDim: "#7E93A3",
  textFaint: "#4A5A66",
  accent: "#4FC3F7",
  accentSoft: "#8AD8FA",
  accentDim: "rgba(79, 195, 247, 0.22)",
  accentGlow: "rgba(79, 195, 247, 0.35)",
  bar: "#2D323A",
  barActive: "#4FC3F7",
};

export const MERIDIAN: Theme = {
  name: "meridian",
  bg: "#060C0D",
  bgGradient:
    "radial-gradient(130% 100% at 15% 0%, #0D1A1B 0%, #071011 50%, #04090A 100%)",
  panel: "#081113",
  panelAlt: "#0A1517",
  card: "#0C181A",
  cardAlt: "#0F1E21",
  border: "rgba(60, 180, 175, 0.12)",
  borderStrong: "rgba(60, 180, 175, 0.26)",
  grid: "rgba(60, 180, 175, 0.05)",
  text: "#DCEDEA",
  textDim: "#6E9694",
  textFaint: "#3E5C5C",
  accent: "#0FB5AE",
  accentSoft: "#3FD9CE",
  accentDim: "rgba(15, 181, 174, 0.20)",
  accentGlow: "rgba(15, 181, 174, 0.32)",
  bar: "#1C2B2C",
  barActive: "#0FB5AE",
};

export const FONT_SANS =
  "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";
