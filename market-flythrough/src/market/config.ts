import { track } from "../three/util";

/** sRGB hex colours. */
export type MarketPalette = {
  /** Scene background (corners go to black through the vignette anyway). */
  background: string;
  /** Tables, candles, network lines. */
  main: string;
  /** Chart lines, flare cores, highlights. */
  hot: string;
  /** Large soft centre glow / haze. */
  glow: string;
};

export const GREEN_PALETTE: MarketPalette = {
  background: "#010605",
  main: "#3fd8a4",
  hot: "#c6ffeb",
  glow: "#0f7a5c",
};

/** Version 2: amber "trading terminal" palette - same scene, new colour story. */
export const AMBER_PALETTE: MarketPalette = {
  background: "#070401",
  main: "#ffaa33",
  hot: "#fff0cf",
  glow: "#8a4a08",
};

export type MarketCamera = {
  pos: [number, number, number];
  look: [number, number, number];
  roll: number;
};

// One continuous fly-through (13.333 s). Beats follow the reference:
// 0-4 s   slow push from a wide view onto the rising chart,
// 4-5.3 s the chart's head sweeps past the lens,
// 5.3-6.6 s dive into a ticker table until the symbols fill the frame,
// 6.6-8 s through the table - a second chart rushes past underneath,
// 8-10.7 s medium drift across a third chart, tables and candlesticks,
// 10.7-13.3 s the data dissolves into glow and network lines, a distant
//           chart sits in the centre like the opening frame.
const T = [0, 1.4, 2.7, 4.0, 5.0, 5.8, 6.45, 7.1, 8.0, 9.3, 10.7, 12.0, 13.34];
const keys = (vals: number[]) => track(T.map((t, i) => [t, vals[i]]));

const px = keys([
  0.0, 0.25, 0.7, 1.9, 3.6, 5.2, 6.35, 5.2, 2.6, 2.0, 2.6, 2.4, 2.1,
]);
const py = keys([
  0.3, 0.38, 0.55, 0.9, 1.25, 1.05, 0.95, 0.55, 0.2, -0.2, -0.35, -0.2, 0.0,
]);
const pz = keys([
  16, 13.4, 9.6, 5.3, 2.2, 0.55, -0.62, -2.5, -6.3, -9.6, -12.4, -14.6, -16.6,
]);

const lx = keys([
  -0.2, 0.0, 0.4, 1.6, 4.6, 6.0, 6.6, 4.4, 1.5, 0.6, 2.8, 1.6, 0.9,
]);
const ly = keys([
  0.0, 0.1, 0.3, 0.8, 0.9, 0.8, 0.8, -0.2, -0.6, -0.6, 0.2, 0.3, 0.2,
]);
const lz = keys([0, -1, -2, -3, -3.5, -4.5, -6, -9, -14, -18, -22, -26, -34]);

const roll = keys([-2, -1.5, -0.5, 1.5, 4, 3, 1.5, -2.5, -3, -1, 1, 0.5, 0]);

export const marketCamera = (t: number): MarketCamera => ({
  pos: [px(t), py(t), pz(t)],
  look: [lx(t), ly(t), lz(t)],
  roll: roll(t),
});
