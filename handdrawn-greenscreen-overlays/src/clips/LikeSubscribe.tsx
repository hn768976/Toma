import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { popScale, scaleAbout } from '../lib/anim';
import { GREEN, H, INK, LINE, W, WORDS } from '../lib/config';
import { arrowHead, clamp01, cubic, endDir, Pt, wobble } from '../lib/geom';
import { Element, InkElements } from '../lib/InkLayer';
import { sequence } from '../lib/pen';
import { hashKeys, onTwos, rngFor } from '../lib/random';
import { chain, roughPolygon } from '../lib/rough';
import { bellStrokes, heartStroke } from '../lib/shapes';
import { TegakiText } from '../lib/TegakiText';

const ID = 'GS_LikeSubscribe';
export const LIKE_SUBSCRIBE_FRAMES = 180;

// Caveat cap height is 0.61 em: 470 px type -> 287 px caps, ~13.3% of 2160 (about 14%)
// while leaving room for the heart and bell either side.
const FONT_SIZE = 470;
const WRITE_END = 88; // 0-3 s
const FADE_FROM = 162; // 5.4 s
const FADE_TO = 178;
const HEART_C: Pt = [335, 960];
const BELL_C: Pt = [3520, 960];
const BELL_S = 190;
const BELL_PIVOT: Pt = [3520, 960 - BELL_S];

const build = (): Element[] => {
  const r = (k: string) => rngFor(ID, k);
  const els: Element[] = [];
  // red heart: outline + hatched (zig-zag) fill
  const heartPts = heartStroke(HEART_C, 195, r('heart'));
  const hatch = roughPolygon(heartPts.filter((_, i) => i % 3 === 0), ID, 'heart-fill', {
    fill: INK.red,
    fillStyle: 'zigzag',
    hachureGap: 34,
    hachureAngle: -35,
    disableMultiStrokeFill: true,
    roughness: 1.2,
  });
  const heart = sequence(
    ID,
    'heart',
    [
      { color: INK.red, size: LINE.doodle + 6, pts: heartPts, speed: 0.5 },
      ...[chain(hatch.fill, 1e9)[0]].map((pts) => ({ color: INK.red, size: LINE.doodle - 2, thinning: 0.3, pts, speed: 0.3 })),
    ],
    WRITE_END + 2,
  );
  els.push({ id: 'heart', strokes: heart.strokes, transform: (f) => scaleAbout(HEART_C, popScale(f, WRITE_END + 2)) });

  // bell: pops in, then wiggles twice during the hold
  const bell = sequence(
    ID,
    'bell',
    bellStrokes(BELL_C, BELL_S, r('bell')).map((pts, i) => ({ color: INK.main, size: LINE.doodle + 5, streak: true, pts, speed: i ? 0.35 : 0.5 })),
    WRITE_END + 8,
  );
  els.push({
    id: 'bell',
    strokes: bell.strokes,
    transform: (f) => {
      const pop = popScale(f, WRITE_END + 8);
      const wig = (from: number) => interpolate(f - from, [0, 2, 4, 6, 8, 10, 12], [0, 14, -12, 9, -6, 3, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const rot = wig(126) + wig(144);
      return `${scaleAbout(BELL_C, pop)} ${scaleAbout(BELL_PIVOT, 1, rot)}`;
    },
  });
  // arrow pointing down-right
  const shaft = wobble(cubic([2330, 1390], [2560, 1800], [3000, 1930], [3420, 1880]), r('arrow'), 5);
  const arrow = sequence(
    ID,
    'arrow',
    [
      { color: INK.main, size: LINE.doodle + 5, streak: true, pts: shaft },
      { color: INK.main, size: LINE.doodle + 5, streak: true, pts: arrowHead(shaft[shaft.length - 1], endDir(shaft, 60), 140, r('head')), speed: 0.7 },
    ],
    WRITE_END + 12,
  );
  els.push({ id: 'arrow', strokes: arrow.strokes });
  return els;
};

export const LikeSubscribe: React.FC = () => {
  const frame = useCurrentFrame();
  const f = onTwos(frame);
  const els = useMemo(build, []);
  // key-safe fade: the ink thins away (morphological erode) instead of going
  // translucent, so no semi-transparent ink ever sits on the green.
  const erode = interpolate(f, [FADE_FROM, FADE_TO], [0, 24], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  const gone = f >= FADE_TO;
  return (
    <AbsoluteFill style={{ backgroundColor: GREEN }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="ink-fade" x="0" y="0" width="100%" height="100%">
          <feMorphology operator="erode" radius={erode} />
        </filter>
      </svg>
      {gone ? null : (
        <AbsoluteFill style={{ filter: erode > 0 ? 'url(#ink-fade)' : undefined }}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <TegakiText
              text={WORDS.likeSubscribe}
              progress={clamp01(f / WRITE_END)}
              fontSize={FONT_SIZE}
              color={INK.main}
              seed={hashKeys(ID) % 100000}
              style={{ marginTop: -110 }}
            />
          </AbsoluteFill>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
            <InkElements elements={els} />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
