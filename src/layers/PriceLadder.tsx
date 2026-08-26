import {useLayoutEffect} from 'react';
import {random} from 'remotion';
import {CHART, DURATION, FPS} from '../config';
import {focusRect} from '../draw';
import {type Scene, Z} from '../scene';
import {rgba} from '../theme';

/** frames a flash holds at full brightness, then eases back */
const HOLD = 3;
const RELEASE = 11;

type Flash = {frame: number; cell: number};

const flashCache = new Map<string, Flash[]>();

/**
 * The flash schedule for a whole loop, generated once and reused.
 *
 * Times are drawn uniformly over the 744 frames, so the instantaneous rate
 * wanders around the configured mean — 3/s lands in the requested 2–4 band for
 * the bear, 2/s in the calmer 1–3 band for the bull.
 */
const flashesFor = (seed: string, rate: number): Flash[] => {
  const key = `${seed}:${rate}`;
  const cached = flashCache.get(key);
  if (cached) return cached;

  const count = Math.round((rate * DURATION) / FPS);
  const out: Flash[] = [];
  for (let n = 0; n < count; n++) {
    out.push({
      frame: Math.floor(random(`${seed}-flash-t-${n}`) * DURATION),
      cell: Math.floor(random(`${seed}-flash-c-${n}`) * CHART.ladderCells),
    });
  }
  flashCache.set(key, out);
  return out;
};

const profile = (d: number): number => {
  if (d < 0) return 0;
  if (d < HOLD) return 1;
  if (d < HOLD + RELEASE) {
    const u = 1 - (d - HOLD) / RELEASE;
    return u * u; // ease back
  }
  return 0;
};

/**
 * A vertical column of small bright cells along the right edge — an order
 * book. It sits deep in the defocused zone, so it reads as a chain of soft
 * bright blocks rather than as readable rows.
 */
export const PriceLadder: React.FC<{scene: Scene; frame: number}> = ({scene}) => {
  useLayoutEffect(() => {
    scene.ops.push({
      z: Z.ladder,
      run: () => {
        const {painter, theme, cfg, frame} = scene;
        const flashes = flashesFor(cfg.seed, cfg.ladderFlashRate);

        // accumulate this frame's brightness boost per cell
        const boost = new Float64Array(CHART.ladderCells);
        const f = ((frame % DURATION) + DURATION) % DURATION;
        for (const fl of flashes) {
          const d = ((f - fl.frame) % DURATION + DURATION) % DURATION;
          const p = profile(d);
          if (p > boost[fl.cell]) boost[fl.cell] = p;
        }

        const span = CHART.ladderBottom - CHART.ladderTop;
        const step = span / (CHART.ladderCells - 1);

        // A faint panel wash under the column, in the same chart plane. Without
        // it the cells read as a bright strip laid over the picture rather than
        // as a UI panel sitting on the same screen as the chart.
        const padX = 26;
        const panelX = CHART.ladderX - padX;
        const panelW = CHART.ladderCellWidth + padX * 2;
        const panelTop = CHART.ladderTop - step;
        const panelH = span + step * 2;
        const bands = 9;
        for (let b = 0; b < bands; b++) {
          const y = panelTop + (panelH * b) / bands;
          const h = panelH / bands;
          const focus = painter.focus(panelX + panelW / 2, y + h / 2);
          painter.paint(focus, (ctx, alpha) => {
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = rgba(theme.backgroundMid, 0.5);
            ctx.fillRect(panelX, y, panelW, h + 1);
          });
        }
        // and its left rule, so the panel has an edge on the screen
        for (let b = 0; b < bands; b++) {
          const y = panelTop + (panelH * b) / bands;
          const h = panelH / bands;
          const focus = painter.focus(panelX, y + h / 2);
          painter.paint(focus, (ctx, alpha) => {
            ctx.globalAlpha = alpha * 0.85;
            ctx.fillStyle = rgba(theme.gridLine, 1);
            ctx.fillRect(panelX - 1.5, y, 3, h + 1);
          });
        }

        for (let i = 0; i < CHART.ladderCells; i++) {
          const r = random(`${cfg.seed}-ladder-${i}`);
          const colour =
            r < 0.14
              ? theme.candleGreen
              : r < 0.27
                ? theme.candleRed
                : theme.ladderWhite;

          // irregular sizes and offsets — an evenly repeated cell reads as a
          // synthetic strip rather than as depth at a price level
          const wJitter = 0.42 + 0.58 * random(`${cfg.seed}-ladder-w-${i}`);
          const w = CHART.ladderCellWidth * wJitter;
          const hJitter = 0.6 + 0.85 * random(`${cfg.seed}-ladder-h-${i}`);
          const h = CHART.ladderCellHeight * hJitter;
          const xJitter = random(`${cfg.seed}-ladder-x-${i}`) * 16;
          const y = CHART.ladderTop + i * step - h / 2;
          const base = 0.29 + 0.26 * random(`${cfg.seed}-ladder-b-${i}`);
          // a flash goes to ~200% brightness, then eases back
          const gain = 1 + boost[i];

          focusRect(
            painter,
            CHART.ladderX + xJitter,
            y,
            w,
            h,
            (ctx, alpha) => {
              ctx.globalAlpha = Math.min(1, alpha * base * gain);
              // brightness is boosted *before* the buffer is blurred, which is
              // what makes a flashing cell bloom into a soft disc
              ctx.fillStyle = rgba(colour, 1, gain);
            },
            0.24 + 0.8 * boost[i]
          );
        }
      },
    });
  });

  return null;
};
