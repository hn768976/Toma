/** RGB triplet, 0-255. */
export type RGB = readonly [number, number, number];

export type TunnelPalette = {
  /** Background radial gradient: centre, mid ring, outer corners. */
  bgCenter: RGB;
  bgMid: RGB;
  bgEdge: RGB;
  /** String colours from the camera (near) into the tunnel (far). */
  lineNear: RGB;
  lineMid: RGB;
  lineFar: RGB;
  /** Bead colours: hot near the camera, tinted deep in the tunnel. */
  beadNear: RGB;
  beadFar: RGB;
  /** Bloom tint multiplier. */
  bloom: RGB;
};

/** Version 1 — matches the reference: cyan / teal strings on deep navy. */
export const CYAN_MATCH: TunnelPalette = {
  bgCenter: [1, 5, 8],
  bgMid: [7, 20, 30],
  bgEdge: [4, 13, 20],
  lineNear: [92, 222, 245],
  lineMid: [38, 132, 190],
  lineFar: [44, 168, 170],
  beadNear: [205, 250, 255],
  beadFar: [92, 214, 190],
  bloom: [60, 190, 230],
};

/** Version 2 — alternative "ember nebula" palette: magenta / amber on plum. */
export const EMBER_ALT: TunnelPalette = {
  bgCenter: [5, 1, 6],
  bgMid: [26, 7, 28],
  bgEdge: [14, 4, 17],
  lineNear: [255, 178, 84],
  lineMid: [222, 62, 140],
  lineFar: [138, 70, 214],
  beadNear: [255, 238, 200],
  beadFar: [240, 140, 230],
  bloom: [255, 110, 120],
};
