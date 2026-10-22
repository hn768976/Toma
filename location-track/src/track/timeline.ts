// Shot timing, measured from the reference (10.04 s; rendered as 301 frames @ 30 fps).
//
// 0.0 – 2.93 s  Map A (wide). Slow drone pull-back: zoom 1.38 -> 1.0 while the
//               view drifts down from the airfield onto the compound.
// 2.93 s        Hard switch with a soft flash into Map B, punched in and defocused.
// 2.93 – 4.3 s  Map B pulls out (ease-out) and resolves to sharp by ~4.1 s.
// 4.3 – 10 s    Map B keeps easing out very slowly.

import { mix, smoothstep } from "./random";

export type View = {
  map: "A" | "B";
  zoom: number;
  cx: number; // layout point at the screen centre
  cy: number;
  blur: number; // extra mip bias (0 = sharp)
  flash: number; // additive exposure (0..1)
  exposure: number;
};

export const SWITCH_T = 2.93;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

export const viewAt = (t: number): View => {
  if (t < SWITCH_T) {
    const p = t / SWITCH_T;
    const e = p * 0.85 + smoothstep(0, 1, p) * 0.15;
    const pre = smoothstep(SWITCH_T - 0.12, SWITCH_T, t);
    return {
      map: "A",
      zoom: mix(1.38, 1.0, e) * (1 + pre * 0.08),
      cx: mix(596, 600, e),
      cy: mix(440, 334, e),
      blur: pre * 3.0,
      flash: pre * 0.25,
      exposure: 1,
    };
  }
  const u = (t - SWITCH_T) / (4.3 - SWITCH_T);
  const settle = easeOutCubic(Math.min(1, u));
  const tail = smoothstep(4.3, 10.1, t);
  const zoom = mix(1.5, 1.1, settle) * mix(1, 0.91, tail);
  const sharpen = 1 - smoothstep(SWITCH_T + 0.25, 4.1, t);
  const flash = Math.exp(-(t - SWITCH_T) / 0.14) * 0.3;
  return {
    map: "B",
    zoom,
    cx: mix(560, 596, settle) + tail * 6,
    cy: mix(330, 338, settle) + tail * 4,
    blur: sharpen * 4.2,
    flash,
    exposure: 1 + sharpen * 0.35,
  };
};

// Layout point -> layout-frame screen point (1192 x 672 space).
export const toScreen = (v: View, x: number, y: number): [number, number] => [
  (x - v.cx) * v.zoom + 596,
  (y - v.cy) * v.zoom + 336,
];

// Typewriter helper: how many characters of `text` are visible at time t.
export const typed = (text: string, t: number, start: number, cps: number) => {
  const n = Math.floor((t - start) * cps);
  return text.slice(0, Math.max(0, Math.min(text.length, n)));
};
