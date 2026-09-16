// The two graded versions of the piece.
//
// Colours are authored as linear-light RGB triples, not CSS strings: the
// scene renders in linear HDR and is tone mapped at the end of the post
// chain, so the emissive values below are free to exceed 1 and that is
// exactly what drives the bloom and the white-hot glyph cores.

export type ColorwayName = "blue" | "teal";

export type Colorway = {
  /** Background, and the colour the fog dissolves the field into. */
  background: [number, number, number];
  /** Unlit face colour: the near-black the blocks sit at. */
  face: [number, number, number];
  /** Tint of the glowing code text. */
  glyph: [number, number, number];
  /** Emissive gain on the glyphs; above 1 so the cores clip to white. */
  glyphGain: number;
  /** Thin hot line along every block edge. */
  edge: [number, number, number];
  /** Wide soft falloff inboard of each edge. */
  edgeHalo: [number, number, number];
  /** Grazing-angle sheen, which is what makes the faces read as glass. */
  rim: [number, number, number];
};

export const COLORWAYS: Record<ColorwayName, Colorway> = {
  // Graded to the reference: deep navy blacks, electric blue glow, glyph
  // cores burning out to white.
  blue: {
    background: [0.0016, 0.0026, 0.0055],
    face: [0.0022, 0.0048, 0.0104],
    glyph: [0.36, 0.66, 1.0],
    glyphGain: 9.0,
    edge: [0.24, 0.62, 1.0],
    edgeHalo: [0.07, 0.24, 0.52],
    rim: [0.16, 0.42, 0.78],
  },
  // The same grade rotated to teal: aqua glow over a green-shifted black,
  // glyph cores still burning out to white so the two versions cut
  // together.
  teal: {
    background: [0.0014, 0.0038, 0.0038],
    face: [0.002, 0.0079, 0.0075],
    glyph: [0.22, 0.86, 0.79],
    glyphGain: 8.5,
    edge: [0.1, 0.88, 0.76],
    edgeHalo: [0.03, 0.3, 0.27],
    rim: [0.08, 0.5, 0.45],
  },
};
