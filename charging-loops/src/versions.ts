// One data row per version. Root.tsx turns each row into a composition.
// To add a colourway, copy a row, give it a new id and change its colours.

export type BladeRingRow = {
  look: "bladeRing";
  id: string;
  strip: string; // strip-light (edge + reflection) colour
  rim: string; // rim area light colour
  base: string; // slab base colour
};
export type PlateArcRow = {
  look: "plateArc";
  id: string;
  strip: string;
  rim: string;
  key: string;
  base: string;
};
export type SegmentTorusRow = {
  look: "segmentTorus";
  id: string;
  a: string; // gradient A
  b: string; // gradient B
  rim: string; // fresnel rim + seams
};
export type ChargeIconRow = {
  look: "chargeIcon";
  id: string;
  outline: string; // dotted outline core colour
  glow: string;
  fill: boolean; // 4B: segments fill + flash, twice per loop
  // palette shares for the data blocks: [teal, green, blue, red]
  shares: [number, number, number, number];
};
export type ChargeGaugeRow = {
  look: "chargeGauge";
  id: string;
  dial: string;
  percent: string;
  eco: string;
};

export type VersionRow =
  | BladeRingRow
  | PlateArcRow
  | SegmentTorusRow
  | ChargeIconRow
  | ChargeGaugeRow;

export const VERSIONS: VersionRow[] = [
  { look: "bladeRing", id: "BladeRing-Blue", strip: "#2A6AFF", rim: "#6AA8FF", base: "#050A1A" },
  { look: "bladeRing", id: "BladeRing-Copper", strip: "#E07A3A", rim: "#FFC08A", base: "#140804" },
  { look: "plateArc", id: "PlateArc-Blue", strip: "#2A6AFF", rim: "#6AA8FF", key: "#3A7AFF", base: "#0A1A5A" },
  { look: "segmentTorus", id: "SegmentTorus-BlueCoral", a: "#2A6AF0", b: "#FF7A5A", rim: "#B04AFF" },
  { look: "segmentTorus", id: "SegmentTorus-TealGold", a: "#1AB8B0", b: "#F0B84A", rim: "#4AF0D8" },
  { look: "chargeIcon", id: "ChargeIcon-Cyan", outline: "#E8FFFF", glow: "#2AD8FF", fill: false, shares: [0.45, 0.25, 0.2, 0.1] },
  { look: "chargeIcon", id: "ChargeIcon-GreenFill", outline: "#6AFFC8", glow: "#2AE8A0", fill: true, shares: [0.5, 0.38, 0.12, 0] },
  { look: "chargeGauge", id: "ChargeGauge-Story", dial: "#5AB8FF", percent: "#5AC8FF", eco: "#2AC85A" },
];
