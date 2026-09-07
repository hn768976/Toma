import React from 'react';
import {useDrawOp} from '../ops';
import {clipTo, insetRect, labelTab, panelFrame} from '../draw';
import {BINARY_CHARS, CODE_CHARS, drawCharRows, type BlockProps} from './shared';

/**
 * A bordered rectangle with a filled label tab at its upper-left carrying a
 * short illegible code, filled with dense binary or numeric content.
 */
export const LabelledPanel: React.FC<BlockProps> = ({
  rect,
  palette,
  rng,
  density,
  scale,
  bucket,
  z,
}) => {
  const label = `${rng.code(2)}-${rng.code(3, '0123456789')}`;
  const numeric = rng.bool(0.45);
  const fontSize = (numeric ? 18 : 16) * scale * density.contentScale;
  const tabH = Math.min(38, Math.max(16, rect.h * 0.085));
  const seedRng = rng.fork('body');

  return useDrawOp({
    bucket,
    z,
    draw: (ctx) => {
      ctx.save();
      panelFrame(ctx, rect, palette, {lineWidth: 2, wash: 0.18});
      labelTab(ctx, rect, palette, label, {corner: 'tl', height: tabH});
      const inner = {
        x: rect.x + fontSize * 0.7,
        y: rect.y + tabH + fontSize * 0.5,
        w: Math.max(1, rect.w - fontSize * 1.4),
        h: Math.max(1, rect.h - tabH - fontSize * 1.2),
      };
      clipTo(ctx, insetRect(inner, 0));
      drawCharRows(ctx, inner, palette, seedRng, {
        fontSize,
        charset: numeric ? CODE_CHARS : BINARY_CHARS,
        fullRowChance: 0.55,
        highlightRuns: Math.round(rng.range(1, 4) * density.fill),
        tracking: numeric ? 1.1 : 1.02,
      });
      ctx.restore();
    },
  });
};
