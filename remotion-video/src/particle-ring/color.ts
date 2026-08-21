import { COLOR_STOPS } from "./constants";

const hslToRgb = (h: number, s: number, l: number) => {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

// Interpolates the top->bottom gradient (COLOR_STOPS) at vertical
// position `t` (0 = top of ring, 1 = bottom) and returns a ready-to-use
// canvas rgb() string.
export const gradientColorAt = (t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (clamped >= COLOR_STOPS[i].t && clamped <= COLOR_STOPS[i + 1].t) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = upper.t - lower.t || 1;
  const localT = (clamped - lower.t) / span;
  const h = lower.h + (upper.h - lower.h) * localT;
  const s = lower.s + (upper.s - lower.s) * localT;
  const l = lower.l + (upper.l - lower.l) * localT;
  const { r, g, b } = hslToRgb(h, s, l);
  return `rgb(${r}, ${g}, ${b})`;
};
