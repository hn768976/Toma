import React from 'react';
import {useDrawOp} from '../ops';
import {alpha} from '../palettes';
import {clipTo, insetRect, monoFont, panelFrame} from '../draw';
import {CODE_CHARS, type BlockProps} from './shared';

/** A grid of short illegible values with a brighter header and banded rows. */
export const TablePanel: React.FC<BlockProps> = ({
  rect,
  palette,
  rng,
  density,
  scale,
  bucket,
  z,
}) => {
  const cols = rng.int(3, 5);
  const fontSize = 17 * scale * density.contentScale;
  const rowH = fontSize * 1.75;
  const inner = insetRect(rect, Math.max(10, fontSize * 0.75));
  const rows = Math.max(2, Math.floor(inner.h / rowH) - 1);
  const cells: string[][] = [];
  for (let r = 0; r < rows + 1; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(r === 0 ? rng.code(rng.int(2, 4)) : rng.code(rng.int(3, 6), CODE_CHARS));
    }
    cells.push(row);
  }
  const banded = new Set<number>();
  const bandCount = Math.round(rows * 0.22 * density.fill);
  for (let i = 0; i < bandCount; i++) banded.add(rng.int(1, rows));

  return useDrawOp({
    bucket,
    z,
    draw: (ctx) => {
      ctx.save();
      panelFrame(ctx, rect, palette, {lineWidth: 2, wash: 0.2});
      clipTo(ctx, insetRect(rect, 3));
      ctx.font = monoFont(fontSize);
      ctx.textBaseline = 'top';
      const colW = inner.w / cols;

      for (let r = 0; r <= rows; r++) {
        const y = inner.y + r * rowH;
        if (r === 0) {
          ctx.fillStyle = alpha(palette.border, 0.3);
          ctx.fillRect(inner.x, y, inner.w, rowH * 0.94);
        } else if (banded.has(r)) {
          ctx.fillStyle = alpha(palette.tones[0], 0.5);
          ctx.fillRect(inner.x, y, inner.w, rowH * 0.94);
        }
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = alpha(
            r === 0 ? palette.tones[2] : banded.has(r) ? palette.tones[2] : palette.tones[1],
            r === 0 ? 0.95 : banded.has(r) ? 0.9 : 0.78,
          );
          ctx.fillText(cells[r][c], inner.x + c * colW + fontSize * 0.35, y + rowH * 0.24);
        }
      }

      ctx.strokeStyle = alpha(palette.grid, 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let c = 1; c < cols; c++) {
        ctx.moveTo(inner.x + c * colW, inner.y);
        ctx.lineTo(inner.x + c * colW, inner.y + (rows + 1) * rowH);
      }
      ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    },
  });
};
