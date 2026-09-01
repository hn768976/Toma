/**
 * LineChartPanel — the animated content of the main chart: the semi-transparent
 * column bars behind the lines, and the three series extending rightward.
 *
 * All three series and the bars advance from the SAME `revealIndex`, which is
 * derived from the shared progress, so the sweep reads as one move.
 */

import { ALPHA } from "../../variants";
import { LAYOUT } from "../layout";
import { BAR_VALUES, SERIES, SERIES_POINTS } from "../data";
import { pointX, valueY } from "./ScreenChrome";
import { withAlpha, type Ctx2D, type DashboardLayer, type PaintEnv } from "./utils";

const BAR_WIDTH = (LAYOUT.plot.w / (SERIES_POINTS - 1)) * 0.36;

const drawBars = (ctx: Ctx2D, env: PaintEnv): void => {
  const baseline = valueY(0);
  ctx.fillStyle = withAlpha(env.palette.barMagenta, ALPHA.bar);
  BAR_VALUES.forEach((value, i) => {
    const growth = env.anim.barGrowth[i] * env.anim.valueLift;
    if (growth <= 0) return;
    const top = valueY(value * growth);
    ctx.fillRect(pointX(i) - BAR_WIDTH / 2, top, BAR_WIDTH, baseline - top);
  });
};

/**
 * Trace a series up to the (fractional) reveal head. The last segment is
 * interpolated so the line grows smoothly rather than snapping point to point.
 */
const traceSeries = (
  ctx: Ctx2D,
  values: number[],
  revealIndex: number,
  lift: number,
): { x: number; y: number } => {
  const whole = Math.floor(revealIndex);
  const fraction = revealIndex - whole;
  const at = (i: number) => valueY(values[i] * lift);

  ctx.beginPath();
  ctx.moveTo(pointX(0), at(0));
  for (let i = 1; i <= whole; i++) {
    ctx.lineTo(pointX(i), at(i));
  }

  let headX = pointX(whole);
  let headY = at(whole);
  if (fraction > 0 && whole + 1 < SERIES_POINTS) {
    headX = pointX(whole + fraction);
    headY = at(whole) + (at(whole + 1) - at(whole)) * fraction;
    ctx.lineTo(headX, headY);
  }
  return { x: headX, y: headY };
};

const strokeSeries = (ctx: Ctx2D, env: PaintEnv, glowPass: boolean): void => {
  const { palette, anim } = env;
  const colors: Record<string, string> = {
    a: palette.seriesMagenta,
    b: palette.seriesBlue,
    c: palette.seriesWhite,
  };

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  SERIES.forEach((series, index) => {
    ctx.strokeStyle = colors[series.key];
    // The glow pass draws the same geometry a little heavier; blurred and added
    // back, that is what produces the bloom on the series.
    ctx.lineWidth = glowPass ? series.weight * 1.5 : series.weight;

    // Ahead of the sweep the series rests flat on the axis, each one nudged a
    // little clear of the next so all three read at the zeroed opening.
    const restY = valueY(0) - index * 11;
    const restFrom = pointX(anim.revealIndex);
    const restTo = LAYOUT.plot.x + LAYOUT.plot.w;
    if (restTo - restFrom > 1) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(restFrom, restY);
      ctx.lineTo(restTo, restY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const head = traceSeries(ctx, series.values, anim.revealIndex, anim.valueLift);
    ctx.stroke();

    // A dot rides the leading edge of each series.
    ctx.fillStyle = colors[series.key];
    ctx.beginPath();
    ctx.arc(head.x, head.y, series.weight * (glowPass ? 1.5 : 1.05), 0, Math.PI * 2);
    ctx.fill();
  });
};

export const LineChartPanel: DashboardLayer = {
  name: "LineChartPanel",
  paint: (env) => {
    const { ctx, glow } = env;

    ctx.save();
    ctx.beginPath();
    ctx.rect(LAYOUT.plot.x - 4, LAYOUT.plot.y - 60, LAYOUT.plot.w + 60, LAYOUT.plot.h + 64);
    ctx.clip();
    drawBars(ctx, env);
    strokeSeries(ctx, env, false);
    ctx.restore();

    glow.save();
    glow.beginPath();
    glow.rect(LAYOUT.plot.x - 4, LAYOUT.plot.y - 60, LAYOUT.plot.w + 60, LAYOUT.plot.h + 64);
    glow.clip();
    strokeSeries(glow, env, true);
    glow.restore();
  },
};
