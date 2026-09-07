import React, {useLayoutEffect, useRef} from 'react';
import {OpsProvider, type DrawOp} from '../ops';
import type {Palette} from '../palettes';
import {applyPlaneTransform, BUCKET_BLUR, BUCKET_LIFT, BUFFER_PAD} from '../plane';
import {mulberry32, Rng} from '../rng';
import type {Tilt} from '../types';

const bufferCanvas = (w: number, h: number): CanvasRenderingContext2D => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d') as CanvasRenderingContext2D;
};

/**
 * Depth of field and finish.
 *
 * Children contribute draw operations tagged with a depth bucket. Each bucket
 * is rendered into ONE offscreen buffer and blurred ONCE on composite — three
 * blurs for the whole image rather than one per panel, which at 4K is the
 * difference between seconds and minutes.
 */
export const FocusPass: React.FC<{
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  palette: Palette;
  tilt: Tilt;
  seed: string;
  onComplete: () => void;
  children: React.ReactNode;
}> = ({canvasRef, width, height, palette, tilt, seed, onComplete, children}) => {
  // A fresh array every render, captured before children run, so a repeated
  // render replaces the op list instead of appending to it.
  const ops: DrawOp[] = [];
  const opsRef = useRef<DrawOp[]>(ops);
  opsRef.current = ops;

  const doneRef = useRef(false);

  useLayoutEffect(() => {
    if (doneRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    doneRef.current = true;
    const ctx = canvas.getContext('2d', {alpha: false}) as CanvasRenderingContext2D;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);

    const pad = BUFFER_PAD;
    const bw = width + pad * 2;
    const bh = height + pad * 2;

    const sorted = opsRef.current
      .map((op, i) => ({op, i}))
      .sort((a, b) => a.op.bucket - b.op.bucket || a.op.z - b.op.z || a.i - b.i);

    for (let bucket = 2; bucket >= 0; bucket--) {
      const bctx = bufferCanvas(bw, bh);
      applyPlaneTransform(bctx, tilt, width, height, pad);
      let drew = false;
      for (const {op} of sorted) {
        if (op.bucket !== bucket) continue;
        drew = true;
        bctx.save();
        op.draw(bctx);
        bctx.restore();
      }
      if (!drew) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const blur = BUCKET_BLUR[bucket];
      // Blur spreads a thin line's energy, so far buckets are lifted back to
      // the same brightness range as the near one. Depth drives blur, not tone.
      const lift = BUCKET_LIFT[bucket];
      ctx.filter = blur > 0 ? `blur(${blur}px) brightness(${lift})` : 'none';
      ctx.drawImage(bctx.canvas, -pad, -pad);
      ctx.filter = 'none';
    }

    // --- Moderate bloom on the brightest content and panel borders ---
    const hw = Math.round(width / 2);
    const hh = Math.round(height / 2);
    const bright = bufferCanvas(hw, hh);
    bright.filter = 'brightness(1.02) contrast(3.1)';
    bright.drawImage(canvas, 0, 0, hw, hh);
    bright.filter = 'none';

    for (const [radius, a] of [
      [5, 0.36],
      [21, 0.22],
    ] as const) {
      const b = bufferCanvas(hw, hh);
      b.filter = `blur(${radius}px)`;
      b.drawImage(bright.canvas, 0, 0);
      b.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.drawImage(b.canvas, 0, 0, width, height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // --- Vignette ~22% ---
    const vg = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.hypot(width, height) / 2,
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(0.5, 'rgba(0, 0, 0, 0.015)');
    vg.addColorStop(0.78, 'rgba(0, 0, 0, 0.09)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);

    // --- Scanlines every 5px at ~2% ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.022)';
    for (let y = 0; y < height; y += 5) ctx.fillRect(0, y, width, 1);

    // --- Fine grain, seeded from the seed prop ---
    const grainCtx = bufferCanvas(width, height);
    const img = grainCtx.createImageData(width, height);
    const px = img.data;
    const noise = mulberry32(Math.floor(new Rng(`${seed}|grain`).next() * 2 ** 31));
    for (let i = 0; i < px.length; i += 4) {
      const v = (noise() * 255) | 0;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
    grainCtx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.03;
    ctx.drawImage(grainCtx.canvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    onComplete();
    // Draw exactly once: this is a still, there is nothing to animate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <OpsProvider ops={ops}>{children}</OpsProvider>;
};
