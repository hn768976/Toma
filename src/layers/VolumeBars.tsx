import {useLayoutEffect} from 'react';
import {CHART} from '../config';
import {focusRect} from '../draw';
import {type Scene, Z} from '../scene';
import {rgba} from '../theme';
import {placeCandles} from '../tiling';

/**
 * Thin vertical bars along the bottom third, in matching green and red,
 * height proportional to the candle's seeded volume, scrolling in lockstep
 * with the candles above them.
 */
export const VolumeBars: React.FC<{scene: Scene; frame: number}> = ({scene}) => {
  useLayoutEffect(() => {
    scene.ops.push({
      z: Z.volume,
      run: () => {
        const {painter, theme} = scene;
        const halfBar = CHART.volumeBarWidth / 2;

        for (const {candle, x} of placeCandles(scene)) {
          const h = candle.volume * CHART.volumeMaxHeight;
          if (h < 1) continue;
          const colour = candle.rising ? theme.candleGreen : theme.candleRed;
          focusRect(
            painter,
            x - halfBar,
            CHART.volumeBaseline - h,
            CHART.volumeBarWidth,
            h,
            (ctx, alpha) => {
              ctx.globalAlpha = alpha * 0.56;
              ctx.fillStyle = rgba(colour, 1);
            }
          );
        }
      },
    });
  });

  return null;
};
