import {useLayoutEffect} from 'react';
import {BLOCK_HEIGHT, HEIGHT, WIDTH} from '../lib/constants';
import {ctx2d, isolateChannel} from '../lib/draw';
import {activeTear, buildSlices} from '../lib/glitch';
import type {Stage} from '../stage';

/**
 * Copy one full-width band out of a source canvas and lay it back down shifted
 * sideways, wrapping what falls off the edge round to the other side. Working
 * from a copy of the composited frame is what keeps this cheap: no content is
 * ever re-rendered per slice.
 */
const blitBand = (
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcY: number,
  dstY: number,
  h: number,
  dx: number,
): void => {
  ctx.drawImage(src, 0, srcY, WIDTH, h, dx, dstY, WIDTH, h);
  if (dx > 0) ctx.drawImage(src, WIDTH - dx, srcY, dx, h, 0, dstY, dx, h);
  else if (dx < 0) ctx.drawImage(src, 0, srcY, -dx, h, WIDTH + dx, dstY, -dx, h);
};

/**
 * Layer 4 — the defining effect. Horizontal bands of the composited frame are
 * displaced sideways; some fringe in colour because their channels are pulled
 * apart; some are dropped to a flat block; some are replaced by a duplicate of
 * the text layer pulled from a different vertical offset.
 */
export const TearPass: React.FC<{stage: Stage}> = ({stage}) => {
  useLayoutEffect(() => {
    const canvas = stage.canvasRef.current;
    if (!canvas || !stage.ready) return;
    const ev = activeTear(stage.tears, stage.frame);
    if (!ev) return;

    const ctx = ctx2d(canvas);
    const {palette} = stage.cfg;
    const slices = buildSlices(stage.cfg, ev, stage.frame, stage.instability);

    // One snapshot of the composited frame; every slice reads from it.
    const src = stage.frameScratch;
    const srcCtx = ctx2d(src);
    srcCtx.setTransform(1, 0, 0, 1, 0, 0);
    srcCtx.globalAlpha = 1;
    srcCtx.globalCompositeOperation = 'source-over';
    srcCtx.clearRect(0, 0, WIDTH, HEIGHT);
    srcCtx.drawImage(canvas, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = false;

    for (const s of slices) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (s.kind === 'drop') {
        // Dropped data: a flat block of near-black, or of the wash at full
        // brightness with nothing behind it.
        ctx.fillStyle = s.dark ? palette.bannerBlack : palette.washMain;
        ctx.fillRect(0, s.y, WIDTH, s.h);
        continue;
      }

      if (s.kind === 'echo') {
        // The same content appearing twice at different positions.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, s.y, WIDTH, s.h);
        ctx.clip();
        const ey = -stage.scrollY + s.echoFrom;
        ctx.fillStyle = palette.textBg;
        ctx.fillRect(0, s.y, WIDTH, s.h);
        for (const t of [-BLOCK_HEIGHT, 0, BLOCK_HEIGHT]) {
          ctx.drawImage(stage.text.canvas, s.dx * 0.25, ey + t);
        }
        ctx.globalAlpha = stage.washAlpha;
        ctx.fillStyle = palette.washMain;
        ctx.fillRect(0, s.y, WIDTH, s.h);
        ctx.globalAlpha = stage.striation;
        ctx.drawImage(stage.washTexture, 0, -(stage.f / 300) * HEIGHT);
        ctx.restore();
        continue;
      }

      if (s.kind === 'channel') {
        // Red one way, blue the other, recombined additively so the band fringes.
        const band = stage.bandScratch;
        ctx.fillStyle = palette.bannerBlack;
        ctx.fillRect(0, s.y, WIDTH, s.h);
        ctx.globalCompositeOperation = 'lighter';
        const offsets: [('r' | 'g' | 'b'), number][] = [
          ['r', s.dx + s.fringe],
          ['g', s.dx],
          ['b', s.dx - s.fringe],
        ];
        for (const [mask, shift] of offsets) {
          isolateChannel(band, src, 0, s.y, WIDTH, s.h, mask);
          blitBand(ctx, band, 0, s.y, s.h, Math.round(shift));
        }
        continue;
      }

      blitBand(ctx, src, s.y, s.y, s.h, s.dx);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  });

  return null;
};
