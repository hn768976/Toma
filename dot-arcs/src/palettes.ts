export type Palette = {
  id: string;
  /** Background base. */
  bg: string;
  /** Glow bleeding in from the upper-right corner, as [r,g,b]. */
  glow: [number, number, number];
  glowStrength: number;
  /**
   * Six dot colours as [r,g,b]. Index 0 is the dominant hue; 1-5 are accents
   * and are pooled by the low-frequency colour field, not sprinkled.
   */
  dots: [number, number, number][];
  /** Selection weights for the accent colours (indices 1..5). */
  accentWeights: number[];
  /** How often a dot is allowed to be an accent at all. */
  accentAmount: number;
};

export const PALETTES: Record<string, Palette> = {
  v1: {
    id: 'v1',
    bg: '#0a1633',
    glow: [34, 190, 225],
    glowStrength: 0.62,
    dots: [
      [42, 111, 232], // #2a6fe8 blue, dominant
      [56, 198, 240], // cyan, pulled bluer so it never reads teal
      [224, 52, 122], // #e0347a magenta
      [240, 64, 58], // #f0403a red
      [226, 238, 255], // white
      [120, 168, 255], // pale blue, bridges the dominant to the highlights
    ],
    accentWeights: [0.1, 0.3, 0.16, 0.22, 0.22],
    accentAmount: 0.62,
  },
  v2: {
    id: 'v2',
    bg: '#1a0e04',
    glow: [255, 176, 72],
    glowStrength: 0.55,
    dots: [
      [224, 160, 32], // #e0a020 gold, dominant
      [240, 112, 32], // #f07020 orange
      [192, 48, 32], // #c03020 deep red
      [255, 226, 178], // warm white
      [255, 198, 96], // light gold
      [150, 92, 26], // dim bronze
    ],
    accentWeights: [0.3, 0.16, 0.18, 0.22, 0.14],
    accentAmount: 0.6,
  },
  v3: {
    id: 'v3',
    bg: '#08090c',
    glow: [226, 232, 240],
    glowStrength: 0.42,
    // Differentiated by brightness only. #c8ccd2 is the brief's named silver
    // and carries a faint cool cast by construction; every other tone is an
    // exact neutral grey, so the version grades to anything.
    dots: [
      [200, 204, 210], // #c8ccd2 silver, dominant
      [255, 255, 255], // white
      [144, 144, 144], // mid grey
      [227, 227, 227],
      [173, 173, 173],
      [115, 115, 115],
    ],
    accentWeights: [0.26, 0.24, 0.2, 0.16, 0.14],
    accentAmount: 0.72,
  },
};
