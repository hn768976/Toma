import {useLayoutEffect} from 'react';
import {CHART} from '../config';
import {segmentedLine} from '../draw';
import {type Scene, Z} from '../scene';
import {rgba} from '../theme';

const H_SPACING = 168;
const V_SPACING = CHART.pitch * 6; // 312 — divides the series width exactly
const DASH_PERIOD = 40; // divides the series width exactly

/**
 * Faint horizontal rules, fainter vertical rules that scroll with the chart,
 * and one prominent dashed horizontal price marker crossing the frame.
 */
export const GridLayer: React.FC<{scene: Scene; frame: number}> = ({scene}) => {
  useLayoutEffect(() => {
    scene.ops.push({
      z: Z.grid,
      run: () => {
        const {painter, theme, offsetX, seriesWidth, yOf, series} = scene;
        const halfW = CHART.width / 2;
        const halfH = CHART.height / 2;

        // ── horizontal rules ────────────────────────────────────────────
        for (let y = -halfH; y <= halfH; y += H_SPACING) {
          segmentedLine(painter, -halfW, y, halfW, y, 190, (ctx, alpha) => {
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = rgba(theme.gridLine, 0.95);
          });
        }

        // ── vertical rules, scrolling in lockstep with the candles ──────
        const first = Math.floor((-halfW - offsetX) / V_SPACING) - 1;
        const last = Math.ceil((halfW - offsetX) / V_SPACING) + 1;
        for (let j = first; j <= last; j++) {
          const x = j * V_SPACING + offsetX;
          if (x < -halfW - V_SPACING || x > halfW + V_SPACING) continue;
          segmentedLine(painter, x, -halfH, x, halfH, 190, (ctx, alpha) => {
            ctx.globalAlpha = alpha * 0.62;
            ctx.lineWidth = 2;
            ctx.strokeStyle = rgba(theme.gridLine, 0.9);
          });
        }

        // ── the dashed price marker ─────────────────────────────────────
        // Anchored to a real level in the series, and its dash phase scrolls
        // with the chart. DASH_PERIOD divides the series width, so the phase
        // returns to zero exactly at the loop point.
        const level = series.min + (series.max - series.min) * 0.45;
        const dashY = yOf(level);
        const phase =
          ((offsetX % DASH_PERIOD) + DASH_PERIOD) % DASH_PERIOD;
        for (let x = -halfW - DASH_PERIOD + phase; x < halfW; x += DASH_PERIOD) {
          const x0 = x;
          const x1 = x + DASH_PERIOD * 0.5;
          const focus = painter.focus((x0 + x1) / 2, dashY);
          painter.paint(focus, (ctx, alpha) => {
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 3.4;
            ctx.lineCap = 'butt';
            ctx.strokeStyle = rgba(theme.dashedLine, 0.9);
            ctx.beginPath();
            ctx.moveTo(x0, dashY);
            ctx.lineTo(x1, dashY);
            ctx.stroke();
          });
        }
      },
    });
  });

  return null;
};
