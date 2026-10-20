import React, { useMemo } from 'react';
import { popScale, scaleAbout, twinkle } from '../lib/anim';
import { INK, LINE } from '../lib/config';
import { Pt, wobble } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { sequence, SeqItem, withExit } from '../lib/pen';
import { irange, range, rngFor } from '../lib/random';
import { chain, roughPolygon } from '../lib/rough';
import { rays, shineMarks, sparkleStroke, starPoints, starStroke } from '../lib/shapes';

const ID = 'GS_StarsSparkles';
export const STARS_SPARKLES_FRAMES = 240;

const orange = { color: INK.orange, size: LINE.doodle + 4 };
const black = { color: INK.main, size: LINE.doodle, streak: true };

type Kind = { key: string; c: Pt; items: SeqItem[] };

const star = (key: string, c: Pt, R: number, rot: number): Kind => {
  const r = rngFor(ID, key);
  const outline = starStroke(c, R, r, rot);
  const fill = roughPolygon(starPoints(c, R * 0.86, rngFor(ID, key, 'fill'), rot), ID, key, {
    fill: INK.orange,
    fillStyle: 'zigzag',
    hachureGap: R * 0.13,
    hachureAngle: range(rngFor(ID, key, 'angle'), -62, -22),
    disableMultiStrokeFill: true,
    roughness: 1.4,
  });
  // the hatch goes in as one continuous back-and-forth scribble
  const fills = [chain(fill.fill, 1e9)[0]].filter((p) => p && p.length > 4).map((p) => wobble(p, rngFor(ID, key, 'hatch'), 5, 160));
  return {
    key,
    c,
    items: [{ ...orange, pts: outline, speed: 0.55 }, ...fills.map((pts) => ({ ...orange, size: LINE.doodle * 0.75, pts, speed: 0.45, thinning: 0.3 }))],
  };
};

const sparkle = (key: string, c: Pt, R: number, color: 'black' | 'orange', nRays: number): Kind => {
  const r = rngFor(ID, key);
  const body = color === 'black' ? black : orange;
  return {
    key,
    c,
    items: [
      { ...body, pts: sparkleStroke(c, R, r), speed: 0.5 },
      ...rays(c, R * 1.25, R * 1.75, nRays, r, range(r, 0, 1)).map((pts) => ({ ...(color === 'black' ? orange : black), pts, speed: 0.35 })),
    ],
  };
};

const shine = (key: string, c: Pt, dir: number, len: number): Kind => {
  const r = rngFor(ID, key);
  return { key, c, items: shineMarks(c, dir, len, r).map((pts) => ({ ...black, pts, speed: 0.35 })) };
};

const build = (): Element[] => {
  const kinds: Kind[] = [
    star('star-a', [640, 600], 300, 0.08),
    sparkle('spark-a', [1660, 430], 165, 'black', 5),
    star('star-b', [3170, 640], 235, -0.12),
    sparkle('spark-b', [960, 1640], 210, 'orange', 5),
    shine('shine-a', [930, 300], -0.75, 130),
    star('star-c', [2620, 1700], 330, 0.18),
    sparkle('spark-c', [3440, 1560], 150, 'black', 4),
    sparkle('spark-d', [1960, 1080], 120, 'orange', 4),
    shine('shine-b', [2210, 1400], -0.9, 120),
  ];
  const els: Element[] = [];
  let t = 6;
  kinds.forEach((k, n) => {
    const seq = sequence(ID, k.key, k.items, t);
    const start = t;
    const tr = rngFor(ID, k.key, 'twinkle');
    const period = irange(tr, 34, 52);
    const phase = irange(tr, 0, period);
    const popEnd = start + 10;
    els.push({
      id: k.key,
      strokes: withExit(seq.strokes, 190 + n * 3, 12, 'reverse'),
      transform: (f) => {
        const tw = twinkle(f, popEnd + 8, period, phase);
        return scaleAbout(k.c, popScale(f, start) * tw.s, tw.r);
      },
    });
    t = Math.max(t + 16, Math.round((seq.end + t) / 2) + 6);
  });
  return els;
};

export const StarsSparkles: React.FC = () => {
  const els = useMemo(build, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};
