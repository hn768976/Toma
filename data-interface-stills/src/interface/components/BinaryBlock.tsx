import React from 'react';
import {useDrawOp} from '../ops';
import {clipTo, cornerTab, insetRect, panelFrame} from '../draw';
import {BINARY_CHARS, drawCharRows, type BlockProps} from './shared';

/**
 * Rows of 1s and 0s, tightly set, inside a thin frame with a corner tab.
 * Row lengths vary and per-character brightness varies, with a few short runs
 * highlighted as though flagged.
 */
export const BinaryBlock: React.FC<BlockProps> = ({
  rect,
  palette,
  rng,
  density,
  scale,
  bucket,
  z,
}) => {
  const corner = rng.pick(['tl', 'tr', 'bl', 'br'] as const);
  const fontSize = 20 * scale * density.contentScale;
  const runs = Math.round(rng.range(3, 9) * density.fill);
  const seedRng = rng.fork('rows');

  return useDrawOp({
    bucket,
    z,
    draw: (ctx) => {
      ctx.save();
      panelFrame(ctx, rect, palette, {lineWidth: 2.4, wash: 0.14});
      cornerTab(ctx, rect, palette, corner, Math.max(8, rect.h * 0.022));
      const inner = insetRect(rect, Math.max(14, fontSize * 0.85));
      clipTo(ctx, inner);
      drawCharRows(ctx, inner, palette, seedRng, {
        fontSize,
        charset: BINARY_CHARS,
        fullRowChance: 0.42,
        highlightRuns: runs,
      });
      ctx.restore();
    },
  });
};
