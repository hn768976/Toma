import {useLayoutEffect} from 'react';
import {BLOCK_HEIGHT, COLUMNS, COL_CHARS, FONT_SIZE, HEIGHT, LINE_HEIGHT, ROWS, WIDTH} from '../lib/constants';
import {ctx2d, mixHex} from '../lib/draw';
import {corruptionAt} from '../lib/glitch';
import {garbleLine} from '../lib/terminal-text';
import {monoFont} from '../fonts';
import type {Stage} from '../stage';

/**
 * Layer 1 — substrate. A pre-laid-out block of dense monospace, blitted twice so
 * it tiles vertically, translated by (frame / 300) * blockHeight so the scroll
 * covers exactly one block and the loop closes. Corrupted runs are the only
 * thing painted per frame, and only over the handful of rows they touch.
 */
export const TextLayer: React.FC<{stage: Stage}> = ({stage}) => {
  useLayoutEffect(() => {
    const canvas = stage.canvasRef.current;
    if (!canvas || !stage.ready) return;
    const ctx = ctx2d(canvas);
    const {palette} = stage.cfg;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = palette.textBg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const top = -stage.scrollY;
    ctx.drawImage(stage.text.canvas, 0, top);
    ctx.drawImage(stage.text.canvas, 0, top + BLOCK_HEIGHT);

    const events = corruptionAt(stage.cfg, stage.corruptions, stage.frame);
    if (events.length === 0) return;

    // Garbled runs churn on a three-frame beat rather than every frame, which
    // reads as corruption rather than as static.
    const churn = Math.floor(stage.f / 3);
    const colWidth = COL_CHARS * stage.text.charWidth;
    ctx.textBaseline = 'alphabetic';

    for (const ev of events) {
      for (let j = 0; j < ev.lines; j++) {
        const row = (ev.row + j) % ROWS;
        const blockY = row * LINE_HEIGHT;
        for (const tile of [0, BLOCK_HEIGHT]) {
          const y = blockY + top + tile;
          if (y < -LINE_HEIGHT || y > HEIGHT) continue;
          ctx.fillStyle = palette.textBg;
          ctx.fillRect(0, y, WIDTH, LINE_HEIGHT);
          for (let c = 0; c < COLUMNS; c++) {
            const seed = `${stage.cfg.name}-g-${ev.id}-${row}-${c}-${churn}`;
            ctx.font = monoFont(FONT_SIZE, 400);
            ctx.fillStyle = mixHex(palette.textDark, palette.textLight, 0.55 + (j % 3) * 0.15);
            ctx.fillText(
              garbleLine(COL_CHARS, seed),
              stage.text.colX[c],
              y + FONT_SIZE,
              colWidth,
            );
          }
        }
      }
    }
  });

  return null;
};
