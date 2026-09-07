/**
 * Grey on white. Nothing here is brighter than the background and nothing is
 * near-black: on a high-key white field all the value comes from dark elements
 * held at low opacity, never from glow.
 */
export type Palette = {
  background: string;
  shellLight: string;
  shellDark: string;
  shellEdge: string;
  dotNear: string;
  dotFar: string;
  dotAccent: string;
  nodeNear: string;
  nodeFar: string;
  chordNear: string;
  chordFar: string;
};

/** V1 - the reference match: neutral, editorial, no hue anywhere. */
export const PALETTE_MONO: Palette = {
  background: "#ffffff",
  shellLight: "#f0f0f2",
  shellDark: "#d8d8dc",
  shellEdge: "#c4c4ca",
  dotNear: "#8a8a90",
  dotFar: "#d0d0d4",
  dotAccent: "#5f5f66",
  nodeNear: "#3a3a40",
  nodeFar: "#b0b0b6",
  chordNear: "#5a5a62",
  chordFar: "#c8c8ce",
};

/** V2 - identical, except the network carries corporate blue. Land stays grey. */
export const PALETTE_BLUE: Palette = {
  ...PALETTE_MONO,
  nodeNear: "#1f6feb",
  nodeFar: "#a8c8f0",
  chordNear: "#3d82ee",
  chordFar: "#bcd6f5",
};

/** sRGB hex -> plain 0..1 RGB triple. Colour management is off, so this is literal. */
export const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

/**
 * Pre-divide a colour by the alpha it will be drawn at, so that compositing it
 * over the white background lands exactly on the colour the palette names.
 *
 * The shell has to be translucent (the back of the network must show through)
 * and it also has to render as the specified greys. Without this the two pull
 * against each other and the sphere washes out toward white.
 */
export const overWhite = (
  hex: string,
  alpha: number,
): [number, number, number] => {
  const [r, g, b] = rgb(hex);
  const f = (c: number) => Math.max(0, Math.min(1, 1 - (1 - c) / alpha));
  return [f(r), f(g), f(b)];
};
