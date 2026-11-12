import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Horn } from '../characters/NovaFace';
import { fontFamily } from '../fonts';
import { LottieAt } from '../lib/LottieAt';
import { blinkAt, breathe, ease, Key, popScale, track, wave } from '../lib/motion';
import { C, LETTER_COLORS } from '../theme';

const START = 150; // global frame where this shot begins
const LX = [330, 750, 1170, 1590];
const LY = 440;
const BASELINE = 593; // letter baseline = squash pivot
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
    y = track(t, [[-2, 0, ease.inOut], [0, 8, ease.rise], [4, -62, ease.inOut], [6, -64, ease.fall], [9, 0, ease.out], [12, 0]]);
    st = track(t, [[-2, 1, ease.inOut], [0, 0.85, ease.snap], [3, 1.14, ease.inOut], [6, 0.98, ease.in], [9, 0.84, ease.out], [11, 1.04, ease.inOut], [12, 1]]);
  }
  return { y, st };
};

const Letter: React.FC<{ f: number; i: number }> = ({ f, i }) => {
  const P = POP[i];
  if (f < P) return null;
  const s = popScale(f, P);
  const popSt = track(f, [[P, 1.28, ease.out], [P + 5, 0.9, ease.inOut], [P + 9, 1.06, ease.inOut], [P + 13, 1]]);
  const b = bounceAt(f, i);
  const st = popSt * b.st;
  const br = f > P + 17 ? breathe(f, i * 1.7) : 1;
  const rot = track(f, [[P, -14, ease.out], [P + 6, 6, ease.inOut], [P + 11, -3, ease.inOut], [P + 16, 0]]) + (f > P + 16 ? 1.5 * wave(f, 0.5, i) : 0);
  const color = LETTER_COLORS[i % LETTER_COLORS.length];
  const ring = f - P;
  return (
    <>
      {ring < 12 ? (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <circle
            cx={LX[i]}
            cy={LY + 10}
            r={120 + 140 * ease.out(ring / 12)}
            fill="none"
            stroke={color}
            strokeWidth={14 * (1 - ease.out(ring / 12)) + 1}
            opacity={1 - ease.in(ring / 12)}
          />
        </svg>
      ) : null}
      {/* SVG text (not HTML text + CSS scale): avoids a Chrome raster ghosting glitch on huge glyphs */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g
          transform={`translate(${LX[i]} ${BASELINE + b.y + 4 * wave(f, 0.5, i * 1.3) * (f > P + 17 ? 1 : 0)}) rotate(${rot}) scale(${(s * br) / Math.sqrt(st)} ${s * br * Math.sqrt(st)})`}
          fontFamily={fontFamily}
          fontWeight={600}
          fontSize={400}
          textAnchor="middle"
        >
          <text x={0} y={14} fill="rgba(29,43,83,0.16)">
            {LETTERS[i]}
          </text>
          <text x={0} y={0} fill={color}>
            {LETTERS[i]}
          </text>
        </g>
      </svg>
    </>
  );
};

/* ---------- Nova's head + horn peeking from the bottom edge ---------- */
const TIP_Y = 645;
const HORN_LEN = 330;
const HORN_ANG = -66;

const tipXKeys: Key[] = [
  [150, LX[0] - 20], [183, LX[0] - 20, ease.inOut], [192, LX[1] - 6, ease.inOut], [196, LX[1] - 20],
  [213, LX[1] - 20, ease.inOut], [222, LX[2] - 6, ease.inOut], [226, LX[2] - 20],
  [273, LX[2] - 20, ease.inOut], [282, LX[3] - 6, ease.inOut], [286, LX[3] - 20],
];

const jab = (f: number, b: number): Key[] => [
  [b - 6, 0, ease.inOut], [b - 2, -30, ease.snap], [b, 16, ease.inOut], [b + 3, -4, ease.inOut], [b + 6, 0],
];

const liftAt = (f: number) => {
  // entrance (on beat 165), jabs on 195/225/255/285, recoil from the spiky Puff, exit after D
  const keys: Key[] = [
    [150, -440], [157, -440, ease.inOut], [160, -470, ease.snap], [165, 16, ease.inOut], [169, -5, ease.inOut], [173, 0],
    ...jab(f, 195),
    [219, 0, ease.inOut], [223, -30, ease.snap], [225, 16, ease.inOut], [228, 0],
    [232, 0, ease.snap], [235, -170, ease.inOut], [246, -150, ease.inOut], [250, -170, ease.inOut],
    [253, -30, ease.snap], [255, 16, ease.inOut], [258, -4, ease.inOut], [261, 0],
    ...jab(f, 285),
    [294, 0, ease.inOut], [297, 18, ease.in], [305, -520],
  ];
  return track(f, keys);
};

const NovaPeek: React.FC<{ f: number }> = ({ f }) => {
  const tipX = track(f, tipXKeys);
  const lagX = track(f - 3, tipXKeys);
  const lift = liftAt(f);
  const lean = (tipX - lagX) * 0.035; // secondary tilt while sliding
  const ang = HORN_ANG + lean + track(lift, [[-40, 6], [0, 0], [16, -4]]) + 1.2 * wave(f, 0.6);
  const a = (ang * Math.PI) / 180;
  const baseX = tipX - Math.cos(a) * HORN_LEN;
  const baseY = TIP_Y - Math.sin(a) * HORN_LEN - lift;
  const headR = 190;
  const cx = baseX - 34;
  const cy = baseY + headR - 14;
  const blink = blinkAt(f, [208, 268]);
  const sq = 1 + track(lift, [[-40, -0.05], [0, 0], [16, 0.04]]);
  const ouch = f >= 232 && f < 252;
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <g transform={`translate(${cx} ${cy + headR}) scale(${1 / sq} ${sq}) translate(${-cx} ${-(cy + headR)})`}>
        <g transform={`translate(${baseX} ${baseY}) rotate(${ang})`}>
          <Horn length={HORN_LEN} width={78} sw={SW} />
        </g>
        <circle cx={cx} cy={cy} r={headR} fill={C.coral} stroke={C.navy} strokeWidth={SW} />
        <ellipse cx={cx - 70} cy={cy - 140} rx={12} ry={8} fill={C.coralDark} />
        <ellipse cx={cx + 90} cy={cy - 150} rx={9} ry={6} fill={C.coralDark} />
        {/* eye tops peeking over the frame edge, looking up at the letter */}
        {[cx - 62, cx + 52].map((ex, k) => {
          const ey = cy - 92;
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
                  clipPath="none"
                />
              ) : null}
              <path d={`M ${ex - rx * 0.7} ${ey - ry - 18 - (ouch ? -6 : 0)} Q ${ex} ${ey - ry - 30} ${ex + rx * 0.7} ${ey - ry - 20}`} stroke={C.navy} strokeWidth={5} fill="none" strokeLinecap="round" />
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
              <line key={k} x1={x0} y1={y0} x2={x0 - 260 * t * Math.cos((dirDeg * Math.PI) / 180)} y2={y0 - 260 * t * Math.sin((dirDeg * Math.PI) / 180)} stroke={C.navy} strokeWidth={8} strokeLinecap="round" opacity={fade} />
            );
          })}
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: LX[2] - PUFF_SIZE / 2 + zx,
          top: LY - PUFF_SIZE / 2 + 10 + rise + zy,
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
