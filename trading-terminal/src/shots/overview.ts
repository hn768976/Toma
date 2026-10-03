import { DURATION } from "../engine/data";
import { easeInOutSine, lerp } from "../engine/random";
import { drawCandleChart, drawHistogram, drawOscillator } from "../draw/chart";
import { drawTrades } from "../draw/orderbook";
import { drawAreaChart, drawOrdersTable, drawSignalPanel, drawStatsStrip, drawToolbar } from "../draw/panels";
import { hline, panelFrame } from "../draw/primitives";
import { C } from "../theme";
import { drawScreenBase } from "./background";
import { ShotDef } from "./types";

// Shot 1 – Overview: whole terminal, camera glides from the main chart to the
// signal panel with a slight push-in.
const W = 7000;
const H = 3700;

const e = (frame: number) => easeInOutSine(frame / (DURATION - 1));
const LOOK0: [number, number] = [2000, 1750];
const LOOK1: [number, number] = [4450, 2200];
const look = (f: number): [number, number] => [lerp(LOOK0[0], LOOK1[0], e(f)), lerp(LOOK0[1], LOOK1[1], e(f))];

export const overview: ShotDef = {
  W,
  H,
  camera: (f) => ({
    rx: 15,
    ry: 20,
    rz: -1.5,
    look: look(f),
    zLook: lerp(320, 780, e(f)),
    perspective: 3000,
  }),
  focus: look,
  dof: { k: 0.03, max: 70 },
  crop: [350, 0, 6850, 3300],
  oversample: 1.35,
  bloom: { wide: 0.95, tight: 0.85 },
  vignette: 0.5,
  draw: (p, v, s, clock) => {
    drawScreenBase(p, W, H, W * 0.45, H * 0.5);
    const fs = 40;
    drawToolbar(p, clock, { x: 0, y: 0, w: W, h: 84 }, 32);
    panelFrame(p, { x: 20, y: 100, w: W - 40, h: 380 }, C.panel);
    drawStatsStrip(p, s, clock, { x: 20, y: 100, w: W - 40, h: 380 }, 44, 2);

    panelFrame(p, { x: 20, y: 500, w: 3900, h: 2080 }, C.panel);
    const geom = drawCandleChart(p, s, clock, { x: 30, y: 510, w: 3880, h: 1110 }, {
      count: 44,
      rangeCount: 30,
      axisW: 300,
      volFrac: 0.14,
      fs,
      decimals: 2,
      gridRows: 6,
      band: true,
      timeAxis: true,
    });
    hline(p, 20, 3920, 1635, C.line, 2);
    drawOscillator(p, s, clock, { x: 30, y: 1650, w: 3880, h: 430 }, geom.xmap, {
      axisW: 300,
      fs,
      title: "RSI  9  3",
    });
    hline(p, 20, 3920, 2095, C.line, 2);
    drawHistogram(p, s, clock, { x: 30, y: 2105, w: 3880, h: 465 }, geom.xmap, {
      axisW: 300,
      fs,
      title: "MACD  12  26  9",
      decimals: 2,
    });
    panelFrame(p, { x: 20, y: 2600, w: 3900, h: 1080 }, C.panel);
    drawOrdersTable(p, v, s, clock, { x: 20, y: 2600, w: 3900, h: 1080 }, fs);

    const up = v.drift >= 0;
    panelFrame(p, { x: 3940, y: 500, w: 1640, h: 800 }, C.panel);
    drawAreaChart(p, s.areaMain, clock, { x: 3970, y: 520, w: 1020, h: 760 }, up ? C.green : C.red, {
      fs: 36,
      title: "Net flow",
      points: 110,
    });
    drawAreaChart(p, s.areaSide, clock, { x: 5040, y: 520, w: 520, h: 760 }, up ? C.red : C.green, {
      fs: 32,
      title: "Breadth",
      points: 60,
    });
    panelFrame(p, { x: 3940, y: 1320, w: 1640, h: 2360 }, C.panel);
    drawSignalPanel(p, v, clock, { x: 3940, y: 1320, w: 1640, h: 2360 }, fs);

    panelFrame(p, { x: 5600, y: 500, w: 1380, h: 3180 }, C.panel);
    drawTrades(p, v, s, clock, { x: 5600, y: 500, w: 1380, h: 3180 }, { fs: 38, rowH: 66, decimals: 2 });
  },
};
