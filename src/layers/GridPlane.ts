import { random } from 'remotion';
import { CONFIG } from '../config';
import { alpha, ctx2d, makeCanvas, mix, PLANE } from '../plane';
import type { Variant, VariantId } from '../variants';

/**
 * GridPlane — the floor of the scene.
 *
 * Baked once into a plane-sized offscreen canvas and blitted under the plane
 * transform every frame. Hundreds of markers, none of which ever change.
 */
export const bakeGridPlane = (id: VariantId, v: Variant): HTMLCanvasElement => {
  const c = makeCanvas(PLANE.w, PLANE.h);
  const ctx = ctx2d(c);
  const p = v.palette;
  const pitch = CONFIG.gridPitch;
  const cols = Math.ceil(PLANE.w / pitch);
  const rows = Math.ceil(PLANE.h / pitch);

  ctx.lineCap = 'butt';

  for (let i = 0; i <= cols; i++) {
    const x = i * pitch;
    const accent = i % CONFIG.gridAccentEvery === 0;
    ctx.strokeStyle = alpha(p.gridLine, accent ? 1 : 0.6);
    ctx.lineWidth = CONFIG.gridLineWidth * (accent ? 1.35 : 1);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, PLANE.h);
    ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const y = j * pitch;
    const accent = j % CONFIG.gridAccentEvery === 0;
    // Horizontals read fainter than verticals — keeps the plane from turning
    // into graph paper and lets the recession read.
    ctx.strokeStyle = alpha(p.gridLine, accent ? 0.66 : 0.36);
    ctx.lineWidth = CONFIG.gridLineWidth * (accent ? 1.2 : 0.85);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(PLANE.w, y);
    ctx.stroke();
  }

  const s = CONFIG.gridMarkerSize;
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const r = random(`grid-${id}-${i}-${j}`);
      const bright = r < CONFIG.gridBrightMarkerChance;
      const hollow = r > 0.9;
      const x = i * pitch;
      const y = j * pitch;
      if (hollow) {
        ctx.strokeStyle = alpha(mix(p.gridLine, p.countryFill, 0.35), 0.55);
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - s * 0.75, y - s * 0.75, s * 1.5, s * 1.5);
      } else {
        ctx.fillStyle = bright
          ? alpha(mix(p.gridLine, p.countryFill, 0.5), 0.8)
          : alpha(p.gridLine, 0.7);
        const sz = bright ? s : s * 0.62;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
  }
  return c;
};

/** A dimmer, smaller echo of the grid that sits in the far depth bucket. */
export const drawGridPlane = (
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  opacity: number
) => {
  ctx.globalAlpha = opacity;
  ctx.drawImage(buffer, PLANE.x, PLANE.y);
  ctx.globalAlpha = 1;
};
