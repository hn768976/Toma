export type DnaPalette = {
  /** Emissive colour of the thin leading wires, rungs and growing tips (linear RGB). */
  wire: [number, number, number];
  /** Emissive colour of the marker rings. */
  ring: [number, number, number];
  /** Body colour of the thick segmented strand. */
  shellA: [number, number, number];
  /** Body colour of the thin glassy strand. */
  shellB: [number, number, number];
  /** Fresnel rim colour of the thick strand. */
  rim: [number, number, number];
  /** Specular highlight tint. */
  spec: [number, number, number];
  bgInner: [number, number, number];
  bgOuter: [number, number, number];
};

/** Version 1 - matches the reference: cyan wires, red markers, gun-metal strands on teal-black. */
export const CYAN_RED: DnaPalette = {
  wire: [0.03, 0.78, 0.86],
  ring: [1.0, 0.035, 0.07],
  shellA: [0.016, 0.02, 0.027],
  shellB: [0.02, 0.07, 0.09],
  rim: [0.3, 0.42, 0.56],
  spec: [0.86, 0.93, 1.0],
  bgInner: [0.0005, 0.0032, 0.0045],
  bgOuter: [0.0001, 0.0006, 0.001],
};

/** Version 2 - alternative palette: molten-gold wires, violet markers, bronze strands on deep indigo. */
export const GOLD_VIOLET: DnaPalette = {
  wire: [1.0, 0.5, 0.06],
  ring: [0.5, 0.1, 1.0],
  shellA: [0.03, 0.02, 0.017],
  shellB: [0.1, 0.05, 0.012],
  rim: [0.62, 0.4, 0.24],
  spec: [1.0, 0.92, 0.8],
  bgInner: [0.005, 0.0014, 0.009],
  bgOuter: [0.001, 0.0003, 0.0025],
};

export const PALETTES = { cyanRed: CYAN_RED, goldViolet: GOLD_VIOLET } as const;
export type PaletteName = keyof typeof PALETTES;
