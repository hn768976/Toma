// ─────────────────────────────────────────────────────────────────────────────
// One data row per version. Add a row to any list below and a new composition
// appears in the Studio (id = `${look}-${key}`), renderable like the others.
// ─────────────────────────────────────────────────────────────────────────────

export type AIDiagnosisVersion = {
  key: string; // composition id suffix
  file: string; // preview file name (without .mp4)
  title: string; // shown in small caps
  code: string; // ID after the title, digits flicker then lock
  accent: string; // text, ring, glows
  accentDim: string; // "Please wait...", secondary lines
  track: string; // progress track
  panel: string; // panel fill
  frame: string; // panel border
  backdrop: "body" | "helix"; // what sits behind the panel
  seed: number; // progress pacing (pauses/bursts)
};

export const aiDiagnosisVersions: AIDiagnosisVersion[] = [
  {
    key: "Medical",
    file: "AIDiagnosis_Medical",
    title: "MEDICAL DIAGNOSIS",
    code: "D6517",
    accent: "#9FD4FF",
    accentDim: "#3F8FD8",
    track: "#1D63B8",
    panel: "#0B2240",
    frame: "#3B6EA8",
    backdrop: "body",
    seed: 6517,
  },
  {
    key: "DNA",
    file: "AIDiagnosis_DNA",
    title: "DNA ANALYSIS",
    code: "G2048",
    accent: "#3FD8C8",
    accentDim: "#2A9C94",
    track: "#17807A",
    panel: "#0B2240",
    frame: "#2F8C8A",
    backdrop: "helix",
    seed: 2048,
  },
];

export type CartCounterVersion = {
  key: string;
  file: string;
  bar: string;
  barEdge: string; // thin highlight along the bar's edges
  band: string; // darker band behind the bar
  background: string;
  icon: string; // cart, search, peeking icons
  priceColor: string;
  badge: string;
  badgeText: string;
  currency: string;
  currencyPosition: "before" | "after";
  thousands: string; // thousands separator
  decimal: string; // decimal separator
  finalCount: number;
  seed: number; // per-item prices
};

export const cartCounterVersions: CartCounterVersion[] = [
  {
    key: "SlateUSD",
    file: "CartCounter_SlateUSD",
    bar: "#3E5563",
    barEdge: "#8A9DAA",
    band: "#334652",
    background: "#2A323C",
    icon: "#D2D7DC",
    priceColor: "#E6EAEE",
    badge: "#5AA8F0",
    badgeText: "#FFFFFF",
    currency: "$",
    currencyPosition: "before",
    thousands: ",",
    decimal: ".",
    finalCount: 45,
    seed: 45,
  },
  {
    key: "LightEUR",
    file: "CartCounter_LightEUR",
    bar: "#F4F6F8",
    barEdge: "#FFFFFF",
    band: "#C9D0D8",
    background: "#DDE2E8",
    icon: "#4A525C",
    priceColor: "#3A424C",
    badge: "#FF7A30",
    badgeText: "#FFFFFF",
    currency: "€",
    currencyPosition: "after",
    thousands: ".",
    decimal: ",",
    finalCount: 45,
    seed: 45,
  },
];

export type DataStackVersion = {
  key: string;
  file: string;
  stack: string; // glass, edges, glow
  traceA: string; // main board traces
  traceB: string; // secondary traces
  lights: string[]; // common small lights
  accentLights: string[]; // the few contrasting lights
  board: string; // board base colour
};

export const dataStackVersions: DataStackVersion[] = [
  {
    key: "Cyan",
    file: "DataStack_Cyan",
    stack: "#4FF0F0",
    traceA: "#1FB8C8",
    traceB: "#2A62C8",
    lights: ["#7FF6FF", "#E8FCFF", "#4FD8F0"],
    accentLights: ["#FF4A3A", "#FF8A2A"],
    board: "#03080D",
  },
  {
    key: "Amber",
    file: "DataStack_Amber",
    stack: "#FFB040",
    traceA: "#D8822A",
    traceB: "#8A5A2A",
    lights: ["#FFC870", "#FFF2DC", "#FF9A40"],
    accentLights: ["#3A8CFF", "#5AB4FF"],
    board: "#0C0704",
  },
];

export type DotMapVersion = {
  key: string;
  file: string;
  bright: string;
  dim: string;
  scan: string;
  seed: number;
};

export const dotMapVersions: DotMapVersion[] = [
  { key: "Lime", file: "DotWorldMap_Lime", bright: "#C8E040", dim: "#4A5A18", scan: "#9AB030", seed: 1 },
  { key: "Cyan", file: "DotWorldMap_Cyan", bright: "#50E0FF", dim: "#164A5A", scan: "#3AA8C8", seed: 1 },
];

export type GradientOrbVersion = {
  key: string;
  file: string;
  colorA: string;
  colorB: string;
  background: string;
};

export const gradientOrbVersions: GradientOrbVersion[] = [
  { key: "SunsetPink", file: "GradientOrb_SunsetPink", colorA: "#FF8A3D", colorB: "#9A10C8", background: "#F4D6E4" },
  { key: "OceanMint", file: "GradientOrb_OceanMint", colorA: "#3FE0C8", colorB: "#2A3FD8", background: "#DDF2EC" },
];
