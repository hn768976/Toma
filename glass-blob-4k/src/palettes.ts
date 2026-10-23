export type Palette = {
  // Background gradient (centre -> edge), display (sRGB) values 0..1.
  bgInner: [number, number, number];
  bgOuter: [number, number, number];
  // Body tint seen through the glass.
  tint: [number, number, number];
  // Thin-film phase offsets per channel (cosine palette) and hue span.
  filmPhase: [number, number, number];
  filmSpan: number;
  filmBias: [number, number, number];
  filmGain: [number, number, number];
  // Studio light colour used for reflections.
  key: [number, number, number];
  // Overall iridescence strength.
  irid: number;
};

export const PALETTES = {
  // Clear glass with full-spectrum rainbow thin-film, neutral studio light.
  reference: {
    bgInner: [0.012, 0.012, 0.013],
    bgOuter: [0.0, 0.0, 0.0],
    tint: [0.32, 0.42, 0.95],
    filmPhase: [0.0, 0.33, 0.67],
    filmSpan: 1.6,
    filmBias: [0.5, 0.5, 0.5],
    filmGain: [0.5, 0.5, 0.5],
    key: [0.95, 0.97, 1.0],
    irid: 1.0,
  },
  // Dichroic gold / rose / teal film over smoky amber glass on deep plum.
  dichroicGold: {
    bgInner: [0.11, 0.035, 0.1],
    bgOuter: [0.02, 0.004, 0.025],
    tint: [0.95, 0.55, 0.28],
    filmPhase: [0.0, 0.12, 0.3],
    filmSpan: 0.6,
    filmBias: [0.78, 0.5, 0.4],
    filmGain: [0.28, 0.35, 0.35],
    key: [1.0, 0.86, 0.7],
    irid: 1.05,
  },
} satisfies Record<string, Palette>;
