import React, { useMemo } from 'react';
import { INK, LINE } from '../lib/config';
import { cubic, handLine, Pt, wavyLine, wobble } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { sequence, SeqItem, withExit } from '../lib/pen';
import { rngFor } from '../lib/random';

const ID = 'GS_UnderlinesStrikes';
export const UNDERLINES_STRIKES_FRAMES = 240;

const black = { color: INK.main, size: LINE.doodle + 2, streak: true };
const red = { color: INK.red, size: LINE.doodle + 2 };

const build = (): Element[] => {
  const r = (k: string) => rngFor(ID, k);
  const groups: { key: string; items: SeqItem[] }[] = [];
  // rows of imaginary text, marked up like a proof
  groups.push({ key: 'underline', items: [{ ...black, pts: handLine([720, 470], [3020, 492], r('u1'), 6) }] });
  groups.push({
    key: 'double-underline',
    items: [
      { ...red, pts: handLine([980, 838], [2860, 826], r('d1'), 5) },
      { ...red, pts: handLine([1040, 893], [2780, 888], r('d2'), 5), speed: 0.85 },
    ],
  });
  groups.push({ key: 'wavy', items: [{ ...black, pts: wavyLine([760, 1225], [3060, 1205], 26, 11, r('w')), speed: 1.1 }] });
  groups.push({ key: 'strike', items: [{ ...red, pts: handLine([1150, 1572], [2720, 1540], r('s'), 4), speed: 0.8 }] });
  const sw: Pt[] = wobble(cubic([880, 1960], [1700, 2010], [2600, 1990], [3060, 1880]), r('sw'), 5);
  groups.push({ key: 'swoosh', items: [{ ...black, pts: sw }] });

  const els: Element[] = [];
  let t = 8;
  groups.forEach((g, n) => {
    const seq = sequence(ID, g.key, g.items, t);
    els.push({ id: g.key, strokes: withExit(seq.strokes, 190 + n * 4, 12, 'reverse') });
    t = Math.max(t + 26, seq.end + 8);
  });
  return els;
};

export const UnderlinesStrikes: React.FC = () => {
  const els = useMemo(build, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};
