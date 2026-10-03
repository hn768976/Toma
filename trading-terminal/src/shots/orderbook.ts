import { DURATION, priceAtTick } from "../engine/data";
import { easeInOutSine, lerp } from "../engine/random";
import { drawCandleChart } from "../draw/chart";
import { drawHeatmap, drawOrderBook, ladderCentre } from "../draw/orderbook";
import { drawToolbar } from "../draw/panels";
import { strokePath } from "../draw/primitives";
import { C } from "../theme";
import { drawScreenBase } from "./background";
import { ShotDef } from "./types";

// Shot 2 – Order book: very steep angle across the screen. Chart on the left
// (near, soft), sharp band on the chart's price edge and the ladder's nearest
// rows, the rest of the screen receding into blur.
const W = 7000;
const H = 3500;

const e = (f: number) => easeInOutSine(f / (DURATION - 1));
const look = (f: number): [number, number] => [lerp(2250, 2450, e(f)), lerp(1300, 1400, e(f))];

export const orderbook: ShotDef = {
  W,
  H,
  camera: (f) => ({
    rx: 0,
    ry: 40,
    rz: -26,
    look: look(f),
    zLook: lerp(1650, 1760, e(f)),
    perspective: 4500,
  }),
  // Sharp band on the chart's price edge and the nearest ladder rows.
  focus: (f) => [2700, look(f)[1]],
  dof: { k: 0.042, max: 80 },
  crop: [880, 280, 5500, 2900],
  oversample: 1.5,
  bloom: { wide: 1.4, tight: 1.2 },
  vignette: 0.7,
  draw: (p, v, s, clock) => {
    drawScreenBase(p, W, H, 2600, H * 0.55);
    drawToolbar(p, clock, { x: 0, y: 0, w: W, h: 84 }, 32);
    const step = 25;
    const centre = ladderCentre(s, clock, step);
    const chart = { x: 30, y: 110, w: 2720, h: 3360 };
    // Ladder geometry first, so the chart's live-price tag lines up with the
    // ladder's highlighted row.
    const ladder = { x: 2770, y: 100, w: 900, h: 3380 };
    const rowH = 104;
    // Rising markets keep their history below the price, falling ones above:
    // anchor the live price so the history runs through the middle of frame.
    const midY = chart.y + (chart.h - 105) * 0.92 * 0.5 - (v.drift > 0 ? 320 : 0);
    const price = priceAtTick(s, clock.tick);
    const highlightY = midY - (Math.round(price / step) - centre / step) * rowH;
    const geom = drawCandleChart(p, s, clock, chart, {
      centrePrice: centre,
      anchor: { price, y: highlightY },
      rangeCount: 15,
      count: 30,
      axisW: 300,
      volFrac: 0.08,
      fs: 50,
      decimals: 2,
      gridRows: 7,
      band: false,
      ma: false,
      hotCore: 0.18,
      timeAxis: true,
      lineScale: 1.3,
      bodyFrac: 0.74,
    });
    // Long glowing guide lines across the chart: a red resistance line at the
    // live price and a blue channel line under the candles. In perspective
    // they cut diagonally across the lower-left of the frame.
    const { plot, yOf, xmap } = geom;
    const live = s.candles[clock.live];
    const yLive = yOf(live.ticks[clock.k]);
    const y0 = yOf(xmap.win.candles[0].l);
    const y1 = yOf(live.l);
    p.ctx.save();
    p.ctx.beginPath();
    p.ctx.rect(plot.x, plot.y, plot.w, plot.h);
    p.ctx.clip();
    strokePath(p, [[plot.x, yLive], [plot.x + plot.w, yLive]], C.red, 3, { glow: 0.6, alpha: 0.6 });
    strokePath(p, [[plot.x, y0 + 620], [plot.x + plot.w, y1 + 520]], C.blue, 2, { glow: 0.35, alpha: 0.55 });
    p.ctx.restore();
    drawOrderBook(p, v, s, clock, ladder, { fs: 52, rowH, step, decimals: 2, midY });
    drawHeatmap(p, v, clock, { x: 3760, y: 160, w: 3200, h: 3280 }, 130);
  },
};
