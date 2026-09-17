// Colour lookup tables for the dot painter.
//
// The hot loop sets fillStyle for every LED on the panel. Building an
// `hsl(...)` string per dot would allocate tens of thousands of strings
// per frame and dominate the render, so brightness is quantised into a
// fixed ramp and the strings are built once and reused.

import { DATA_HUE, DATA_HUE_SPREAD } from "./constants";

export const LEVELS = 16;
export const HUE_BUCKETS = 5;

const ramp = (build: (t: number) => string) => {
  const out: string[] = [];
  for (let i = 0; i < LEVELS; i++) out.push(build(i / (LEVELS - 1)));
  return out;
};

const cache = new Map<string, string[][]>();

const buildTable = (key: string, hues: number[], sat: number, lit: [number, number]) => {
  let table = cache.get(key);
  if (table) return table;
  table = hues.map((hue) =>
    ramp((t) => `hsl(${hue.toFixed(1)} ${sat}% ${(lit[0] + (lit[1] - lit[0]) * t).toFixed(1)}%)`),
  );
  cache.set(key, table);
  return table;
};

// Blue data. The bucket index leans a column's hue toward cyan or deep
// blue so the wall has the uneven colour temperature of a real panel
// rather than one flat blue.
export const dataColors = () => {
  const hues: number[] = [];
  for (let i = 0; i < HUE_BUCKETS; i++) {
    hues.push(DATA_HUE + (i / (HUE_BUCKETS - 1) - 0.5) * 2 * DATA_HUE_SPREAD);
  }
  return buildTable("data", hues, 88, [22, 56]);
};

// Alert body: saturated red, kept off the top of the lightness range so
// the hot cores below have somewhere to sit.
export const alertColors = (hue: number) =>
  buildTable(`alert${hue}`, [hue], 94, [30, 56])[0];

// Hot cores — eyes, teeth, keyhole. These blow out toward white, which
// is what an over-driven LED does and what makes the icon read.
export const alertHotColors = (hue: number) =>
  buildTable(`hot${hue}`, [hue], 100, [62, 92])[0];

export const levelIndex = (brightness: number) => {
  const i = Math.round(brightness * (LEVELS - 1));
  return i < 0 ? 0 : i > LEVELS - 1 ? LEVELS - 1 : i;
};
