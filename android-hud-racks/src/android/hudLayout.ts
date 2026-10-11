import {
  barStack,
  circleButton,
  codeLine,
  counter2,
  fillerColumn,
  grid,
  HUD,
  inter,
  makeBars,
  makePrice,
  miniBars,
  orbitron,
  priceReadout,
  rgba,
  ringGauge,
  textLines,
  triangle,
} from "../hud/kit";
import { Widget } from "../hud/layer";
import { TAU } from "../lib/random";

// The trading HUD of Look 1, laid out for 1A (android on the left). Each
// panel sits at its own depth; `u`/`v` give its screen region (0..1) as
// seen from the rest camera. 1B mirrors the regions (u -> 1 - u) but not
// the panel contents, so text always reads normally.

export const LOOP = 600;

export type PanelSpec = {
  name: string;
  z: number; // world z of the panel plane (head plane is 0)
  u: [number, number];
  v: [number, number];
  intensity: number;
  drawStatic?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  widgets?: (w: number, h: number) => Widget[];
};

const price1 = makePrice(101, 261.89, 18);
const price2 = makePrice(202, 243.67, 14);
const price3 = makePrice(303, 98.4, 6);
const price4 = makePrice(404, 314.19, 22);
const bars1 = makeBars(11, 8);
const bars2 = makeBars(12, 14);
const bars3 = makeBars(13, 10);
const bars4 = makeBars(14, 9);

const labelRow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  labels: string[],
  gap: number,
  alpha = 0.75,
) => {
  ctx.font = inter(size, 600);
  ctx.fillStyle = rgba(HUD.line, alpha);
  ctx.textBaseline = "top";
  labels.forEach((l, i) => ctx.fillText(l, x + i * gap, y));
};

export const PANELS: PanelSpec[] = [
  // Far back: faint grid and very large faint words.
  {
    name: "backgrid",
    z: -1.6,
    u: [0.28, 1.04],
    v: [-0.04, 1.04],
    intensity: 0.5,
    drawStatic: (ctx, w, h) => {
      grid(ctx, 0, 0, w, h, 14, 9, rgba(HUD.line, 0.07), 3);
      ctx.font = orbitron(330, 700);
      ctx.fillStyle = rgba(HUD.line, 0.06);
      ctx.textBaseline = "top";
      ctx.fillText("LEARNING", w * 0.08, h * 0.02);
      ctx.font = orbitron(240, 500);
      ctx.fillText("NEURAL CORE", w * 0.18, h * 0.62);
    },
  },
  // Filler text columns, softly out of focus.
  {
    name: "text",
    z: -0.9,
    u: [0.36, 0.72],
    v: [0.04, 0.64],
    intensity: 0.9,
    drawStatic: (ctx, w) => {
      fillerColumn(ctx, 51, 20, 30, 30, 26, 0.32);
      fillerColumn(ctx, 52, w * 0.55, 160, 26, 22, 0.26);
      ctx.font = orbitron(64, 500);
      ctx.fillStyle = rgba(HUD.line, 0.22);
      ctx.fillText("MODEL 4.2", 20, 1200);
    },
  },
  // Top centre: big price readout and its tags.
  {
    name: "price-top",
    z: -0.25,
    u: [0.56, 0.8],
    v: [0.13, 0.26],
    intensity: 1.6,
    drawStatic: (ctx) => {
      labelRow(ctx, 10, 6, 26, ["SIGNAL", "VOL", "RISK"], 170, 0.6);
      ctx.strokeStyle = rgba(HUD.line, 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, 250);
      ctx.lineTo(820, 250);
      ctx.stroke();
    },
    widgets: () => [
      {
        x: 0,
        y: 60,
        w: 820,
        h: 150,
        key: (f) => price1(f, LOOP).text,
        draw: (ctx, f) => {
          const p = price1(f, LOOP);
          priceReadout(ctx, 10, 75, 84, p.text, p.dir);
        },
      },
    ],
  },
  // Top right: bar indicator stacks.
  {
    name: "bars-top-right",
    z: -0.55,
    u: [0.83, 0.995],
    v: [0.025, 0.21],
    intensity: 1.3,
    drawStatic: (ctx) => {
      labelRow(ctx, 0, 380, 24, ["BETA", "ALPHA", "SIGMA"], 160, 0.7);
    },
    widgets: () => [
      {
        x: 0,
        y: 0,
        w: 620,
        h: 360,
        key: (f) => String(Math.floor(f / 3)),
        draw: (ctx, f) => {
          barStack(ctx, 0, 10, 590, 22, 22, bars1(Math.floor(f / 3) * 3, LOOP, 0.2, 1), 24);
        },
      },
    ],
  },
  // Right edge: a second price, partly off frame.
  {
    name: "price-right",
    z: -0.15,
    u: [0.9, 1.06],
    v: [0.3, 0.38],
    intensity: 1.4,
    widgets: () => [
      {
        x: 0,
        y: 0,
        w: 600,
        h: 170,
        key: (f) => price3(f, LOOP).text,
        draw: (ctx, f) => {
          const p = price3(f, LOOP);
          priceReadout(ctx, 20, 70, 60, p.text, p.dir);
          labelRow(ctx, 20, 125, 22, ["INDEX", "AVG"], 140, 0.55);
        },
      },
    ],
  },
  // Middle: floating up/down pair and a small "…" gauge.
  {
    name: "mid",
    z: -0.05,
    u: [0.6, 0.72],
    v: [0.52, 0.66],
    intensity: 1.5,
    widgets: () => [
      {
        x: 0,
        y: 0,
        w: 460,
        h: 300,
        key: (f) => String(Math.floor(f / 25)),
        draw: (ctx, f) => {
          const up = Math.floor(f / 25) % 3 !== 1;
          triangle(ctx, 60, 70, 46, 1, rgba(HUD.up, up ? 1 : 0.3));
          triangle(ctx, 60, 125, 46, -1, rgba(HUD.down, up ? 0.3 : 1));
          ringGauge(ctx, 330, 150, 80, "…", (f / LOOP) * TAU * 2);
        },
      },
    ],
  },
  // Lower right: ring gauge with a counter and a mini bar chart.
  {
    name: "gauge-right",
    z: 0.08,
    u: [0.73, 0.995],
    v: [0.66, 0.88],
    intensity: 1.5,
    drawStatic: (ctx) => {
      ctx.strokeStyle = rgba(HUD.line, 0.45);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(380, 420);
      ctx.lineTo(1000, 420);
      ctx.stroke();
      labelRow(ctx, 400, 432, 22, ["Q1", "Q2", "Q3", "Q4"], 150, 0.6);
    },
    widgets: () => [
      {
        x: 0,
        y: 40,
        w: 360,
        h: 360,
        key: (f) => `${counter2(77, f, 40, LOOP)}:${Math.floor(f / 2)}`,
        draw: (ctx, f) => {
          ringGauge(ctx, 180, 180, 120, counter2(77, f, 40, LOOP), -(f / LOOP) * TAU * 3, 5);
        },
      },
      {
        x: 400,
        y: 120,
        w: 600,
        h: 290,
        key: (f) => String(Math.floor(f / 3)),
        draw: (ctx, f) => {
          miniBars(ctx, 0, 0, 590, 290, bars2(Math.floor(f / 3) * 3, LOOP, 0.15, 1), 0.85);
        },
      },
    ],
  },
  // Bottom centre: bar chart with a faint frame.
  {
    name: "chart-bottom",
    z: -0.35,
    u: [0.4, 0.66],
    v: [0.73, 0.94],
    intensity: 1.2,
    drawStatic: (ctx, w, h) => {
      grid(ctx, 0, 40, w, h - 110, 10, 4, rgba(HUD.line, 0.16), 2);
      labelRow(ctx, 10, h - 50, 22, ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"], (w - 40) / 9, 0.6);
    },
    widgets: (w, h) => [
      {
        x: 0,
        y: 40,
        w,
        h: h - 110,
        key: (f) => String(Math.floor(f / 4)),
        draw: (ctx, f) => {
          miniBars(ctx, 0, 0, w, h - 110, bars3(Math.floor(f / 4) * 4, LOOP, 0.1, 0.95), 0.75);
        },
      },
    ],
  },
  // Lower left, over the chest: price, small code lines and bars.
  {
    name: "price-left",
    z: 0.28,
    u: [0.13, 0.36],
    v: [0.62, 0.8],
    intensity: 1.5,
    drawStatic: (ctx) => {
      ctx.strokeStyle = rgba(HUD.line, 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 200);
      ctx.lineTo(860, 200);
      ctx.stroke();
    },
    widgets: () => [
      {
        x: 0,
        y: 40,
        w: 860,
        h: 150,
        key: (f) => price2(f, LOOP).text,
        draw: (ctx, f) => {
          const p = price2(f, LOOP);
          priceReadout(ctx, 10, 75, 70, p.text, p.dir);
        },
      },
      {
        x: 0,
        y: 220,
        w: 860,
        h: 160,
        key: (f) => `${Math.floor(f / 30)}`,
        draw: (ctx, f) => {
          const c = codeLine(91, f, 30, LOOP);
          textLines(ctx, 10, 6, 26, [c.digits, c.caps], rgba(HUD.line, 0.8), "orbitron");
          miniBars(ctx, 560, 10, 280, 90, bars4(Math.floor(f / 30) * 30, LOOP), 0.8);
        },
      },
    ],
  },
  // Second top price, smaller, further right.
  {
    name: "price-top2",
    z: -0.4,
    u: [0.66, 0.86],
    v: [0.33, 0.42],
    intensity: 1.1,
    widgets: () => [
      {
        x: 0,
        y: 0,
        w: 760,
        h: 190,
        key: (f) => price4(f, LOOP).text,
        draw: (ctx, f) => {
          const p = price4(f, LOOP);
          priceReadout(ctx, 10, 70, 56, p.text, p.dir);
          labelRow(ctx, 10, 130, 22, ["OPEN", "HIGH", "LOW", "CLOSE"], 150, 0.55);
        },
      },
    ],
  },
  // Bottom left: circle buttons, close to camera so slightly soft.
  {
    name: "buttons",
    z: 0.45,
    u: [0.0, 0.16],
    v: [0.86, 1.0],
    intensity: 2.2,
    widgets: () => [
      {
        x: 0,
        y: 0,
        w: 600,
        h: 300,
        key: (f) => String(Math.floor(f / 75) % 4),
        draw: (ctx, f) => {
          const on = Math.floor(f / 75) % 4;
          for (let i = 0; i < 3; i++) circleButton(ctx, 100 + i * 190, 170, 72, i === on % 3, 9);
        },
      },
    ],
  },
];
