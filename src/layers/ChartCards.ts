import { random } from 'remotion';
import { HEIGHT, WIDTH, type Depth } from '../config';
import { alpha, ctx2d, makeCanvas } from '../plane';
import type { Variant, VariantId } from '../variants';

type CardSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'bars' | 'scatter' | 'line';
  depth: Depth;
  opacity: number;
  amber: boolean;
};

/**
 * ChartCards — semi-transparent panels of faint data scattered on the plane.
 *
 * Deliberately illegible: they are texture and depth, not information. One
 * amber-tinted card sits lower-left and is the only warm rectangle in frame.
 */
const SPECS: CardSpec[] = [
  { x: 0.03, y: 0.6, w: 0.15, h: 0.13, kind: 'bars', depth: 'mid', opacity: 0.9, amber: true },
  { x: 0.72, y: 0.08, w: 0.19, h: 0.14, kind: 'scatter', depth: 'far', opacity: 0.5, amber: false },
  { x: 0.62, y: 0.79, w: 0.22, h: 0.13, kind: 'line', depth: 'far', opacity: 0.45, amber: false },
  { x: 0.05, y: 0.11, w: 0.13, h: 0.1, kind: 'line', depth: 'far', opacity: 0.4, amber: false },
  { x: 0.86, y: 0.44, w: 0.16, h: 0.19, kind: 'bars', depth: 'mid', opacity: 0.55, amber: false },
  { x: 0.24, y: 0.86, w: 0.17, h: 0.11, kind: 'scatter', depth: 'mid', opacity: 0.5, amber: false },
];

export type BakedCard = { canvas: HTMLCanvasElement; spec: CardSpec };

export const bakeChartCards = (id: VariantId, v: Variant): BakedCard[] =>
  SPECS.map((spec, i) => {
    const p = v.palette;
    const w = spec.w * WIDTH;
    const h = spec.h * HEIGHT;
    const c = makeCanvas(w, h);
    const ctx = ctx2d(c);
    const seed = `card-${id}-${i}`;
    const tint = spec.amber ? p.accentAmber : p.cardTint;

    ctx.fillStyle = alpha(tint, spec.amber ? 0.66 : 0.62);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = alpha(spec.amber ? p.accentAmber : p.gridLine, 0.65);
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

    const ink = spec.amber ? p.labelWhite : p.countryFill;
    const pad = Math.min(w, h) * 0.14;
    const iw = w - pad * 2;
    const ih = h - pad * 2;

    if (spec.kind === 'bars') {
      const n = 9;
      const bw = (iw / n) * 0.62;
      for (let b = 0; b < n; b++) {
        const bh = ih * (0.18 + random(`${seed}-b${b}`) * 0.82);
        ctx.fillStyle = alpha(ink, 0.4 + random(`${seed}-o${b}`) * 0.3);
        ctx.fillRect(pad + (iw / n) * b, pad + ih - bh, bw, bh);
      }
    } else if (spec.kind === 'scatter') {
      for (let d = 0; d < 46; d++) {
        const px = pad + random(`${seed}-x${d}`) * iw;
        const py = pad + random(`${seed}-y${d}`) * ih;
        ctx.fillStyle = alpha(ink, 0.25 + random(`${seed}-a${d}`) * 0.5);
        const r = 3 + random(`${seed}-r${d}`) * 6;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = alpha(ink, 0.6);
      ctx.lineWidth = 3.5;
      for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        const n = 14;
        for (let k = 0; k <= n; k++) {
          const px = pad + (iw / n) * k;
          const py = pad + ih * (0.25 + random(`${seed}-l${s}-${k}`) * 0.6);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.globalAlpha = s === 0 ? 1 : 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Header rule — reads as a card title without ever being legible.
    ctx.fillStyle = alpha(ink, 0.55);
    ctx.fillRect(pad, pad * 0.45, iw * 0.42, 8);
    return { canvas: c, spec };
  });

export const drawChartCards = (
  ctx: CanvasRenderingContext2D,
  cards: BakedCard[],
  depth: Depth
) => {
  for (const { canvas, spec } of cards) {
    if (spec.depth !== depth) continue;
    ctx.globalAlpha = spec.opacity;
    ctx.drawImage(canvas, spec.x * WIDTH, spec.y * HEIGHT);
    ctx.globalAlpha = 1;
  }
};
