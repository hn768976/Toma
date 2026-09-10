import { extent, makeCandles } from "../lib/series";
import { rgba } from "../lib/color";
import type { CandlesSpec } from "../types";
import { asElement, yMapper, type ElementProps } from "./common";

const draw = ({
  ctx,
  width,
  height,
  palette,
  seriesRng,
  spec,
}: ElementProps<CandlesSpec>): void => {
  const candles = makeCandles(seriesRng, spec.count, {
    volatility: spec.volatility,
    hollowRate: spec.hollowRate,
  });
  const [lo, hi] = extent(candles.flatMap((c) => [c.low, c.high]));
  const y = yMapper(height, lo, hi, spec.fill);
  const slot = width / spec.count;
  const body = Math.min(spec.bodyWidth, slot * 0.82);
  const wick = spec.wickWidth;

  ctx.globalAlpha = spec.gain;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = slot * (i + 0.5);
    const colour = c.up ? palette.candleUp : palette.candleDown;
    const key = c.up ? "candleUp" : "candleDown";

    ctx.fillStyle = rgba(palette, key, 0.85);
    ctx.fillRect(x - wick / 2, y(c.high), wick, y(c.low) - y(c.high));

    const top = Math.min(y(c.open), y(c.close));
    const tall = Math.max(Math.abs(y(c.close) - y(c.open)), wick * 1.6);
    if (c.hollow) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(2, wick * 0.9);
      ctx.strokeRect(x - body / 2, top, body, tall);
    } else {
      ctx.fillStyle = colour;
      ctx.fillRect(x - body / 2, top, body, tall);
    }
  }
  ctx.globalAlpha = 1;
};

export const CandleSeries = asElement<CandlesSpec>("CandleSeries", draw);
