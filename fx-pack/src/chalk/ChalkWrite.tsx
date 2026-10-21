import React, { useCallback } from "react";
import { AbsoluteFill, Easing } from "remotion";
import { Canvas2D, Draw2D } from "../lib/Canvas2D";
import { applyGrain, CHALK, fillStroke, jitterPts, partial } from "./render";
import { ChalkItem, getItems } from "./items";
import { Pt } from "./strokes";

const FPS = 30;
const WRITE_END = 8 * FPS; // everything written by 8s, then hold

/** Board layout: item id, top-left (4K px), scale, slight rotation (rad). */
const LAYOUT: [string, number, number, number, number][] = [
  ["triangle", 100, 70, 1.15, 0],
  ["pythagoras", 800, 170, 1.0, -0.02],
  ["sphere", 1560, 60, 1.2, 0],
  ["distance", 2130, 110, 0.95, 0.01],
  ["pi", 2330, 470, 1.0, -0.015],
  ["venn", 3260, 400, 1.1, 0],
  ["cone", 120, 680, 1.15, 0],
  ["quadratic", 690, 640, 1.0, 0.01],
  ["logistic", 1780, 860, 1.0, -0.01],
  ["goldenSpiral", 110, 1270, 1.4, 0],
  ["factor", 920, 1280, 1.0, 0.012],
  ["sineGraph", 2700, 1020, 1.2, 0],
  ["root1225", 150, 1830, 1.0, -0.01],
  ["expSeries", 1000, 1650, 1.0, 0.008],
  ["potential", 2450, 1800, 1.0, -0.012],
  ["einstein", 3180, 1760, 1.1, 0.01],
];

type Placed = {
  item: ChalkItem;
  x: number;
  y: number;
  s: number;
  rot: number;
  start: number; // frame
  dur: number; // frames
  strokeTimes: [number, number][]; // per stroke [t0, t1] within 0..1 of item time
};

const ease = Easing.bezier(0.5, 0, 0.35, 1); // slow start, fast middle, slight slow-down

const PLACED: Placed[] = (() => {
  const items = getItems();
  const list = LAYOUT.map(([id, x, y, s, rot]) => ({ item: items[id], x, y, s, rot }));
  const maxInk = Math.max(...list.map((l) => l.item.ink * l.s));
  // 0.4-0.8s per item by ink length
  const durs = list.map((l) => Math.round(12 + 12 * Math.sqrt((l.item.ink * l.s) / maxInk)));
  const total = durs.reduce((a, b) => a + b, 0);
  const gap = (WRITE_END - 6 - total) / list.length; // pen-lift pauses between items
  let t = 6;
  return list.map((l, i) => {
    // time inside an item: stroke lengths plus a small pen-lift per stroke
    const lift = 0.06 * l.item.ink / Math.max(1, l.item.strokes.length);
    const spans = l.item.lens.map((len) => len + lift);
    const sum = spans.reduce((a, b) => a + b, 0);
    let acc = 0;
    const strokeTimes = spans.map((sp, k) => {
      const t0 = acc / sum;
      acc += sp;
      return [t0, (acc - (k < spans.length - 1 ? lift : 0)) / sum] as [number, number];
    });
    const p: Placed = { ...l, start: Math.round(t), dur: durs[i], strokeTimes };
    t += durs[i] + gap;
    return p;
  });
})();

let layer: HTMLCanvasElement | null = null;
const getLayer = (w: number, h: number) => {
  if (!layer || layer.width !== w || layer.height !== h) {
    layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
  }
  return layer;
};

const drawBoard: Draw2D = (ctx, frame, { bw, bh, k }) => {
  const L = getLayer(bw, bh);
  const lc = L.getContext("2d")!;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = "source-over";
  lc.clearRect(0, 0, bw, bh);
  const hold = frame >= WRITE_END;
  const variant = hold ? Math.floor((frame - WRITE_END) / 3) % 4 : 0;
  lc.fillStyle = CHALK;
  PLACED.forEach((p, pi) => {
    const t = (frame - p.start) / p.dur;
    if (t <= 0) return;
    lc.setTransform(k * p.s, 0, 0, k * p.s, k * p.x, k * p.y);
    lc.rotate(p.rot);
    p.item.strokes.forEach((s, si) => {
      const [t0, t1] = p.strokeTimes[si];
      const local = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      if (local <= 0) return;
      let pts: Pt[] = partial(s.pts, ease(local));
      if (hold) pts = jitterPts(pts, pi * 1000 + si * 7 + variant * 131, 1.6 / p.s);
      fillStroke(lc, pts, pi * 7919 + si * 31 + variant, p.item.lens[si]);
    });
  });
  applyGrain(lc, k, [variant * 211, variant * 97]);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(L, 0, 0);
  ctx.restore();
};

export const ChalkMath_Write: React.FC = () => {
  const draw = useCallback<Draw2D>((c, f, s) => drawBoard(c, f, s), []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Canvas2D draw={draw} />
    </AbsoluteFill>
  );
};

export const WRITE_SCHEDULE = PLACED.map((p) => ({ id: p.item.id, start: p.start, dur: p.dur }));
