import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {VARIANTS, type VariantId} from './config';
import {drawAurora, type CurtainTargets} from './curtains';
import {
  drawCornerFalloff,
  drawDither,
  drawGrain,
  drawTwinklers,
  getHorizonGlow,
  getRidge,
  getSkyPlate,
} from './layers';

/**
 * Scratch canvases are reused across frames instead of being reallocated.
 * They are fully cleared before every frame, so no state survives between
 * frames — Remotion is free to render them out of order on any thread.
 */
const scratch = new Map<string, HTMLCanvasElement>();

const getScratch = (key: string, w: number, h: number) => {
  const k = `${key}-${w}x${h}`;
  let c = scratch.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    scratch.set(k, c);
  }
  return c;
};

const ctxOf = (c: HTMLCanvasElement) => {
  const ctx = c.getContext('2d', {alpha: true});
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
};

export const AuroraScene: React.FC<{variant: VariantId}> = ({variant}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = ctxOf(canvas);
    const v = VARIANTS[variant];
    const w = width;
    const h = height;
    // Normalised loop time. Every noise lookup and every travelling phase is
    // periodic in t, so frame 0 and frame `durationInFrames` are identical.
    const t = frame / durationInFrames;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    // 1-3. Sky gradient, Milky Way and starfield (static plate) + twinkle.
    ctx.drawImage(getSkyPlate(v, w, h), 0, 0);
    drawTwinklers(ctx, v, w, h, t);

    // 4. Aurora, rendered to its own buffer so bloom can be applied to the
    //    curtains alone without lifting the stars behind them.
    const bloomScale = 0.25;
    const bw = Math.max(2, Math.round(w * bloomScale));
    const bh = Math.max(2, Math.round(h * bloomScale));
    const auroraCanvas = getScratch('aurora', w, h);
    const bloomCanvas = getScratch('bloom', bw, bh);
    const actx = ctxOf(auroraCanvas);
    const bctx = ctxOf(bloomCanvas);
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.globalAlpha = 1;
    actx.globalCompositeOperation = 'source-over';
    actx.clearRect(0, 0, w, h);
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'lighter';
    bctx.clearRect(0, 0, bw, bh);

    const targets: CurtainTargets = {
      aurora: actx,
      bloom: bctx,
      bloomScale,
    };
    drawAurora(targets, v, w, h, t);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(auroraCanvas, 0, 0);
    // Bloom on the bright lower lips only — aurora light is diffuse, and a
    // heavy overall bloom would erase the striations.
    ctx.globalAlpha = 0.5;
    ctx.filter = `blur(${(w * 0.0075 * bloomScale).toFixed(2)}px)`;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bloomCanvas, 0, 0, w, h);
    ctx.restore();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    if (v.landscape) {
      // 5. Horizon glow, additive, in front of the aurora.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(getHorizonGlow(v, w, h), 0, 0);
      ctx.restore();

      // 6. Ridgeline cutout.
      ctx.drawImage(getRidge(v, w, h), 0, 0);
    }

    drawCornerFalloff(ctx, w, h);
    drawDither(ctx, w, h, frame);
    drawGrain(ctx, w, h, frame);
  }, [frame, width, height, durationInFrames, variant]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{width, height, display: 'block'}}
    />
  );
};
