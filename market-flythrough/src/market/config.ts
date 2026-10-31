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
  main: "#2fe6a6",
  hot: "#b8ffe2",
  glow: "#10a275",
};

/** Version 2: amber "trading terminal" palette - same scene, new colour story. */
export const AMBER_PALETTE: MarketPalette = {
  background: "#070401",
  main: "#ffaa33",
  hot: "#fff0cf",
  glow: "#a85a08",
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
const T = [0, 1.4, 2.7, 4.0, 4.8, 5.6, 6.45, 7.2, 7.95, 9.3, 10.7, 12.0, 13.34];
const keys = (vals: number[]) => track(T.map((t, i) => [t, vals[i]]));

const px = keys([
  0.0, 0.3, 0.9, 2.4, 3.55, 5.0, 6.35, 4.6, 2.9, -0.4, 0.6, 1.4, 1.9,
]);
const py = keys([
  0.35, 0.45, 0.75, 1.5, 2.45, 1.6, 0.95, 0.5, 0.15, 0.4, 0.2, 0.1, 0.0,
]);
const pz = keys([
  15, 11.4, 7.6, 3.6, 0.75, -0.2, -0.62, -3.0, -5.95, -10.6, -13.6, -16.2,
  -18.6,
]);

const lx = keys([
  -0.4, 0.0, 0.6, 2.6, 4.6, 6.2, 6.6, 3.8, 3.2, -1.8, 1.0, 1.4, 1.0,
]);
const ly = keys([
  0.0, 0.2, 0.6, 1.4, 1.6, 1.0, 0.8, -0.2, -0.4, 0.9, 0.4, 0.3, 0.2,
]);
const lz = keys([0, -1, -2, -3, -4, -5, -6, -9, -11, -17, -24, -30, -38]);

const roll = keys([-2, -1.5, -0.5, 2, 5, 3, 1.5, -3, -4, -1.5, 1, 1.5, 2.5]);

export const marketCamera = (t: number): MarketCamera => ({
  pos: [px(t), py(t), pz(t)],
  look: [lx(t), ly(t), lz(t)],
  roll: roll(t),
});
