// Shot timing, measured from the reference (10.04 s; rendered as 301 frames @ 30 fps).
//
// 0.0 – 2.77 s   Map A (wide). Slow drone pull-back: zoom 1.38 -> 1.0 while the
//                view drifts down from the airfield onto the compound.
// 2.77 – 3.07 s  Crossfade: Map A keeps pushing in and softens while Map B fades in
//                over it, defocused.
// 3.07 – 3.9 s   Map B resolves to sharp.
// 3.9 – 10 s     Map B holds, with a barely perceptible drift.

import { mix, smoothstep } from "./random";

export type MapCam = {
  zoom: number;
  cx: number; // layout point at the screen centre
  cy: number;
  blur: number; // extra mip LOD (0 = sharp)
  exposure: number;
};

export type View = {
  a: MapCam;
  b: MapCam;
  mix: number; // 0 = only map A, 1 = only map B
};

export const FADE_START = 2.77;
export const FADE_END = 3.07;

export const viewAt = (t: number): View => {
  const p = Math.min(1, t / FADE_START);
  const e = p * 0.85 + smoothstep(0, 1, p) * 0.15;
  const push = smoothstep(FADE_START - 0.1, FADE_END, t);
  const a: MapCam = {
    zoom: mix(1.38, 1.0, e) * (1 + push * 0.1),
    cx: mix(596, 600, e),
    cy: mix(440, 334, e),
    blur: push * 1.5,
    exposure: 1 + push * 0.08,
  };
  const sharpen = 1 - smoothstep(FADE_START + 0.15, 3.9, t);
  const hold = smoothstep(FADE_START, 10.1, t);
  const b: MapCam = {
    zoom: mix(1.07, 0.985, hold),
    cx: mix(590, 600, hold),
    cy: mix(332, 340, hold),
    blur: sharpen * 3.6,
    exposure: 1 + sharpen * 0.14,
  };
  return { a, b, mix: smoothstep(FADE_START, FADE_END, t) };
};

// Layout point on a map -> layout-frame screen point (1192 x 672 space).
export const toScreen = (c: MapCam, x: number, y: number): [number, number] => [
  (x - c.cx) * c.zoom + 596,
  (y - c.cy) * c.zoom + 336,
];

// Typewriter helper: how many characters of `text` are visible at time t.
export const typed = (text: string, t: number, start: number, cps: number) => {
  const n = Math.floor((t - start) * cps);
  return text.slice(0, Math.max(0, Math.min(text.length, n)));
};
