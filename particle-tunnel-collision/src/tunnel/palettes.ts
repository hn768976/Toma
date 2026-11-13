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
  lineNear: [42, 194, 250],
  lineMid: [30, 138, 205],
  lineFar: [36, 170, 178],
  beadNear: [170, 246, 255],
  beadFar: [74, 200, 206],
  bloom: [60, 190, 230],
};

/** Version 2 — alternative "ember" palette: amber / red-orange / crimson on warm black. */
export const EMBER_ALT: TunnelPalette = {
  bgCenter: [3, 1, 1],
  bgMid: [17, 7, 6],
  bgEdge: [9, 4, 4],
  lineNear: [255, 172, 70],
  lineMid: [240, 82, 48],
  lineFar: [178, 34, 70],
  beadNear: [255, 236, 186],
  beadFar: [255, 128, 84],
  bloom: [255, 120, 60],
};
