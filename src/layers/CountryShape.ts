import { CONFIG, HEIGHT, WIDTH } from '../config';
import { alpha, ctx2d, makeCanvas } from '../plane';
import type { Variant } from '../variants';

export type CountryBuffer = {
  canvas: HTMLCanvasElement;
  /** Top-left of the buffer in frame coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * CountryShape — the silhouette, baked once.
 *
 * Fill, soft edge and several hundred diagonal hatch strokes all go into one
 * offscreen canvas at final pixel size. The hatching is what stops the shape
 * reading as a flat blob, and it is far too expensive to redraw at 4K each
 * frame.
 */
export const bakeCountryShape = (v: Variant): CountryBuffer => {
  const p = v.palette;
  const [minX, minY, maxX, maxY] = v.shape.bounds;
  const srcW = maxX - minX;
  const srcH = maxY - minY;
  const targetH = v.shape.heightFraction * HEIGHT;
  const k = targetH / srcH;
  const targetW = srcW * k;

  const pad = CONFIG.countryEdgeSoftness * 6 + 40;
  const c = makeCanvas(targetW + pad * 2, targetH + pad * 2);
  const ctx = ctx2d(c);

  const path = new Path2D(v.shape.d);
  const place = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(pad, pad);
    ctx.scale(k, k);
    ctx.translate(-minX, -minY);
  };

  // A soft drop shadow lifts the shape off the grid without an outline.
  place();
  ctx.translate(14 / k, 20 / k);
  ctx.filter = `blur(${CONFIG.countryEdgeSoftness * 2.5}px)`;
  ctx.fillStyle = alpha(p.backgroundDeep, 0.55);
  ctx.fill(path, 'nonzero');
  ctx.filter = 'none';

  // Fill with a feathered edge — no hard stroke anywhere.
  place();
  ctx.filter = `blur(${CONFIG.countryEdgeSoftness}px)`;
  ctx.fillStyle = alpha(p.countryFill, CONFIG.countryAlpha);
  ctx.fill(path, 'nonzero');
  ctx.filter = 'none';

  // Fine diagonal hatching, clipped to the silhouette.
  ctx.save();
  place();
  ctx.clip(path, 'nonzero');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const a = (CONFIG.hatchAngleDeg * Math.PI) / 180;
  const span = c.width + c.height;
  ctx.strokeStyle = alpha(p.countryHatch, 0.42);
  ctx.lineWidth = CONFIG.hatchWidth;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(a);
  ctx.beginPath();
  for (let o = -span; o <= span; o += CONFIG.hatchSpacing) {
    ctx.moveTo(-span, o);
    ctx.lineTo(span, o);
  }
  ctx.stroke();
  ctx.restore();

  // A whisper of extra fill on top re-seats the hatching into the body.
  place();
  ctx.filter = `blur(${CONFIG.countryEdgeSoftness * 1.6}px)`;
  ctx.fillStyle = alpha(p.countryFill, 0.16);
  ctx.fill(path, 'nonzero');
  ctx.filter = 'none';

  return {
    canvas: c,
    x: v.shape.center[0] * WIDTH - targetW / 2 - pad,
    y: v.shape.center[1] * HEIGHT - targetH / 2 - pad,
    w: c.width,
    h: c.height,
  };
};

export const drawCountryShape = (
  ctx: CanvasRenderingContext2D,
  buf: CountryBuffer
) => {
  ctx.drawImage(buf.canvas, buf.x, buf.y);
};
