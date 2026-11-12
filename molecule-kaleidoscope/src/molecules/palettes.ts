export type RGB = [number, number, number];

export type MoleculePalette = {
  /** Paper / backdrop colour (centre). */
  background: RGB;
  /** Backdrop colour towards the corners (soft vignette). */
  backgroundEdge: RGB;
  /** Colour of the printed dot grid. */
  dot: RGB;
  dotOpacity: number;
  /** Tint of the soft contact shadow under the molecules. */
  shadow: RGB;
  shadowStrength: number;
  /** The three "atom" colours. */
  red: RGB;
  pale: RGB;
  yellow: RGB;
  /** Translucent goo colour used for the bonds / necks. */
  goo: RGB;
  /** Sub-surface rim colour around every blob silhouette. */
  rim: RGB;
  /** Specular highlight intensity. */
  specular: number;
};

const hex = (h: string): RGB => {
  const v = parseInt(h.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

/** Version 1 – sampled from the reference footage. */
export const REFERENCE_PALETTE: MoleculePalette = {
  background: hex("#c7e5ea"),
  backgroundEdge: hex("#c5e3e8"), // the reference has no visible vignette
  dot: hex("#9fb85f"),
  dotOpacity: 0.55,
  shadow: hex("#7fa3ab"),
  shadowStrength: 0.42,
  red: hex("#f0605b"),
  pale: hex("#c0e4ef"),
  yellow: hex("#c3c955"),
  goo: hex("#ec6a5e"),
  rim: hex("#e0583e"),
  specular: 0.32,
};

/** Version 2 – "midnight neon": same scene, inverted value structure. */
export const MIDNIGHT_PALETTE: MoleculePalette = {
  background: hex("#18203f"),
  backgroundEdge: hex("#0c1128"),
  dot: hex("#4f6bb8"),
  dotOpacity: 0.55,
  shadow: hex("#04060f"),
  shadowStrength: 0.65,
  red: hex("#ff3f86"),
  pale: hex("#62efff"),
  yellow: hex("#ffb52e"),
  goo: hex("#f23d8a"),
  rim: hex("#ff7ad0"),
  specular: 0.45,
};
