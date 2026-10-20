import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { GREEN, H, INK, LINE, W, WORDS } from '../lib/config';
import { handEllipse, Pt } from '../lib/geom';
import { Element, InkElements } from '../lib/InkLayer';
import { sequence, Stroke, withExit } from '../lib/pen';
import { hashKeys, onTwos, rngFor } from '../lib/random';
import { rays } from '../lib/shapes';
import { TegakiText } from '../lib/TegakiText';

const ID = 'GS_Countdown';
export const COUNTDOWN_FRAMES = 150;

// digits in Caveat are ~0.53 em tall: 40% of 2160 = 864 px -> ~1630 px type
const FONT_SIZE = 1630;
const SLOT = 36; // 1.2 s per number
const WRITE = 16; // number writes
const CIRCLE_AT = 18; // circle scribble starts
const CLEAR_AT = 29; // number + circle clear
const CLEAR_DUR = 6;
const C: Pt = [W / 2, H / 2];
const BURST_AT = 108; // 3.6 s
const BURST_OUT = 126;

const build = (): Element[] => {
  const els: Element[] = [];
  WORDS.countdown.forEach((_, i) => {
    const base = i * SLOT;
    const r = rngFor(ID, 'circle', i);
    const pts = handEllipse([C[0] + 15, C[1] + 10], 590, 640, 0.15 * (i - 1), r, { sweep: Math.PI * 2 * 1.32, drift: 0.16, wob: 5 });
    const seq = sequence(ID, `circle-${i}`, [{ color: INK.red, size: LINE.doodle + 14, pts, speed: 0.55 }], base + CIRCLE_AT);
    els.push({ id: `circle-${i}`, strokes: withExit(seq.strokes, base + CLEAR_AT, CLEAR_DUR, 'reverse') });
  });
  // burst: doodle lines shooting out of the centre, then flying off outward
  const r = rngFor(ID, 'burst');
  const lines = rays(C, 260, 980, 14, r, 0.1);
  const short = rays(C, 1060, 1220, 14, r, 0.1 + Math.PI / 14);
  const burst: Stroke[] = [...lines, ...short].map((pts, k) => ({
    id: `${ID}/burst/${k}`,
    pts,
    color: k % 3 === 1 ? INK.orange : k % 3 === 2 ? INK.red : INK.main,
    size: LINE.doodle + 6,
    streak: k % 3 === 0,
    start: BURST_AT + (k % 7) % 3 + (k >= 14 ? 4 : 0),
    dur: k >= 14 ? 5 : 8,
    exitStart: BURST_OUT + (k % 5),
    exitDur: 10,
    exitMode: 'retract' as const,
  }));
  els.push({ id: 'burst', strokes: burst });
  return els;
};

export const Countdown: React.FC = () => {
  const frame = useCurrentFrame();
  const f = onTwos(frame);
  const els = useMemo(build, []);
  const i = Math.floor(f / SLOT);
  const local = f - i * SLOT;
  const showNumber = i < WORDS.countdown.length;
  const progress = !showNumber
    ? 0
    : local < CLEAR_AT
      ? Math.min(1, local / WRITE)
      : 1 - interpolate(local, [CLEAR_AT, CLEAR_AT + CLEAR_DUR], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  return (
    <AbsoluteFill style={{ backgroundColor: GREEN }}>
      {showNumber && progress > 0 ? (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <TegakiText key={i} text={WORDS.countdown[i]} progress={progress} fontSize={FONT_SIZE} color={INK.main} seed={hashKeys(ID, i) % 100000} style={{ marginTop: -150, marginLeft: -300 }} />
        </AbsoluteFill>
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
        <InkElements elements={els} />
      </svg>
    </AbsoluteFill>
  );
};
