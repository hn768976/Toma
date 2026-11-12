import React from 'react';
import { C } from '../theme';
import { breathe, ease, seeded, track, wave } from '../lib/motion';
import { fontFamily } from '../fonts';

export const W = 1920;
export const H = 1080;
const O = 3; // outline

export const sandTop = (x: number) => 852 + 14 * Math.sin(x / 330 + 0.6);

/* ---------------- backdrop ---------------- */
export const Backdrop: React.FC<{ f: number }> = ({ f }) => {
  // flat far-reef silhouettes
  const hills =
    'M -40 900 L -40 770 Q 80 700 200 760 Q 300 690 430 750 Q 560 700 650 770 Q 760 720 900 790 ' +
    'Q 1040 730 1150 780 Q 1280 700 1400 760 Q 1520 690 1660 750 Q 1800 700 1960 770 L 1960 900 Z';
  // light shafts (flat, low-opacity cream)
  const shafts = [
    { x: 260, w: 140, a: -14, ph: 0 },
    { x: 760, w: 90, a: -11, ph: 1.8 },
    { x: 1180, w: 160, a: -13, ph: 3.1 },
    { x: 1660, w: 100, a: -10, ph: 4.4 },
  ];
  return (
    <g>
      <rect x={-200} y={-200} width={W + 400} height={H + 400} fill={C.water} />
      {shafts.map((s, i) => (
        <g key={i} transform={`rotate(${s.a + 1.6 * wave(f, 0.18, s.ph)} ${s.x} -40)`}>
          <polygon
            points={`${s.x - s.w / 2},-60 ${s.x + s.w / 2},-60 ${s.x + s.w * 1.4},900 ${s.x - s.w * 0.4},900`}
            fill={C.cream}
            opacity={0.055 + 0.015 * wave(f, 0.25, s.ph)}
          />
        </g>
      ))}
      <path d={hills} fill={C.waterFar} />
    </g>
  );
};

export const Sand: React.FC = () => {
  const bumps = (offset: number) => {
    let d = `M -60 ${H + 60} L -60 ${sandTop(-60) + offset}`;
    for (let x = -60; x < W + 60; x += 110) {
      const y0 = sandTop(x) + offset;
      const y1 = sandTop(x + 110) + offset;
      d += ` Q ${x + 55} ${(y0 + y1) / 2 - 22} ${x + 110} ${y1}`;
    }
    return d + ` L ${W + 60} ${H + 60} Z`;
  };
  const rnd = seeded(7);
  const specks = Array.from({ length: 70 }, () => ({ x: rnd() * W, y: 890 + rnd() * 190, r: 3 + rnd() * 5 }));
  return (
    <g>
      <path d={bumps(-6)} fill={C.sandDark} />
      <path d={bumps(6)} fill={C.sand} />
      {specks.map((s, i) => (
        <ellipse key={i} cx={s.x} cy={s.y} rx={s.r} ry={s.r * 0.6} fill={C.sandDark} />
      ))}
    </g>
  );
};

/* ---------------- kelp ---------------- */
export const Kelp: React.FC<{
  f: number;
  x: number;
  height: number;
  width?: number;
  phase?: number;
  color?: string;
  dark?: string;
}> = ({ f, x, height, width = 34, phase = 0, color = C.lime, dark = '#6FAE36' }) => {
  const M = 14;
  const base = sandTop(x) + 26;
  const pts: { x: number; y: number; w: number; a: number }[] = [];
  for (let j = 0; j <= M; j++) {
    const s = j / M;
    // sway grows up the strand and lags with height (travelling wave)
    const sway =
      58 * Math.pow(s, 1.5) * Math.sin((f / 30) * Math.PI * 2 * 0.42 - s * 2.4 + phase) +
      10 * Math.pow(s, 2) * Math.sin((f / 30) * Math.PI * 2 * 0.9 - s * 3.5 + phase * 1.7);
    pts.push({ x: x + sway, y: base - s * height, w: width * (1 - 0.55 * s), a: 0 });
  }
  for (let j = 0; j <= M; j++) {
    const p0 = pts[Math.max(0, j - 1)];
    const p1 = pts[Math.min(M, j + 1)];
    pts[j].a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }
  const left = pts.map((p) => [p.x + Math.sin(p.a) * p.w * 0.5, p.y - Math.cos(p.a) * p.w * 0.5]);
  const right = pts.map((p) => [p.x - Math.sin(p.a) * p.w * 0.5, p.y + Math.cos(p.a) * p.w * 0.5]);
  const toD = (arr: number[][]) => {
    let d = `M ${arr[0][0]} ${arr[0][1]}`;
    for (let k = 1; k < arr.length - 1; k++) {
      const mx = (arr[k][0] + arr[k + 1][0]) / 2;
      const my = (arr[k][1] + arr[k + 1][1]) / 2;
      d += ` Q ${arr[k][0]} ${arr[k][1]} ${mx} ${my}`;
    }
    return d;
  };
  const tip = pts[M];
  const d =
    toD(left) +
    ` Q ${tip.x + Math.cos(tip.a) * 26} ${tip.y + Math.sin(tip.a) * 26} ${right[M][0]} ${right[M][1]}` +
    toD(right.slice().reverse()).replace(/^M/, ' L') +
    ' Z';
  const leaves = [3, 5, 7, 9, 11].map((j, k) => {
    const p = pts[j];
    const side = k % 2 === 0 ? 1 : -1;
    const flutter = 10 * Math.sin((f / 30) * Math.PI * 2 * 0.6 - j * 0.5 + phase);
    const ang = (p.a * 180) / Math.PI + side * (55 + flutter);
    return (
      <g key={j} transform={`translate(${p.x} ${p.y}) rotate(${ang})`}>
        <path
          d={`M 0 0 Q 22 -16 ${44 - k * 3} 0 Q 22 14 0 0 Z`}
          fill={dark}
          stroke={C.navy}
          strokeWidth={O}
          strokeLinejoin="round"
        />
      </g>
    );
  });
  return (
    <g>
      {leaves}
      <path d={d} fill={color} stroke={C.navy} strokeWidth={O} strokeLinejoin="round" />
      <path d={toD(pts.map((p) => [p.x, p.y]).slice(1, -2))} fill="none" stroke={dark} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
};

/* ---------------- coral ---------------- */
export const BranchCoral: React.FC<{ f: number; x: number; scale?: number; color?: string; phase?: number }> = ({
  f,
  x,
  scale = 1,
  color = C.orange,
  phase = 0,
}) => {
  const y = sandTop(x) + 20;
  const r = 2.2 * wave(f, 0.35, phase);
  const branches = [
    'M 0 0 Q -4 -60 -2 -120',
    'M -2 -60 Q -40 -80 -46 -128',
    'M -2 -90 Q 30 -110 40 -160',
    'M 18 -112 Q 52 -118 64 -100',
    'M -30 -100 Q -66 -96 -72 -70',
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${r})`}>
      {/* draw all navy outlines first so joints read as one shape */}
      {branches.map((d, i) => (
        <path key={`o${i}`} d={d} stroke={C.navy} strokeWidth={22 + O * 2} fill="none" strokeLinecap="round" />
      ))}
      {branches.map((d, i) => (
        <path key={`f${i}`} d={d} stroke={color} strokeWidth={22} fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
};

export const BubbleCoral: React.FC<{ f: number; x: number; scale?: number; color?: string }> = ({
  f,
  x,
  scale = 1,
  color = C.grape,
}) => {
  const y = sandTop(x) + 18;
  const balls = [
    [-46, -26, 30],
    [0, -44, 40],
    [44, -22, 30],
    [-22, -74, 26],
    [24, -82, 24],
  ];
  const s = breathe(f, 1.2, 0.012, 70);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * (2 - s)} ${scale * s})`}>
      {balls.map(([bx, by, r], i) => (
        <circle key={`o${i}`} cx={bx} cy={by} r={r + O} fill={C.navy} />
      ))}
      {balls.map(([bx, by, r], i) => (
        <g key={`f${i}`}>
          <circle cx={bx} cy={by} r={r} fill={color} />
          <circle cx={bx - r * 0.3} cy={by - r * 0.35} r={r * 0.22} fill="#A783E0" />
        </g>
      ))}
    </g>
  );
};

/* ---------------- shells / slate ---------------- */
export const Shell: React.FC<{ x: number; y: number; size?: number; rot?: number; color?: string }> = ({
  x,
  y,
  size = 1,
  rot = 0,
  color = C.coral,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${size})`}>
    <path
      d="M 0 14 L -20 -2 Q -22 -18 -10 -22 Q 0 -28 10 -22 Q 22 -18 20 -2 Z"
      fill={color}
      stroke={C.navy}
      strokeWidth={O / size}
      strokeLinejoin="round"
    />
    {[-12, -5, 2, 9].map((dx, i) => (
      <path key={i} d={`M 0 12 L ${dx * 1.3 + 2} -18`} stroke={C.navy} strokeWidth={2 / size} strokeLinecap="round" />
    ))}
    <rect x={-6} y={10} width={12} height={7} rx={3} fill={color} stroke={C.navy} strokeWidth={O / size} />
  </g>
);

export const SLATE = { x: 1300, y: 170, w: 480, h: 320 };

export const Slate: React.FC<{ f: number; letters?: number }> = ({ f, letters = 4 }) => {
  const { x, y, w, h } = SLATE;
  const sway = 0.6 * wave(f, 0.22, 0.4);
  const rope = '#E0A65A';
  const letterRow = ['A', 'B', 'C', 'D'];
  const cols = [C.cyan, C.yellow, C.grape, C.lime];
  return (
    <g transform={`rotate(${sway} ${x + w / 2} ${y + h + 380})`}>
      {/* posts */}
      {[x + 70, x + w - 70].map((px, i) => (
        <rect key={i} x={px - 14} y={y + h - 20} width={28} height={sandTop(px) - (y + h) + 50} rx={8} fill={rope} stroke={C.navy} strokeWidth={O} />
      ))}
      {/* rope frame: navy under-stroke, rope stroke, twist dashes */}
      <rect x={x} y={y} width={w} height={h} rx={34} fill={C.cream} stroke={C.navy} strokeWidth={30 + O * 2} />
      <rect x={x} y={y} width={w} height={h} rx={34} fill={C.cream} stroke={rope} strokeWidth={30} />
      <rect x={x} y={y} width={w} height={h} rx={34} fill="none" stroke={C.navy} strokeWidth={30} strokeDasharray="3 15" opacity={0.55} />
      <rect x={x + 15 + O / 2} y={y + 15 + O / 2} width={w - 30 - O} height={h - 30 - O} rx={20} fill={C.cream} stroke={C.navy} strokeWidth={O} />
      {/* faint guide lines */}
      {[0.42, 0.74].map((t, i) => (
        <line key={i} x1={x + 50} x2={x + w - 50} y1={y + h * t} y2={y + h * t} stroke={C.sandDark} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 14" />
      ))}
      {letterRow.slice(0, letters).map((L, i) => (
        <text
          key={L}
          x={x + 92 + i * 99}
          y={y + h * 0.66}
          fontFamily={fontFamily}
          fontWeight={600}
          fontSize={118}
          textAnchor="middle"
          fill={cols[i]}
          transform={`rotate(${2.5 * wave(f, 0.5, i * 1.3)} ${x + 92 + i * 99} ${y + h * 0.5})`}
        >
          {L}
        </text>
      ))}
      <Shell x={x + 8} y={y + 8} size={1.3} rot={-35} color={C.coral} />
      <Shell x={x + w - 6} y={y + 10} size={1.15} rot={30} color={C.orange} />
      <Shell x={x + w - 4} y={y + h - 6} size={1.25} rot={150} color={C.grape} />
      <Shell x={x + 4} y={y + h - 4} size={1.05} rot={-140} color={C.cyan} />
      <Shell x={x + w / 2} y={y - 4} size={0.95} rot={0} color={C.yellow} />
    </g>
  );
};

/* ---------------- bubbles ---------------- */
export const Bubble: React.FC<{ x: number; y: number; r: number; s?: number }> = ({ x, y, r, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r={r} fill={C.bubble} fillOpacity={0.18} stroke={C.bubble} strokeWidth={Math.max(2, r * 0.18)} />
    <path d={`M ${-r * 0.55} ${-r * 0.15} Q ${-r * 0.5} ${-r * 0.55} ${-r * 0.1} ${-r * 0.6}`} stroke={C.white} strokeWidth={Math.max(2, r * 0.16)} fill="none" strokeLinecap="round" />
  </g>
);

/** Endless ambient bubbles from a few vents. Pure function of frame. */
export const AmbientBubbles: React.FC<{ f: number; seed?: number; vents: { x: number; y: number }[]; count?: number }> = ({
  f,
  seed = 3,
  vents,
  count = 18,
}) => {
  const rnd = seeded(seed);
  const items = Array.from({ length: count }, (_, i) => {
    const v = vents[i % vents.length];
    return {
      v,
      period: 90 + rnd() * 80,
      off: rnd() * 400,
      r: 6 + rnd() * 11,
      rise: 500 + rnd() * 300,
      wob: 8 + rnd() * 14,
      ph: rnd() * 6.28,
      dx: (rnd() - 0.5) * 60,
    };
  });
  return (
    <g>
      {items.map((b, i) => {
        const age = (f + b.off) % b.period;
        const p = age / b.period;
        const y = b.v.y - b.rise * Math.pow(p, 1.25); // buoyant: slight acceleration
        const x = b.v.x + b.dx * p + b.wob * Math.sin(age * 0.13 + b.ph);
        const s = p < 0.08 ? ease.out(p / 0.08) : p > 0.94 ? 1 + 0.4 * ((p - 0.94) / 0.06) : 1;
        const o = p > 0.94 ? 1 - (p - 0.94) / 0.06 : 1;
        return (
          <g key={i} opacity={o}>
            <Bubble x={x} y={y} r={b.r} s={s * (1 + 0.06 * Math.sin(age * 0.4))} />
          </g>
        );
      })}
    </g>
  );
};

/** One-shot burst of bubbles from a point, starting at frame `start`. */
export const BubbleBurst: React.FC<{ f: number; start: number; x: number; y: number; count?: number; seed?: number }> = ({
  f,
  start,
  x,
  y,
  count = 26,
  seed = 11,
}) => {
  const rnd = seeded(seed);
  const items = Array.from({ length: count }, () => ({
    delay: rnd() * 14,
    ang: -Math.PI / 2 + (rnd() - 0.5) * 1.9,
    dist: 160 + rnd() * 260,
    rise: 250 + rnd() * 380,
    r: 7 + rnd() * 16,
    life: 40 + rnd() * 35,
    ph: rnd() * 6.28,
  }));
  return (
    <g>
      {items.map((b, i) => {
        const t = f - start - b.delay;
        if (t < 0 || t > b.life) return null;
        const p = t / b.life;
        const out = ease.out(Math.min(1, t / 14));
        const bx = x + Math.cos(b.ang) * b.dist * out + 10 * Math.sin(t * 0.25 + b.ph);
        const by = y + Math.sin(b.ang) * b.dist * 0.5 * out - b.rise * Math.pow(p, 1.3);
        const s = track(t, [
          [0, 0, ease.out],
          [5, 1.2],
          [9, 1],
          [b.life - 5, 1, ease.out],
          [b.life, 1.35],
        ]);
        return (
          <g key={i} opacity={p > 0.88 ? 1 - (p - 0.88) / 0.12 : 1}>
            <Bubble x={bx} y={by} r={b.r} s={s} />
          </g>
        );
      })}
    </g>
  );
};

/** Drifting plankton specks for depth. */
export const Plankton: React.FC<{ f: number }> = ({ f }) => {
  const rnd = seeded(21);
  const items = Array.from({ length: 34 }, () => ({ x: rnd() * W, y: rnd() * 780, r: 2 + rnd() * 3, ph: rnd() * 6.28, sp: 0.1 + rnd() * 0.2 }));
  return (
    <g>
      {items.map((p, i) => (
        <circle
          key={i}
          cx={p.x + 18 * Math.sin((f / 30) * p.sp * 6.28 + p.ph)}
          cy={p.y + 10 * Math.sin((f / 30) * p.sp * 4.1 + p.ph * 1.3)}
          r={p.r}
          fill={C.bubble}
          opacity={0.35}
        />
      ))}
    </g>
  );
};

export const GroundShadow: React.FC<{ x: number; y: number; w: number; s?: number }> = ({ x, y, w, s = 1 }) => (
  <ellipse cx={x} cy={y} rx={(w / 2) * s} ry={14 * s} fill={C.sandDark} />
);
