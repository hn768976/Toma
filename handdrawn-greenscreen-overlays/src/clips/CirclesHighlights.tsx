import React, { useMemo } from 'react';
import { INK, LINE } from '../lib/config';
import { handEllipse, handLine, Pt } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { sequence, SeqItem, withExit } from '../lib/pen';
import { rngFor } from '../lib/random';
import { roughRect } from '../lib/rough';

const ID = 'GS_CirclesHighlights';
export const CIRCLES_HIGHLIGHTS_FRAMES = 300;

const black = { color: INK.main, size: LINE.doodle, streak: true };
const red = { color: INK.red, size: LINE.doodle };
const hl = { color: INK.yellow, size: 105, thinning: 0.08, taper: false, edge: '#F2BC2A', boil: 1.6 };

const build = (): Element[] => {
  const r = (k: string) => rngFor(ID, k);
  const groups: { key: string; items: SeqItem[] }[] = [];

  groups.push({ key: 'red-circle', items: [{ ...red, pts: handEllipse([720, 520], 360, 250, -0.08, r('red-circle')) }] });
  groups.push({
    key: 'double-oval',
    items: [{ ...black, pts: handEllipse([3060, 470], 440, 185, 0.06, r('double-oval'), { sweep: Math.PI * 2 * 1.85, drift: 0.12 }), speed: 1.1 }],
  });
  groups.push({ key: 'mid-oval', items: [{ ...black, pts: handEllipse([1960, 1075], 820, 205, -0.02, r('mid-oval')), speed: 1.05 }] });
  // highlighter: two passes over the middle, crossing the oval's ink (multiplied over it)
  const h1 = handLine([1120, 1095], [2840, 1060], r('hl1'), 4);
  const h2 = handLine([2790, 1130], [1260, 1150], r('hl2'), 4);
  groups.push({ key: 'highlighter', items: [{ ...hl, pts: h1, speed: 0.9 }, { ...hl, pts: h2, speed: 0.8, gap: -1 }] });
  const box = roughRect(380, 1380, 980, 520, ID, 'box', { disableMultiStroke: true, roughness: 1.6, maxRandomnessOffset: 10, bowing: 2 });
  groups.push({ key: 'box', items: box.outline.map((pts) => ({ ...black, pts, speed: 0.75 })) });
  groups.push({ key: 'red-oval', items: [{ ...red, pts: handEllipse([3020, 1610], 400, 255, 0.22, r('red-oval'), { sweep: Math.PI * 2 + 0.55 }) }] });
  const box2 = roughRect(1640, 1640, 720, 330, ID, 'box2', { disableMultiStroke: true, roughness: 1.5, maxRandomnessOffset: 10, bowing: 2 });
  groups.push({ key: 'box2', items: box2.outline.map((pts) => ({ ...black, pts, speed: 0.7 })) });
  // a little tick of emphasis next to the red circle
  groups.push({ key: 'tick', items: [{ ...red, pts: [...handLine([1180, 300], [1250, 380], r('t1'), 2), ...handLine([1250, 380], [1420, 170], r('t2'), 3).slice(1)] as Pt[], speed: 0.7 }] });

  const els: Element[] = [];
  let t = 8;
  groups.forEach((g, n) => {
    const seq = sequence(ID, g.key, g.items, t);
    els.push({ id: g.key, strokes: withExit(seq.strokes, 244 + n * 4, 12, 'reverse') });
    t = Math.max(t + 22, seq.end + 6);
  });
  return els;
};

export const CirclesHighlights: React.FC = () => {
  const els = useMemo(build, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};
