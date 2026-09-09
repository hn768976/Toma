import {rnd} from '../rand';
import type {DrawCtx} from './types';

const CONTROL_SPACING = 190; // design px between contour control points

const cosineLerp = (a: number, b: number, t: number): number => {
  const f = (1 - Math.cos(t * Math.PI)) / 2;
  return a + (b - a) * f;
};

/**
 * The film gate: an imperfect mask intruding a small distance from the top and
 * bottom of frame, with an irregular contour. It is physical hardware, so the
 * contour is fixed for the whole clip — only the weave moves it.
 */
const drawEdge = (d: DrawCtx, top: boolean): void => {
  const {ctx, w, h, s, v} = d;
  const seed = v.seed ^ (top ? 0x6a71 : 0x6a72);

  const step = CONTROL_SPACING * s;
  // Overshoot both sides so the weave never uncovers a sliver at the edge.
  const overshoot = Math.max(24, 40 * s);
  const points = Math.ceil((w + overshoot * 2) / step) + 1;

  const depthAt = (i: number): number =>
    (16 + rnd(seed, i, 0x6a80) * 18 + rnd(seed, i, 0x6a81) * 8) * s;

  ctx.save();
  ctx.filter = `blur(${Math.max(2, 9 * s)}px)`;
  ctx.fillStyle = 'rgba(6,6,6,0.94)';
  ctx.beginPath();
  ctx.moveTo(-overshoot, top ? -h : h * 2);
  for (let k = 0; k < points; k++) {
    const x0 = -overshoot + k * step;
    const x1 = x0 + step;
    const d0 = depthAt(k);
    const d1 = depthAt(k + 1);
    const sub = 6;
    for (let j = 0; j <= sub; j++) {
      const t = j / sub;
      const x = x0 + (x1 - x0) * t;
      const depth = cosineLerp(d0, d1, t);
      ctx.lineTo(x, top ? depth : h - depth);
    }
  }
  ctx.lineTo(w + overshoot, top ? -h : h * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/**
 * Top and bottom only. Nothing is drawn down the left and right edges: a dark
 * band there would act as a vignette, and under multiply that darkens the
 * buyer's frame edges.
 */
export const drawGate = (d: DrawCtx): void => {
  if (!d.v.gateBorder) {
    return;
  }
  drawEdge(d, true);
  drawEdge(d, false);
};
