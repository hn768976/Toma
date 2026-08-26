import {useLayoutEffect} from 'react';
import {CHART} from '../config';
import {focusRect} from '../draw';
import {type Scene, Z} from '../scene';
import {rgba} from '../theme';
import {placeCandles} from '../tiling';

const MIN_BODY_PX = 3.5;

/**
 * The candles: thin bodies, prominent wicks, mostly solid with a minority
 * hollow. The rightmost candle is still forming, so its body grows, shrinks
 * and can flip colour until the scroll locks it.
 */
export const CandleSeries: React.FC<{scene: Scene; frame: number}> = ({scene}) => {
  useLayoutEffect(() => {
    scene.ops.push({
      z: Z.candles,
      run: () => {
        const {painter, theme, yOf, series} = scene;
        const halfBody = CHART.bodyWidth / 2;
        const halfWick = CHART.wickWidth / 2;
        // pixel height of an average candle body, for the bloom threshold
        const unitPx =
          Math.abs(yOf(0) - yOf(series.unit)) * scene.cfg.bodySize;

        for (const {candle, x, t} of placeCandles(scene)) {
          const colour = candle.rising ? theme.candleGreen : theme.candleRed;

          // ── wick ────────────────────────────────────────────────────
          const yHigh = yOf(candle.high);
          const yLow = yOf(candle.low);
          focusRect(
            painter,
            x - halfWick,
            yHigh,
            CHART.wickWidth,
            Math.max(1.5, yLow - yHigh),
            (ctx, alpha) => {
              ctx.globalAlpha = alpha * 0.88;
              ctx.fillStyle = rgba(colour, 1);
            }
          );

          // ── body ────────────────────────────────────────────────────
          const yA = yOf(Math.max(candle.open, candle.close));
          const yB = yOf(Math.min(candle.open, candle.close));
          const h = Math.max(MIN_BODY_PX, yB - yA);
          // the biggest bodies are the brightest things in the chart
          const glow = Math.min(1, Math.max(0, h / Math.max(1, unitPx) - 0.9)) * 0.42;

          if (candle.hollow && t >= 1) {
            const focus = painter.focus(x, yA + h / 2);
            painter.paint(
              focus,
              (ctx, alpha) => {
                ctx.globalAlpha = alpha * 0.92;
                ctx.lineWidth = 3;
                ctx.strokeStyle = rgba(colour, 1);
                ctx.strokeRect(x - halfBody + 1.5, yA + 1.5, CHART.bodyWidth - 3, h - 3);
              },
              glow * 0.5
            );
          } else {
            focusRect(
              painter,
              x - halfBody,
              yA,
              CHART.bodyWidth,
              h,
              (ctx, alpha) => {
                ctx.globalAlpha = alpha * 0.96;
                ctx.fillStyle = rgba(colour, 1);
              },
              glow
            );
          }
        }
      },
    });
  });

  return null;
};
