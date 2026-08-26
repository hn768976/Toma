import {useLayoutEffect} from 'react';
import {CHART} from '../config';
import {segmentedLine} from '../draw';
import {type Scene, Z} from '../scene';
import {rgba} from '../theme';

/**
 * A thin straight diagonal crossing the chart, low contrast.
 *
 * It is static in chart space on purpose: translating an infinite straight
 * line along its own direction leaves it unchanged, so a trend line that
 * "scrolls with" the chart is the same line every frame. That is the only
 * form of trend line that can tile, and it is what keeps frame 0 and frame
 * 744 identical.
 *
 * bear: sits above the price for most of the series.
 * bull: sits below it.
 */
export const TrendLine: React.FC<{scene: Scene; frame: number}> = ({scene}) => {
  useLayoutEffect(() => {
    scene.ops.push({
      z: Z.trend,
      run: () => {
        const {painter, theme, cfg} = scene;
        const halfW = CHART.width / 2;
        const {leftY, rightY} = cfg.trendLine;

        segmentedLine(
          painter,
          -halfW,
          leftY,
          halfW,
          rightY,
          170,
          (ctx, alpha) => {
            ctx.globalAlpha = alpha * 0.72;
            ctx.lineWidth = 3;
            ctx.strokeStyle = rgba(theme.textDim, 0.55);
          }
        );
      },
    });
  });

  return null;
};
