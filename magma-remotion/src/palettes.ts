/**
 * Seven stops each, cool -> hot. The top stop is near-white on purpose: that
 * blowout at the vein cores is what makes the surface read as emissive rather
 * than painted.
 */
export type Palette = {
  /** Composition id. Remotion allows only a-z, A-Z, 0-9 and `-` here. */
  readonly id: string;
  /** Basename of the delivered file, which does use underscores. */
  readonly outName: string;
  readonly label: string;
  readonly stops: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
};

export const PALETTES: readonly Palette[] = [
  {
    id: "V1-MagmaOrange",
    outName: "V1_MagmaOrange",
    label: "Magma / lava",
    stops: [
      "#050303",
      "#2a0a05",
      "#8a1e05",
      "#e04a08",
      "#ff9a1a",
      "#ffe066",
      "#fff6d0",
    ],
  },
  {
    id: "V2-PlasmaBlue",
    outName: "V2_PlasmaBlue",
    label: "Blue plasma",
    stops: [
      "#020408",
      "#0a1a3a",
      "#1050a0",
      "#22a8e0",
      "#7ad4ff",
      "#bfe9ff",
      "#e8f8ff",
    ],
  },
  {
    id: "V3-ToxicGreen",
    outName: "V3_ToxicGreen",
    label: "Toxic green",
    stops: [
      "#020604",
      "#0a2a10",
      "#1a7a20",
      "#4ade50",
      "#a8f060",
      "#d0f890",
      "#e8ffd0",
    ],
  },
];

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
