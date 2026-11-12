import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Horn } from '../characters/NovaFace';
import { fontFamily } from '../fonts';
import { LottieAt } from '../lib/LottieAt';
import { blinkAt, breathe, ease, Key, popScale, track, wave } from '../lib/motion';
import { C, LETTER_COLORS } from '../theme';

const START = 150; // global frame where this shot begins
const LX = [330, 750, 1170, 1590];
const LY = 430; // visual centre of the letters
const FONT = 500; // 25% larger than the first pilot
const BASELINE = 608; // letter baseline = squash pivot (cap height ~356)
const LETTERS = ['A', 'B', 'C', 'D'];
const POP = [165, 195, 255, 285]; // C is late: Puff steals its beat at 225
const GAG = 225;
const GROUP_BOUNCES = [300, 315, 330];
const SW = 3;

/* ---------- background: cream with faint drifting shell pattern ---------- */
const FaintShell: React.FC<{ x: number; y: number; rot: number }> = ({ x, y, rot }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(1.6)`} fill="#F8E7C6" stroke="#F1DCB4" strokeWidth={2} strokeLinejoin="round">
    <path d="M 0 14 L -20 -2 Q -22 -18 -10 -22 Q 0 -28 10 -22 Q 22 -18 20 -2 Z" />
    <path d="M 0 12 L -14 -16 M 0 12 L -5 -20 M 0 12 L 5 -20 M 0 12 L 14 -16" fill="none" strokeLinecap="round" />
  </g>
);

const ShellPattern: React.FC<{ f: number }> = ({ f }) => {
  const items: React.ReactNode[] = [];
  const dx = 18 * wave(f, 0.12);
  const dy = 10 * wave(f, 0.09, 1);
  for (let r = -1; r < 8; r++) {
    for (let c = -1; c < 12; c++) {
      const x = c * 180 + (r % 2 ? 90 : 0) + dx;
      const y = r * 150 + dy;
      items.push(<FaintShell key={`${r}-${c}`} x={x} y={y} rot={((r * 37 + c * 53) % 60) - 30} />);
    }
  }
  return <g>{items}</g>;
};

/* ---------- letters ---------- */
const bounceAt = (f: number, i: number) => {
  // the latest group bounce whose window has started (2-frame stagger per letter)
  let y = 0;
  let st = 1;
  for (const b of GROUP_BOUNCES) {
    const t = f - b - i * 2;
    if (t < -2 || t > 12) continue;
    y = track(t, [[-2, 0, ease.inOut], [0, 8, ease.rise], [4, -70, ease.inOut], [6, -72, ease.fall], [9, 0, ease.out], [12, 0]]);
    st = track(t, [[-2, 1, ease.inOut], [0, 0.85, ease.snap], [3, 1.14, ease.inOut], [6, 0.98, ease.in], [9, 0.82, ease.out], [11, 1.04, ease.inOut], [12, 1]]);
  }
  return { y, st };
};

const RING_FRAMES = 8;
const Letter: React.FC<{ f: number; i: number }> = ({ f, i }) => {
  const P = POP[i];
  if (f < P) return null;
  const L = P + 5; // landing frame: peak of the 0 -> 1.15 -> 1 pop
  const s = popScale(f, P);
  // drops in from slightly above, stretched; squashes on landing, rebounds
  const drop = track(f, [[P, -80, ease.in], [L, 0]]);
  const popSt = track(f, [
    [P, 1.3, ease.inOut], [L - 1, 1.12, ease.snap], [L + 2, 0.76, ease.out], [L + 5, 1.08, ease.inOut],
    [L + 8, 0.97, ease.inOut], [L + 11, 1],
  ]);
  const b = bounceAt(f, i);
  const st = popSt * b.st;
  const br = f > P + 17 ? breathe(f, i * 1.7) : 1;
  const rot = track(f, [[P, -14, ease.out], [P + 6, 6, ease.inOut], [P + 11, -3, ease.inOut], [P + 16, 0]]) + (f > P + 16 ? 1.5 * wave(f, 0.5, i) : 0);
  const color = LETTER_COLORS[i % LETTER_COLORS.length];
  const idleBob = f > P + 17 ? 4 * wave(f, 0.5, i * 1.3) : 0;
  // bold ring burst on landing: 4px, letter colour, scales out + fades over 8 frames
  const rt = f - L;
  const ring = rt >= 0 && rt <= RING_FRAMES ? rt / RING_FRAMES : null;
  return (
    // SVG text (not HTML text + CSS scale): avoids a Chrome raster ghosting glitch on huge glyphs
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {ring !== null ? (
        <circle
          cx={LX[i]}
          cy={LY}
          r={170 + 140 * ease.out(ring)}
          fill="none"
          stroke={color}
          strokeWidth={4}
          opacity={1 - ease.in(ring)}
        />
      ) : null}
      <g
        transform={`translate(${LX[i]} ${BASELINE + drop + b.y + idleBob}) rotate(${rot}) scale(${(s * br) / Math.sqrt(st)} ${s * br * Math.sqrt(st)})`}
        fontFamily={fontFamily}
        fontWeight={600}
        fontSize={FONT}
        textAnchor="middle"
      >
        <text x={0} y={16} fill="rgba(29,43,83,0.16)">
          {LETTERS[i]}
        </text>
        <text x={0} y={0} fill={color}>
          {LETTERS[i]}
        </text>
      </g>
    </svg>
  );
};

/* ---------- Nova's head + horn: one rigid unit peeking up from the bottom edge ---------- */
const TIP_Y = BASELINE + 34; // horn tip lands just under the letter, centred on it
const HORN_LEN = 330;
const HORN_REST = -66; // deg
const HEAD_R = 190;
const HORN_BASE = { x: 34, y: -HEAD_R + 40 }; // seated in the forehead (horn draws behind the head)
const TUCK = 78; // horn swung down along the head: never pokes above it while entering/leaving

const tipLocal = (angDeg: number) => {
  const a = (angDeg * Math.PI) / 180;
  return { x: HORN_BASE.x + Math.cos(a) * HORN_LEN, y: HORN_BASE.y + Math.sin(a) * HORN_LEN };
};
const REST_TIP = tipLocal(HORN_REST);
const HIDDEN = -440; // lift that puts the whole head (and tucked horn) below frame

// Tip x: exact under each letter on its beat, held 4 frames, then glides to the next.
const tipXKeys: Key[] = [
  [150, LX[0]], [169, LX[0], ease.inOut], [181, LX[1]],
  [199, LX[1], ease.inOut], [211, LX[2]],
  [259, LX[2], ease.inOut], [271, LX[3]],
];

// per-beat: pull back (b-6 .. b-2), jab (b-2 .. b), exact hold (b .. b+4), dip while gliding
const beatLift = (b: number): Key[] => [
  [b - 6, 0, ease.inOut], [b - 2, -45, ease.snap], [b, 0, ease.hold], [b + 4, 0, ease.inOut], [b + 10, -18, ease.inOut], [b + 16, 0, ease.inOut],
];
const beatAng = (b: number): Key[] => [
  [b - 6, 0, ease.inOut], [b - 2, 10, ease.snap], [b, 0, ease.hold], [b + 4, 0, ease.inOut],
];

const LIFT: Key[] = [
  // entrance: whole head rises with the horn tucked, horn swings up, jabs on 165
  [150, HIDDEN], [154, HIDDEN, ease.out], [158, -30, ease.inOut], [159, -30, ease.inOut], [163, -45, ease.snap], [165, 0, ease.hold],
  [169, 0, ease.inOut], [175, -18, ease.inOut], [181, 0, ease.inOut],
  ...beatLift(195),
  // 225: jabs at the C slot where Puff pops up...
  [219, 0, ease.inOut], [223, -45, ease.snap], [225, 0, ease.hold], [229, 0, ease.out], [231, 14, ease.in],
  // ...Puff inflates: flinch, horn tucks, the whole head slides down out of frame together
  [237, HIDDEN, ease.hold], [245, HIDDEN, ease.out], [250, -30, ease.inOut], [253, -45, ease.snap], [255, 0, ease.hold],
  [259, 0, ease.inOut], [265, -18, ease.inOut], [271, 0, ease.inOut],
  ...beatLift(285),
  // exit after D: small anticipation up, then down out of frame with the horn tucked
  [292, 0, ease.inOut], [295, 16, ease.in], [301, HIDDEN],
];
const ANG: Key[] = [
  [150, TUCK], [158, TUCK, ease.inOut], [163, 10, ease.snap], [165, 0, ease.hold], [169, 0],
  ...beatAng(195),
  [219, 0, ease.inOut], [223, 10, ease.snap], [225, 0, ease.hold], [229, 0, ease.inOut], [231, -6, ease.snap], [234, TUCK],
  [246, TUCK, ease.inOut], [250, 40, ease.inOut], [253, 10, ease.snap], [255, 0, ease.hold], [259, 0],
  ...beatAng(285),
  [292, 0, ease.inOut], [295, TUCK, ease.inOut], [301, TUCK],
];

/** Exposed for checks: where the horn tip is at frame f (screen coords). */
export const hornTipAt = (f: number) => {
  const tipX = track(f, tipXKeys);
  const lift = track(f, LIFT);
  const lean = (tipX - track(f - 3, tipXKeys)) * 0.035;
  const ang = HORN_REST + track(f, ANG) + lean;
  const cx = tipX - REST_TIP.x;
  const cy = TIP_Y - REST_TIP.y - lift;
  const t = tipLocal(ang);
  return { x: cx + t.x, y: cy + t.y, cx, cy, ang, lift };
};

const NovaPeek: React.FC<{ f: number }> = ({ f }) => {
  const { cx, cy, ang, lift } = hornTipAt(f);
  if (cy - HEAD_R > 1090) return null; // fully below frame (horn is tucked then, so also hidden)
  const blink = blinkAt(f, [208, 277]);
  const sq = 1 + track(lift, [[-45, -0.05], [0, 0], [16, 0.04]]);
  const ouch = f >= 231 && f < 250;
  const idle = f > 181 && f < 189 ? 3 * wave(f, 1) : 0; // never fully still between beats
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <g transform={`translate(${cx} ${cy + HEAD_R + idle}) scale(${1 / sq} ${sq}) translate(0 ${-HEAD_R})`}>
        <g transform={`translate(${HORN_BASE.x} ${HORN_BASE.y}) rotate(${ang})`}>
          <Horn length={HORN_LEN} width={78} sw={SW} />
        </g>
        <circle cx={0} cy={0} r={HEAD_R} fill={C.coral} stroke={C.navy} strokeWidth={SW} />
        <ellipse cx={-70} cy={-140} rx={12} ry={8} fill={C.coralDark} />
        <ellipse cx={90} cy={-150} rx={9} ry={6} fill={C.coralDark} />
        {/* eyes looking up at the letter */}
        {[-62, 52].map((ex, k) => {
          const ey = -92;
          const rx = k === 0 ? 34 : 38;
          const ry = 42;
          const lid = ouch ? 0.55 : blink;
          return (
            <g key={k}>
              <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill={C.white} stroke={C.navy} strokeWidth={SW} />
              <circle cx={ex + 8} cy={ey - 12} r={17} fill={C.navy} />
              <circle cx={ex + 3} cy={ey - 18} r={6} fill={C.white} />
              {lid > 0.02 ? (
                <path
                  d={`M ${ex - rx} ${ey} A ${rx} ${ry} 0 0 1 ${ex + rx} ${ey} L ${ex + rx} ${ey - ry + lid * ry * 2} L ${ex - rx} ${ey - ry + lid * ry * 2} Z`}
                  fill={C.coral}
                  stroke={C.navy}
                  strokeWidth={SW}
                />
              ) : null}
              <path
                d={`M ${ex - rx * 0.7} ${ey - ry - 18 + (ouch ? 6 : 0)} Q ${ex} ${ey - ry - 30} ${ex + rx * 0.7} ${ey - ry - 20}`}
                stroke={C.navy}
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

/* ---------- Puff gag: pops up in C's slot, inflates, deflates, zips away ---------- */
const PUFF_SIZE = 636;
const PuffGag: React.FC<{ f: number }> = ({ f }) => {
  if (f < GAG || f > 266) return null;
  const pop = track(f, [[GAG, 0.2, ease.out], [GAG + 4, 1.1, ease.inOut], [GAG + 7, 0.96, ease.inOut], [GAG + 9, 1]]);
  const rise = track(f, [[GAG, 260, ease.out], [GAG + 4, -16, ease.inOut], [GAG + 7, 0]]);
  const popSt = track(f, [[GAG, 1.35, ease.out], [GAG + 4, 0.9, ease.inOut], [GAG + 7, 1]]);
  // zip: anticipation pull back 253-255, then shoot off to the upper right
  const zx = track(f, [[253, 0, ease.inOut], [255, -30, ease.in], [262, 1100]]);
  const zy = track(f, [[253, 0, ease.inOut], [255, 24, ease.in], [262, -820]]);
  const zst = track(f, [[253, 1, ease.inOut], [255, 0.8, ease.snap], [257, 1.5]]);
  const zipping = f >= 255;
  const dirDeg = -37;
  const lottieFrame = f - (GAG + 4);
  return (
    <>
      {zipping ? (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {[-50, 0, 50].map((o, k) => {
            const t = ease.out(Math.min(1, (f - 255) / 6));
            const fade = 1 - ease.in(Math.min(1, (f - 255) / 10));
            const x0 = LX[2] + zx - 160 - k * 10;
            const y0 = LY + zy + 130 + o;
            return (
              <line key={k} x1={x0} y1={y0} x2={x0 - 260 * t * Math.cos((dirDeg * Math.PI) / 180)} y2={y0 - 260 * t * Math.sin((dirDeg * Math.PI) / 180)} stroke={C.navy} strokeWidth={6} strokeLinecap="round" opacity={fade} />
            );
          })}
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: LX[2] - PUFF_SIZE / 2 + zx,
          top: LY - PUFF_SIZE / 2 + rise + zy,
          width: PUFF_SIZE,
          height: PUFF_SIZE,
          transformOrigin: '50% 70%',
          rotate: zipping ? `${dirDeg}deg` : '0deg',
          scale: zipping ? `${zst} ${1 / zst}` : `${pop / Math.sqrt(popSt)} ${pop * Math.sqrt(popSt)}`,
        }}
      >
        <div style={{ width: '100%', height: '100%', rotate: zipping ? `${-dirDeg}deg` : '0deg' }}>
          <LottieAt file="puff_inflate.json" frame={lottieFrame} style={{ width: PUFF_SIZE, height: PUFF_SIZE }} />
        </div>
      </div>
    </>
  );
};

/** 150-345: letter close-up. */
export const LetterCloseUp: React.FC = () => {
  const f = useCurrentFrame() + START;
  return (
    <AbsoluteFill style={{ backgroundColor: C.cream, overflow: 'hidden' }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <ShellPattern f={f} />
      </svg>
      {[0, 1, 2, 3].map((i) => (
        <Letter key={i} f={f} i={i} />
      ))}
      <PuffGag f={f} />
      <NovaPeek f={f} />
    </AbsoluteFill>
  );
};
