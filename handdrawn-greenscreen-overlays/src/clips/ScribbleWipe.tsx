import React, { useMemo } from 'react';
import { H, INK, W } from '../lib/config';
import { Easing } from 'remotion';
import { clamp01, cumulative, Pt, spline } from '../lib/geom';
import { Element, GreenScreen, InkElements } from '../lib/InkLayer';
import { Stroke } from '../lib/pen';
import { onTwos, range, rngFor, signed } from '../lib/random';

const ID = 'GS_ScribbleWipe';
export const SCRIBBLE_WIPE_FRAMES = 90;

/** Cut point: the scribble is complete and the frame fully covered on these frames (1.2 s - 1.6 s). */
export const COVER_FROM = 36;
export const COVER_TO = 48;
/** Un-scribble: 1.6 s - ~2.9 s, then clean green. */
const UNSCRIBBLE = 40;

// A fat felt marker: the zig-zag passes are far wider than the 28 px line
// weight so a hand-speed scribble can bury a 4K frame in 1.2 s.
const MARKER = 400;

const build = (): Element[] => {
  const r = rngFor(ID, 'scribble');
  const ctrl: Pt[] = [[-480, H + range(r, 200, 300)]]; // start below the bottom-left corner
  let x = -380;
  let up = true;
  while (x < W + 300) {
    x += range(r, 195, 230);
    const y = up ? range(r, -330, -230) : H + range(r, 230, 330);
    // each pass bows a little, so the leading edge is never a ruler line
    const prev = ctrl[ctrl.length - 1];
    ctrl.push([(prev[0] + x) / 2 + signed(r, 40), (prev[1] + y) / 2 + signed(r, 120)]);
    ctrl.push([x + signed(r, 25), y]);
    up = !up;
  }
  // rounded hairpin turns, like a real back-and-forth scribble
  const pts = spline(ctrl, 18);
  // One pen movement, cut into its passes at the hairpins (off-frame) so that
  // overlapping passes darken each other like real marker ink.
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  const turns = [0];
  for (let i = 1; i < pts.length - 1; i++) {
    const isTurn = (pts[i][1] < -150 && pts[i][1] <= pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) || (pts[i][1] > H + 150 && pts[i][1] >= pts[i - 1][1] && pts[i][1] >= pts[i + 1][1]);
    if (isTurn) turns.push(i);
  }
  turns.push(pts.length - 1);
  // global pace: near-constant across the frame, easing in and out a little
  const pace = (t: number) => 0.8 * t + 0.2 * (t * t * (3 - 2 * t));
  const DRAW_FROM = 0;
  const DRAW_TO = COVER_FROM - 1;
  const strokes: Stroke[] = [];
  for (let k = 0; k < turns.length - 1; k++) {
    const seg = pts.slice(turns[k], turns[k + 1] + 1);
    const u0 = cum[turns[k]] / L;
    const u1 = cum[turns[k + 1]] / L;
    strokes.push({
      id: `${ID}/pass/${k}`,
      pts: seg,
      color: INK.main,
      size: MARKER,
      thinning: 0.35,
      taper: false,
      streak: false,
      boil: 3,
      ease: (t: number) => t,
      start: 0,
      dur: 1,
      exitStart: Infinity,
      exitDur: 1,
      exitMode: 'none',
      windowFn: (frame: number) => {
        const f = onTwos(frame);
        const head = pace(clamp01((f - DRAW_FROM) / (DRAW_TO - DRAW_FROM)));
        const tail = f >= COVER_TO ? Easing.in(Easing.quad)(clamp01((f - COVER_TO) / UNSCRIBBLE)) : 0;
        const to = clamp01((head - u0) / (u1 - u0));
        const from = clamp01((tail - u0) / (u1 - u0));
        return to - from > 0.0001 ? [from, to] : null;
      },
    });
  }
  return [{ id: 'scribble', strokes }];
};

export const ScribbleWipe: React.FC = () => {
  const els = useMemo(build, []);
  return (
    <GreenScreen>
      <InkElements elements={els} />
    </GreenScreen>
  );
};
