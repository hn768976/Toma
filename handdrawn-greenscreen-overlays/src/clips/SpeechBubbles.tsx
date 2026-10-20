import React, { useMemo } from 'react';
import { INK, LINE } from '../lib/config';
import { handEllipse, Pt } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { sequence, SeqItem, Stroke, withExit } from '../lib/pen';
import { rngFor } from '../lib/random';
import { roughCurve } from '../lib/rough';
import { bbox, boxBubble, cloud, paintZigzag, speechBubble } from '../lib/shapes';

const ID = 'GS_SpeechBubbles';
export const SPEECH_BUBBLES_FRAMES = 300;

const black = { color: INK.main, size: LINE.doodle + 1, streak: true };
const white = { color: INK.white, blend: 'normal' as const, taper: false, thinning: 0.2, boil: 0 };

interface Shape {
  key: string;
  loop: Pt[];
}

/** Pull a loop in towards its middle so the white never peeks outside the ink. */
const inset = (loop: Pt[], px: number): Pt[] => {
  const b = bbox(loop);
  return loop.map(([x, y]) => {
    const dx = x - b.cx;
    const dy = y - b.cy;
    const l = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, l - px) / l;
    return [b.cx + dx * k, b.cy + dy * k];
  });
};

/** One bubble element: two sketchy Rough.js passes for the outline, then a white paint-marker fill. */
const bubbleElement = (shapes: Shape[], key: string, start: number, exitAt: number): { els: Element[]; end: number } => {
  const els: Element[] = [];
  let t = start;
  for (const sh of shapes) {
    const rough = roughCurve(sh.loop, ID, sh.key, { roughness: 1.5, maxRandomnessOffset: 11, bowing: 2 });
    const outline: SeqItem[] = rough.outline.map((pts, i) => ({ ...black, pts, speed: i ? 0.7 : 0.95, size: i ? LINE.doodle - 2 : LINE.doodle + 1 }));
    // fill paint starts right after the first outline pass
    const seq = sequence(ID, sh.key, outline, t);
    const b = bbox(sh.loop);
    const gap = Math.max(60, (b.y1 - b.y0) / 7);
    const paintPts = paintZigzag(b.x0 - 30, b.y0 - 10, b.x1 + 30, b.y1 + 10, gap);
    const paintStart = seq.strokes[0].start + seq.strokes[0].dur + 2;
    const paint = sequence(ID, sh.key + '/paint', [{ ...white, size: gap * 1.9, pts: paintPts, speed: 0.55 }], paintStart);
    const strokes: Stroke[] = withExit(seq.strokes, exitAt, 12, 'reverse');
    els.push({
      id: sh.key,
      strokes,
      fill: { poly: inset(sh.loop, 15), color: INK.white, paint: withExit(paint.strokes, exitAt, 12, 'reverse'), solidFrom: paint.end + 1, exitAt },
    });
    t = Math.max(seq.end, paint.end) + 3;
  }
  void key;
  return { els, end: t };
};

const build = (): Element[] => {
  const r = (k: string) => rngFor(ID, k);
  const groups: Shape[][] = [
    [{ key: 'left-speech', loop: speechBubble([740, 1060], 480, 300, [1240, 1530], r('left')) }],
    [
      { key: 'right-cloud', loop: cloud([3110, 1020], 470, 285, 9, r('right')) },
      { key: 'right-dot-1', loop: handEllipse([2640, 1440], 70, 52, 0.2, r('d1'), { sweep: Math.PI * 2 + 0.1, wob: 2 }) },
      { key: 'right-dot-2', loop: handEllipse([2500, 1570], 44, 34, 0.1, r('d2'), { sweep: Math.PI * 2 + 0.1, wob: 1.5 }) },
    ],
    [{ key: 'top-box', loop: boxBubble(1340, 150, 1180, 420, 1780, [1640, 790], r('top')) }],
    [{ key: 'bottom-speech', loop: speechBubble([1920, 1800], 560, 230, [2330, 1420], r('bottom'), 0.3) }],
  ];
  const els: Element[] = [];
  let t = 8;
  groups.forEach((g, n) => {
    const b = bubbleElement(g, g[0].key, t, 244 + n * 7);
    els.push(...b.els);
    t = b.end + 6;
  });
  return els;
};

export const SpeechBubbles: React.FC = () => {
  const els = useMemo(build, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};
