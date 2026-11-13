export type RGB = [number, number, number];

export type BlobPalette = {
  /** Albedo of every dot. */
  dot: RGB;
  /** Specular / hot highlight on dots. */
  highlight: RGB;
  /** Colour of the shadowed "skin" visible in the gaps between dots. */
  skin: RGB;
  /** Back / rim light that wraps the silhouette. */
  rim: RGB;
  /** Shadow tint (ambient term). */
  ambient: RGB;
  /** Background radial gradient stops: [distance in half-heights, colour]. */
  background: Array<[number, RGB]>;
};

const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Version 1 – sampled from the reference: cobalt dots on a navy studio sweep. */
export const COBALT: BlobPalette = {
  dot: hex("#2b5fc4"),
  highlight: hex("#a9c8ff"),
  skin: hex("#0b2a66"),
  rim: hex("#8fb4ff"),
  ambient: hex("#0a2461"),
  background: [
    [0.0, hex("#86a6dc")],
    [0.75, hex("#5f7fb8")],
    [1.0, hex("#3c5c96")],
    [1.35, hex("#183563")],
    [1.8, hex("#06203f")],
    [2.3, hex("#011330")],
  ],
};

/** Version 2 – alternative palette: molten ember dots on a deep plum sweep. */
export const EMBER: BlobPalette = {
  dot: hex("#ff6a3a"),
  highlight: hex("#ffe0b0"),
  skin: hex("#5a0e1c"),
  rim: hex("#ffb36b"),
  ambient: hex("#4d0b24"),
  background: [
    [0.0, hex("#bb5a7c")],
    [0.75, hex("#8e3a64")],
    [1.0, hex("#682853")],
    [1.35, hex("#351434")],
    [1.8, hex("#1a0a1f")],
    [2.3, hex("#0b0410")],
  ],
};
