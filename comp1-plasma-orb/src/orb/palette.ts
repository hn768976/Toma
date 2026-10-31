/**
 * Colour ramp sampled from the reference footage (pixel colours bucketed by
 * luminance). Intensity 0 -> background, 1 -> hottest highlight.
 */
export type Palette = {
  stops: number[];
  colors: [number, number, number][];
  hot: [number, number, number];
};

export const CYAN_PLASMA: Palette = {
  stops: [0.0, 0.1, 0.24, 0.4, 0.56, 0.72, 0.88, 1.0],
  colors: [
    [0, 0, 0],
    [1, 40, 72],
    [8, 92, 145],
    [16, 142, 196],
    [17, 191, 230],
    [36, 227, 247],
    [100, 248, 253],
    [200, 254, 255],
  ],
  hot: [215, 255, 255],
};
