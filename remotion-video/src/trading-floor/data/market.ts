// The instrument the quote and chart windows are focused on: its order
// book, its own print stream, its candle history and its intraday curve.
// Every function here is a pure function of the frame.

import { FPS, CANDLE_ROLL_PERIOD, CANDLE_TICK_PERIOD } from "../constants";
import { mulberry32, noise2, piecewise } from "./random";
import { FOCUS_LAST } from "./symbols";

/* ------------------------------------------------------------------ */
/* Order book                                                          */
/* ------------------------------------------------------------------ */

export const BOOK_LEVELS = 10;
export const TICK_SIZE = 0.25;

export type BookLevel = {
  bidPrice: number;
  bidVolume: number;
  bidShare: number; // 0..1, drives the depth micro-bar
  offerPrice: number;
  offerVolume: number;
  offerShare: number;
};

// Each level refreshes on its own cadence (3-7 updates/sec) so the ladder
// flickers unevenly, the way a real depth window does.
const levelEpoch = (level: number, frame: number): number => {
  const period = 4 + Math.floor(noise2(level, 7, 11) * 6);
  return Math.floor(frame / period);
};

const levelVolume = (level: number, side: number, frame: number): number => {
  const epoch = levelEpoch(level + side * 32, frame);
  const base = 1500 + noise2(level, side, 3) * 48000;
  const jitter = 0.45 + noise2(level + side * 64, epoch, 19) * 1.1;
  return Math.max(100, Math.round((base * jitter) / 100) * 100);
};

export const orderBook = (frame: number): BookLevel[] => {
  const levels: BookLevel[] = [];
  let maxVol = 1;
  for (let i = 0; i < BOOK_LEVELS; i++) {
    const bidVolume = levelVolume(i, 0, frame);
    const offerVolume = levelVolume(i, 1, frame);
    maxVol = Math.max(maxVol, bidVolume, offerVolume);
    levels.push({
      bidPrice: FOCUS_LAST - i * TICK_SIZE,
      bidVolume,
      bidShare: 0,
      offerPrice: FOCUS_LAST + (i + 1) * TICK_SIZE,
      offerVolume,
      offerShare: 0,
    });
  }
  for (const l of levels) {
    l.bidShare = l.bidVolume / maxVol;
    l.offerShare = l.offerVolume / maxVol;
  }
  return levels;
};

// Which ladder row carries the hover highlight; it moves every ~2s.
export const bookHighlightRow = (frame: number): number =>
  Math.floor(noise2(Math.floor(frame / 61), 5, 91) * BOOK_LEVELS);

/* ------------------------------------------------------------------ */
/* Time & sales for the focus instrument                               */
/* ------------------------------------------------------------------ */

export type FocusPrint = {
  frame: number;
  side: "B" | "S";
  volume: number;
  price: number;
  change: number;
};

export const buildFocusPrints = (
  seed: number,
  totalFrames: number,
  rowsPerSecond: number,
): FocusPrint[] => {
  const rnd = mulberry32(seed);
  const meanGap = FPS / rowsPerSecond;
  const out: FocusPrint[] = [];
  let frame = -Math.ceil(meanGap * 40);

  while (frame < totalFrames) {
    // A quiet name: nearly every print crosses at the same level, with an
    // occasional tick away from it.
    const r = rnd();
    const offset = r < 0.82 ? 0 : r < 0.93 ? TICK_SIZE : -TICK_SIZE;
    const lot = rnd();
    const volume =
      lot < 0.45
        ? 100
        : lot < 0.72
          ? 100 * (2 + Math.floor(rnd() * 4))
          : lot < 0.93
            ? 100 * (5 + Math.floor(rnd() * 15))
            : 100 * (20 + Math.floor(rnd() * 40));
    out.push({
      frame,
      side: rnd() < 0.52 ? "B" : "S",
      volume,
      price: FOCUS_LAST + offset,
      change: offset,
    });
    frame += Math.max(1, Math.round(meanGap * (0.4 + rnd() * 1.5)));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Candle series for the chart window                                  */
/* ------------------------------------------------------------------ */

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const CANDLE_COUNT = 88;

// The shape of the session, traced from the reference: a long grind down,
// a violent spike, then a fade with a small recovery into the close.
const SHAPE = [
  { x: 0.0, y: 3.44 },
  { x: 0.06, y: 3.46 },
  { x: 0.14, y: 3.44 },
  { x: 0.24, y: 3.41 },
  { x: 0.34, y: 3.38 },
  { x: 0.44, y: 3.33 },
  { x: 0.52, y: 3.3 },
  { x: 0.57, y: 3.29 },
  { x: 0.6, y: 3.3 },
  { x: 0.63, y: 3.47 },
  { x: 0.68, y: 3.45 },
  { x: 0.74, y: 3.42 },
  { x: 0.8, y: 3.39 },
  { x: 0.86, y: 3.38 },
  { x: 0.92, y: 3.36 },
  { x: 1.0, y: 3.375 },
];

// `extra` bars are appended as the clip runs, so the chart scrolls left.
export const buildCandles = (extra: number, liveClose: number): Candle[] => {
  const total = CANDLE_COUNT + extra;
  const out: Candle[] = [];
  let prevClose = SHAPE[0].y;

  for (let i = 0; i < total; i++) {
    const t = i / (CANDLE_COUNT - 1);
    const target = piecewise(SHAPE, Math.min(t, 1));
    const wobble = (noise2(i, 1, 77) - 0.5) * 0.018;
    const close =
      i === total - 1 ? liveClose : Math.round((target + wobble) * 1000) / 1000;
    const open = i === 0 ? close - 0.004 : prevClose;
    const spread = 0.004 + noise2(i, 2, 13) * 0.02;
    const high = Math.max(open, close) + spread * noise2(i, 3, 31);
    const low = Math.min(open, close) - spread * noise2(i, 4, 53);
    out.push({
      open,
      high,
      low,
      close,
      volume: 0.15 + noise2(i, 5, 97) * 0.85,
    });
    prevClose = close;
  }

  // The spike bar carries the session's volume.
  const spikeIndex = Math.round(0.625 * (CANDLE_COUNT - 1));
  if (out[spikeIndex]) out[spikeIndex].volume = 1;
  return out;
};

export const chartState = (frame: number) => {
  const extra = Math.floor(Math.max(0, frame) / CANDLE_ROLL_PERIOD);
  const tick = Math.floor(Math.max(0, frame) / CANDLE_TICK_PERIOD);
  const base = SHAPE[SHAPE.length - 1].y;
  const liveClose =
    Math.round((base + (noise2(tick, 9, 41) - 0.5) * 0.03) * 1000) / 1000;
  const candles = buildCandles(extra, liveClose);
  const prevClose = 3.42;
  return {
    candles,
    last: liveClose,
    prevClose,
    change: liveClose - prevClose,
    changePct: ((liveClose - prevClose) / prevClose) * 100,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
  };
};

/* ------------------------------------------------------------------ */
/* Intraday curve for the small mountain chart                         */
/* ------------------------------------------------------------------ */

export const INTRADAY_POINTS = 160;

// Trading happened in a burst at the open and the name has been inert
// since, which is why the reference only draws a mountain on the left
// third and a flat average line across the rest.
export const intradaySeries = (frame: number): number[] => {
  const out: number[] = [];
  const epoch = Math.floor(Math.max(0, frame) / 18);
  for (let i = 0; i < INTRADAY_POINTS; i++) {
    const t = i / (INTRADAY_POINTS - 1);
    const y = piecewise(
      [
        { x: 0.0, y: 82.5 },
        { x: 0.05, y: 82.5 },
        { x: 0.08, y: 82.72 },
        { x: 0.11, y: 83.28 },
        { x: 0.13, y: 83.05 },
        { x: 0.16, y: 82.94 },
        { x: 0.19, y: 82.62 },
        { x: 0.22, y: 82.5 },
        { x: 1.0, y: 82.5 },
      ],
      t,
    );
    const live = i === INTRADAY_POINTS - 1 ? (noise2(epoch, 3, 7) - 0.5) * 0.02 : 0;
    out.push(y + (y > 82.5 ? (noise2(i, 6, 23) - 0.5) * 0.05 : 0) + live);
  }
  return out;
};

export const INTRADAY_MIN = 82.2;
export const INTRADAY_MAX = 83.55;
export const INTRADAY_REF = 82.5;

/* ------------------------------------------------------------------ */
/* Buy/sell pressure gauges                                            */
/* ------------------------------------------------------------------ */

export type Gauge = {
  label: string;
  buyValue: number;
  sellValue: number;
  buyShare: number;
};

const GAUGE_DEFS = [
  { label: "Technology", scale: 4.2e4, base: 0.44 },
  { label: "Food & Beverage", scale: 3.1e7, base: 0.52 },
  { label: "Market", scale: 1.3e10, base: 0.49 },
];

export const gauges = (frame: number): Gauge[] => {
  const epoch = Math.floor(Math.max(0, frame) / 9);
  return GAUGE_DEFS.map((def, i) => {
    const drift = (noise2(epoch, i, 61) - 0.5) * 0.06;
    const slow = Math.sin((frame / FPS) * 0.35 + i) * 0.05;
    const buyShare = Math.min(0.86, Math.max(0.14, def.base + drift + slow));
    const total = def.scale * (0.9 + noise2(epoch, i + 10, 17) * 0.25);
    return {
      label: def.label,
      buyValue: total * buyShare,
      sellValue: total * (1 - buyShare),
      buyShare,
    };
  });
};
