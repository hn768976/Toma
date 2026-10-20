import React, { useMemo } from 'react';
import { INK, LINE } from '../lib/config';
import { arrowHeads, cubic, endDir, handLine, lerp, Pt, spline, startDir, wobble } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { sequence, SeqItem, withExit } from '../lib/pen';
import { range, rngFor, signed } from '../lib/random';

const ID = 'GS_DoodleArrows';
export const DOODLE_ARROWS_FRAMES = 300;

const ink = { color: INK.main, size: LINE.doodle, streak: true };

/** A loop-de-loop path from a to b. */
const loopPath = (a: Pt, b: Pt, R: number, side: 1 | -1): Pt[] => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / L;
  const dy = (b[1] - a[1]) / L;
  const nx = -dy * side;
  const ny = dx * side;
  const out: Pt[] = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const s = Math.min(1, Math.max(0, (t - 0.32) / 0.36));
    const ph = 2 * Math.PI * s;
    const along = L * t + 1.7 * R * Math.sin(ph);
    const perp = R * (1 - Math.cos(ph)) + Math.sin(Math.PI * t) * L * 0.06;
    out.push([a[0] + dx * along + nx * perp, a[1] + dy * along + ny * perp]);
  }
  return out;
};

const zigzag = (a: Pt, b: Pt, n: number, amp: number, r: () => number): Pt[] => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / L;
  const dy = (b[1] - a[1]) / L;
  const ctrl: Pt[] = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n + signed(r, 0.03);
    const o = (i % 2 ? 1 : -1) * amp * range(r, 0.75, 1.2);
    ctrl.push([a[0] + dx * L * t - dy * o, a[1] + dy * L * t + dx * o]);
  }
  ctrl.push(b);
  // sharp-ish corners: straight hand segments joined
  const pts: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) pts.push(...handLine(ctrl[i], ctrl[i + 1], r, 2).slice(i ? 1 : 0));
  return pts;
};

const buildArrows = (): Element[] => {
  const shafts: { key: string; pts: Pt[]; double?: boolean; head: number }[] = [];
  const r = rngFor(ID, 'shapes');
  // top: straight, pointing down
  shafts.push({ key: 'top-straight', pts: handLine([1965, 150], [1915, 600], r, 4), head: 110 });
  // top-right: loop
  shafts.push({ key: 'tr-loop', pts: wobble(loopPath([3500, 300], [2640, 760], 120, -1), r, 5), head: 115 });
  // right: double-headed
  shafts.push({ key: 'right-double', pts: handLine([3560, 1130], [2800, 1065], r, 5), double: true, head: 100 });
  // bottom-right: zigzag
  shafts.push({ key: 'br-zigzag', pts: zigzag([3440, 1990], [2660, 1440], 5, 115, r), head: 110 });
  // bottom: curved, sweeping up
  shafts.push({ key: 'bottom-curve', pts: wobble(cubic([2380, 2060], [2420, 1800], [2150, 1640], [1985, 1560]), r, 5), head: 105 });
  // bottom-left: loop
  shafts.push({ key: 'bl-loop', pts: wobble(loopPath([380, 1960], [1180, 1430], 105, 1), r, 5), head: 105 });
  // left: straight with a slight bow
  shafts.push({ key: 'left-straight', pts: handLine([230, 1020], [1060, 1085], r, 6), head: 110 });
  // top-left: curved
  shafts.push({ key: 'tl-curve', pts: wobble(cubic([380, 420], [620, 160], [1050, 260], [1240, 700]), r, 6), head: 115 });

  const order = [7, 0, 1, 2, 3, 4, 5, 6];
  const els: Element[] = [];
  let t = 8;
  order.forEach((idx, n) => {
    const s = shafts[idx];
    const rr = rngFor(ID, s.key, 'head');
    const items: SeqItem[] = [{ ...ink, pts: s.pts }];
    const style = [0, 3, 1, 2, 0, 1, 3, 2][n];
    for (const pts of arrowHeads(s.pts[s.pts.length - 1], endDir(s.pts, 60), s.head, rr, style)) items.push({ ...ink, pts, speed: 0.75 });
    if (s.double) for (const pts of arrowHeads(s.pts[0], startDir(s.pts, 60), s.head * 0.9, rr, style + 1)) items.push({ ...ink, pts, speed: 0.75 });
    const seq = sequence(ID, s.key, items, t);
    const exitAt = 246 + n * 4;
    els.push({ id: s.key, strokes: withExit(seq.strokes, exitAt, 12, 'reverse') });
    t = Math.round(lerp(seq.end, t + 26, 0.5)) + 4;
  });
  return els;
};

export const DoodleArrows: React.FC = () => {
  const els = useMemo(buildArrows, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};

export { spline };
