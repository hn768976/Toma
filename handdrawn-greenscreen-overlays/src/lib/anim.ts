import { interpolate } from 'remotion';
import { Pt } from './geom';

/** Pop-in scale: quick overshoot, evaluated on twos by the caller. */
export const popScale = (f: number, start: number) =>
  interpolate(f - start, [0, 2, 4, 6, 8, 10], [0.55, 1.2, 0.92, 1.05, 0.99, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** Periodic twinkle pulse after `from`: a quick scale bump every `period` frames. */
export const twinkle = (f: number, from: number, period: number, phase: number) => {
  if (f < from) return { s: 1, r: 0 };
  const k = (f - from + phase) % period;
  const s = interpolate(k, [0, 2, 4, 6, 8], [1, 1.14, 0.95, 1.03, 1], { extrapolateRight: 'clamp' });
  const r = interpolate(k, [0, 2, 4, 6], [0, 5, -3, 0], { extrapolateRight: 'clamp' });
  return { s, r };
};

export const scaleAbout = (c: Pt, s: number, rotDeg = 0) =>
  `translate(${c[0]} ${c[1]}) rotate(${rotDeg}) scale(${s}) translate(${-c[0]} ${-c[1]})`;
