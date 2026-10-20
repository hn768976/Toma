import React, { useMemo } from 'react';
import { popScale, scaleAbout } from '../lib/anim';
import { H, INK, LINE, W } from '../lib/config';
import { handLine, Pt, wavyLine } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { sequence, SeqItem, withExit } from '../lib/pen';
import { rngFor } from '../lib/random';
import { curl, heartStroke, rays, sparkleStroke, starStroke } from '../lib/shapes';

const ID = 'GS_TitleFrame';
export const TITLE_FRAME_FRAMES = 180;

const black = { color: INK.main, size: LINE.doodle + 2, streak: true, speed: 0.7 };
const red = { color: INK.red, size: LINE.doodle };
const orange = { color: INK.orange, size: LINE.doodle };

const build = (): Element[] => {
  const r = (k: string) => rngFor(ID, k);
  const m = 150;
  const over = 46;
  // four sides, each overshooting its corners a little, like a ruler-less hand
  const sides: SeqItem[] = [
    { ...black, pts: handLine([m - over, m + 8], [W - m + over * 0.6, m - 6], r('top'), 5) },
    { ...black, pts: handLine([W - m - 6, m - over * 0.8], [W - m + 10, H - m + over], r('right'), 4) },
    { ...black, pts: handLine([W - m + over * 0.7, H - m + 4], [m - over, H - m - 10], r('bottom'), 5) },
    { ...black, pts: handLine([m + 8, H - m + over * 0.5], [m - 4, m - over], r('left'), 4) },
  ];
  const els: Element[] = [];
  const frame = sequence(ID, 'frame', sides, 6);
  els.push({ id: 'frame', strokes: frame.strokes });

  // corner flourishes: a curl tucked inside each corner plus a short tail
  const corners: { key: string; c: Pt; rot: number; dir: 1 | -1 }[] = [
    { key: 'curl-tl', c: [m + 105, m + 100], rot: Math.PI * 1.25, dir: 1 },
    { key: 'curl-tr', c: [W - m - 105, m + 100], rot: -Math.PI * 0.25, dir: -1 },
    { key: 'curl-br', c: [W - m - 105, H - m - 100], rot: Math.PI * 0.25, dir: 1 },
    { key: 'curl-bl', c: [m + 105, H - m - 100], rot: Math.PI * 0.75, dir: -1 },
  ];
  let t = frame.end + 4;
  for (const k of corners) {
    const rr = r(k.key);
    const spiral = curl(k.c, 78, 1.6, k.rot, k.dir, rr);
    const dx = Math.sign(W / 2 - k.c[0]);
    const dy = Math.sign(H / 2 - k.c[1]);
    const tail = wavyLine([k.c[0] + dx * 430, k.c[1] - dy * 48], [k.c[0] + dx * 70, k.c[1] - dy * 70], 12, 1.5, rr);
    const seq = sequence(ID, k.key, [{ ...black, pts: [...tail, ...spiral], speed: 0.5, size: LINE.doodle }], t);
    els.push({ id: k.key, strokes: seq.strokes });
    t = seq.end + 3;
  }

  // little doodles along the edges, popping in
  const doodles: { key: string; c: Pt; items: SeqItem[] }[] = [
    { key: 'd-star', c: [880, 330], items: [{ ...orange, pts: starStroke([880, 340], 125, r('ds')), speed: 0.45 }] },
    { key: 'd-heart', c: [3000, 330], items: [{ ...red, pts: heartStroke([3000, 330], 105, r('dh')), speed: 0.45 }] },
    {
      key: 'd-sparkle',
      c: [3520, 1080],
      items: [{ ...black, pts: sparkleStroke([3520, 1080], 120, r('dsp')), speed: 0.45, size: LINE.doodle - 2 }],
    },
    { key: 'd-dots', c: [2860, 1850], items: [0, 1, 2].map((i) => ({ ...black, pts: dot([2760 + i * 110, 1840 + (i % 2) * 22], r('dd' + i)), speed: 0.3 })) },
    {
      key: 'd-burst',
      c: [960, 1830],
      items: rays([960, 1830], 45, 165, 5, r('db'), 0.3).map((pts) => ({ ...orange, pts, speed: 0.3, size: LINE.doodle - 2 })),
    },
    { key: 'd-wave', c: [320, 1080], items: [{ ...red, pts: wavyLine([330, 850], [345, 1310], 30, 3, r('dw')), speed: 0.5 }] },
  ];
  let td = t - 6;
  for (const d of doodles) {
    const seq = sequence(ID, d.key, d.items, td);
    const s = td;
    els.push({ id: d.key, strokes: seq.strokes, transform: (f) => scaleAbout(d.c, popScale(f, s)) });
    td += 5;
  }
  // exits: staggered reverse draw, 0.4 s each, clean green before 6 s
  const order = [...els].reverse();
  return order
    .map((e, n) => ({ ...e, strokes: withExit(e.strokes, 132 + n * 2, 12, 'reverse') }))
    .reverse();
};

/** A dot: a tiny closed scribble. */
const dot = (c: Pt, r: () => number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2.4 + r() * 0.2;
    const rad = 13 + (i / 24) * 7;
    pts.push([c[0] + Math.cos(a) * rad, c[1] + Math.sin(a) * rad]);
  }
  return pts;
};

export const TitleFrame: React.FC = () => {
  const els = useMemo(build, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};
