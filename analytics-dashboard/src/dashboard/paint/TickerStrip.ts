/**
 * TickerStrip — the horizontal strip across the top. Invented instruments with
 * fictional values, scrolling leftward at a constant rate for the whole 300
 * frames.
 *
 * This is the one element that does NOT read the shared progress: it runs
 * straight off the frame number, so it keeps moving through the zeroed head and
 * the held tail and stops the frame from ever looking frozen.
 */

import { LAYOUT, DESIGN_WIDTH } from "../layout";
import { TICKER_ITEMS, type TickerItem } from "../data";
import {
  drawTabular,
  drawText,
  fontString,
  measureTabular,
  withAlpha,
  type Ctx2D,
  type DashboardLayer,
  type PaintEnv,
} from "./utils";

const GAP = 120;
const NAME_SIZE = 42;
const VALUE_SIZE = 42;

type Placed = { item: TickerItem; x: number; width: number };
type TickerLayout = { placed: Placed[]; total: number };

const layoutCache = new Map<string, TickerLayout>();

const partWidths = (ctx: Ctx2D, item: TickerItem, family: string) => {
  ctx.save();
  ctx.font = fontString({ size: NAME_SIZE, weight: 700, family });
  const name = ctx.measureText(item.name).width;
  ctx.font = fontString({ size: VALUE_SIZE, weight: 500, family });
  const unit = ctx.measureText(` ${item.unit}`).width;
  ctx.restore();
  const base = { size: VALUE_SIZE, weight: 600, color: "", family };
  const value = measureTabular(ctx, item.value, base);
  const changeText = `${item.change >= 0 ? "+" : "-"}${Math.abs(item.change).toFixed(2)}%`;
  const change = measureTabular(ctx, changeText, base);
  return { name, value, unit, change, changeText };
};

const getLayout = (ctx: Ctx2D, family: string): TickerLayout => {
  const cached = layoutCache.get(family);
  if (cached) return cached;

  const placed: Placed[] = [];
  let cursor = 0;
  for (const item of TICKER_ITEMS) {
    const w = partWidths(ctx, item, family);
    const width = w.name + 22 + w.value + w.unit + 26 + w.change;
    placed.push({ item, x: cursor, width });
    cursor += width + GAP;
  }
  // The list must be at least a screen wider than the frame so the wrap never
  // shows a gap at 4K.
  const total = Math.max(cursor, DESIGN_WIDTH + GAP);
  const layout = { placed, total };
  layoutCache.set(family, layout);
  return layout;
};

/** Re-measure once the real font is in — the fallback face has other metrics. */
export const clearTickerLayoutCache = (): void => {
  layoutCache.clear();
};

const drawItem = (env: PaintEnv, placed: Placed, x: number, y: number): void => {
  const { ctx, palette, fontFamily } = env;
  const { item } = placed;
  const w = partWidths(ctx, item, fontFamily);

  let cursor = x;
  drawText(ctx, item.name, cursor, y, {
    size: NAME_SIZE,
    weight: 700,
    color: palette.seriesWhite,
    baseline: "middle",
    family: fontFamily,
  });
  cursor += w.name + 22;

  cursor += drawTabular(ctx, item.value, cursor, y, {
    size: VALUE_SIZE,
    weight: 600,
    color: withAlpha(palette.seriesWhite, 0.92),
    baseline: "middle",
    family: fontFamily,
  });

  drawText(ctx, ` ${item.unit}`, cursor, y, {
    size: VALUE_SIZE,
    weight: 500,
    color: palette.textPale,
    baseline: "middle",
    family: fontFamily,
  });
  cursor += w.unit + 26;

  drawTabular(ctx, w.changeText, cursor, y, {
    size: VALUE_SIZE,
    weight: 600,
    color: item.change >= 0 ? palette.tickerGreen : palette.tickerRed,
    baseline: "middle",
    family: fontFamily,
  });
};

export const TickerStrip: DashboardLayer = {
  name: "TickerStrip",
  paint: (env) => {
    const { ctx, anim } = env;
    const strip = LAYOUT.ticker;
    const layout = getLayout(ctx, env.fontFamily);
    const offset = anim.tickerOffset % layout.total;
    const y = strip.y + strip.h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(strip.x, strip.y, strip.w, strip.h);
    ctx.clip();

    for (const placed of layout.placed) {
      // Draw each item in both the current pass and the one behind it, so the
      // list is seamless across the wrap point.
      for (const lap of [0, layout.total]) {
        const x = placed.x - offset + lap;
        if (x > DESIGN_WIDTH || x + placed.width < 0) continue;
        drawItem(env, placed, x, y);
      }
    }
    ctx.restore();
  },
};
