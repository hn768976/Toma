/**
 * Seven stops each, cool -> hot. The top stop is near-white on purpose: that
 * blowout at the vein cores is what makes the surface read as emissive rather
 * than painted.
 *
 * `heatGamma` exists because the three ramps are not equally luminous at the
 * same nominal darkness — green especially. Swapping the ramp alone, the toxic
 * green version kept only 2.3% of its pixels below level 24 against the magma
 * version's 11%, which washes the dark crust plates towards mid-green and
 * costs the crust contrast the whole texture is built on. The gamma is applied
 * to the field before the colour lookup, so every version still uses exactly
 * the specified hex stops at exactly the same points of the ramp; only the
 * distribution of field values feeding it is corrected.
 *
 * They are deliberately not normalised all the way to the magma version:
 * plasma and acid ought to read hotter than cooling lava, so the two keep some
 * of their extra luminance.
 */
export type Palette = {
  /** Composition id. Remotion allows only a-z, A-Z, 0-9 and `-` here. */
  readonly id: string;
  /** Basename of the delivered file, which does use underscores. */
  readonly outName: string;
  readonly label: string;
  /** Exposure applied to the field before the colour lookup. */
  readonly heatGamma: number;
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
    heatGamma: 1.0,
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
    heatGamma: 1.10,
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
    heatGamma: 1.16,
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
