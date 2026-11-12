import React from 'react';
import { C, TONES } from '../theme';
import { darken, lighten } from '../lib/color';
import { breathe, ease, seeded, track, wave } from '../lib/motion';
import { fontFamily } from '../fonts';

export const W = 1920;
export const H = 1080;
/** The wide-shot world is wider than the frame; the camera pans across it. */
export const WORLD_W = 2400;

export const sandTop = (x: number) => 852 + 14 * Math.sin(x / 330 + 0.6);

/* ---------------- backdrop ---------------- */
export const Backdrop: React.FC<{ f: number }> = ({ f }) => {
  // flat far-reef silhouettes
  const hills =
    'M -40 900 L -40 770 Q 80 700 200 760 Q 300 690 430 750 Q 560 700 650 770 Q 760 720 900 790 ' +
    'Q 1040 730 1150 780 Q 1280 700 1400 760 Q 1520 690 1660 750 Q 1800 700 1960 770 ' +
    'Q 2100 710 2230 760 Q 2360 700 2520 770 Q 2600 740 2680 780 L 2680 900 Z';
  // light shafts (flat, low-opacity cream)
  const shafts = [
    { x: 260, w: 140, a: -14, ph: 0 },
    { x: 760, w: 90, a: -11, ph: 1.8 },
    { x: 1180, w: 160, a: -13, ph: 3.1 },
    { x: 1660, w: 100, a: -10, ph: 4.4 },
    { x: 2120, w: 150, a: -12, ph: 5.3 },
  ];
  return (
    <g>
      <rect x={-200} y={-200} width={WORLD_W + 400} height={H + 400} fill={C.water} />
      {shafts.map((s, i) => (
        <g key={i} transform={`rotate(${s.a + 1.6 * wave(f, 0.18, s.ph)} ${s.x} -40)`}>
          <polygon
            points={`${s.x - s.w / 2},-60 ${s.x + s.w / 2},-60 ${s.x + s.w * 1.4},900 ${s.x - s.w * 0.4},900`}
            fill={C.shaft}
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
    for (let x = -60; x < WORLD_W + 240; x += 110) {
      const y0 = sandTop(x) + offset;
      const y1 = sandTop(x + 110) + offset;
      d += ` Q ${x + 55} ${(y0 + y1) / 2 - 22} ${x + 110} ${y1}`;
    }
    return d + ` L ${WORLD_W + 240} ${H + 60} Z`;
  };
  const rnd = seeded(7);
  const specks = Array.from({ length: 90 }, () => ({ x: rnd() * WORLD_W, y: 890 + rnd() * 190, r: 3 + rnd() * 5 }));
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
}> = ({ f, x, height, width = 34, phase = 0, color = C.kelp, dark = C.kelpDark }) => {
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
  const mid = pts.map((p) => [p.x - Math.sin(p.a) * p.w * 0.08, p.y + Math.cos(p.a) * p.w * 0.08]);
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
  const capTo = (arr: number[][]) => ` Q ${tip.x + Math.cos(tip.a) * 26} ${tip.y + Math.sin(tip.a) * 26} ${arr[M][0]} ${arr[M][1]}`;
  const d = toD(left) + capTo(right) + toD(right.slice().reverse()).replace(/^M/, ' L') + ' Z';
  // shaded half: from the midline to the right edge, darker tone of the same green
  const shade = toD(mid) + capTo(right) + toD(right.slice().reverse()).replace(/^M/, ' L') + ' Z';
  const leaves = [3, 5, 7, 9, 11].map((j, k) => {
    const p = pts[j];
    const side = k % 2 === 0 ? 1 : -1;
    const flutter = 10 * Math.sin((f / 30) * Math.PI * 2 * 0.6 - j * 0.5 + phase);
    const ang = (p.a * 180) / Math.PI + side * (55 + flutter);
    return (
      <g key={j} transform={`translate(${p.x} ${p.y}) rotate(${ang})`}>
        <path d={`M 0 0 Q 22 -16 ${44 - k * 3} 0 Q 22 14 0 0 Z`} fill={dark} />
      </g>
    );
  });
  return (
    <g>
      {leaves}
      <path d={d} fill={color} />
      <path d={shade} fill={dark} />
    </g>
  );
};

/* ---------------- coral ---------------- */
/** Solid tube along a quadratic curve, built from filled circles (no strokes). */
const tube = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, r: number, fill: string, key: string, dx = 0, dy = 0) => {
  const out: React.ReactNode[] = [];
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    out.push(<circle key={`${key}-${k}`} cx={px + dx} cy={py + dy} r={r} fill={fill} />);
  }
  return out;
};

export const BranchCoral: React.FC<{ f: number; x: number; scale?: number; color?: string; phase?: number }> = ({
  f,
  x,
  scale = 1,
  color = C.orange,
  phase = 0,
}) => {
  const y = sandTop(x) + 20;
  const r = 2.2 * wave(f, 0.35, phase);
  // muted for the set so the characters stay the warmest things on screen
  const base = darken(color, 0.08);
  const dark = darken(color, 0.25);
  const light = lighten(color, 0.3);
  const branches: [number, number, number, number, number, number][] = [
    [0, 0, -4, -60, -2, -120],
    [-2, -60, -40, -80, -46, -128],
    [-2, -90, 30, -110, 40, -160],
    [18, -112, 52, -118, 64, -100],
    [-30, -100, -66, -96, -72, -70],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${r})`}>
      {branches.map((b, i) => tube(...b, 11, dark, `d${i}`, 4, 3))}
      {branches.map((b, i) => tube(...b, 11, base, `b${i}`))}
      {branches.map((b, i) => (
        <circle key={`t${i}`} cx={b[4] - 3} cy={b[5] - 2} r={4.5} fill={light} />
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
  const base = darken(color, 0.08);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * (2 - s)} ${scale * s})`}>
      {balls.map(([bx, by, r], i) => (
        <circle key={`d${i}`} cx={bx + 3} cy={by + 5} r={r} fill={darken(color, 0.26)} />
      ))}
      {balls.map(([bx, by, r], i) => (
        <g key={`f${i}`}>
          <circle cx={bx} cy={by} r={r} fill={base} />
          <circle cx={bx - r * 0.3} cy={by - r * 0.35} r={r * 0.22} fill={lighten(color, 0.3)} />
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
}) => {
  const dark = darken(color, 0.2);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${size})`}>
      <path d="M 0 14 L -20 -2 Q -22 -18 -10 -22 Q 0 -28 10 -22 Q 22 -18 20 -2 Z" fill={color} />
      {/* ridges as thin darker wedges */}
      {[-14, -5, 4, 13].map((dx, i) => (
        <path key={i} d={`M 0 12 L ${dx - 2} -20 L ${dx + 2} -20 Z`} fill={dark} />
      ))}
      <ellipse cx={-7} cy={-17} rx={4} ry={2.4} fill={lighten(color, 0.45)} />
      <rect x={-7} y={10} width={14} height={7} rx={3} fill={dark} />
    </g>
  );
};

export const SLATE = { x: 1800, y: 150, w: 540, h: 360 };

/** Text with a darker same-hue "thickness" offset, an optional soft shadow and a clipped glint. */
export const ChunkyText: React.FC<{
  text: string;
  x: number;
  y: number;
  size: number;
  base: string;
  dark: string;
  light: string;
  depth: number;
  glint?: [number, number, number, number]; // relative to the em size: cx, cy, rx, ry
  id: string;
  shadow?: boolean;
}> = ({ text, x, y, size, base, dark, light, depth, glint, id, shadow }) => (
  <g fontFamily={fontFamily} fontWeight={600} fontSize={size} textAnchor="middle">
    {shadow ? (
      <text x={x} y={y + depth + size * 0.035} fill={C.navy} opacity={0.18} filter="url(#softShadow)">
        {text}
      </text>
    ) : null}
    <text x={x} y={y + depth} fill={dark}>
      {text}
    </text>
    <text x={x} y={y} fill={base}>
      {text}
    </text>
    {glint ? (
      <>
        <clipPath id={id}>
          <text x={x} y={y}>
            {text}
          </text>
        </clipPath>
        <ellipse
          cx={x + glint[0] * size}
          cy={y + glint[1] * size}
          rx={glint[2] * size}
          ry={glint[3] * size}
          transform={`rotate(-28 ${x + glint[0] * size} ${y + glint[1] * size})`}
          fill={light}
          clipPath={`url(#${id})`}
        />
      </>
    ) : null}
  </g>
);

/** Glint positions per letter (fractions of the font size, relative to centre-baseline). */
export const GLINT: Record<string, [number, number, number, number]> = {
  A: [-0.07, -0.58, 0.035, 0.11],
  B: [-0.17, -0.55, 0.03, 0.1],
  C: [-0.21, -0.5, 0.03, 0.1],
  D: [-0.18, -0.55, 0.03, 0.1],
};

export const Slate: React.FC<{ f: number; letters?: number }> = ({ f, letters = 4 }) => {
  const { x, y, w, h } = SLATE;
  const sway = 0.6 * wave(f, 0.22, 0.4);
  const letterRow = ['A', 'B', 'C', 'D'];
  const tones = [TONES.cyan, TONES.yellow, TONES.grape, TONES.lime];
  const fr = 15; // rope half-thickness
  const marks: React.ReactNode[] = [];
  for (let px = x + 30; px < x + w - 24; px += 20) {
    marks.push(<rect key={`t${px}`} x={px} y={y - fr} width={6} height={fr * 2} rx={3} fill={C.ropeDark} transform={`skewX(-28)`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />);
    marks.push(<rect key={`b${px}`} x={px} y={y + h - fr} width={6} height={fr * 2} rx={3} fill={C.ropeDark} transform={`skewX(-28)`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />);
  }
  for (let py = y + 30; py < y + h - 24; py += 20) {
    marks.push(<rect key={`l${py}`} x={x - fr} y={py} width={fr * 2} height={6} rx={3} fill={C.ropeDark} transform={`skewY(-28)`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />);
    marks.push(<rect key={`r${py}`} x={x + w - fr} y={py} width={fr * 2} height={6} rx={3} fill={C.ropeDark} transform={`skewY(-28)`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />);
  }
  return (
    <g transform={`rotate(${sway} ${x + w / 2} ${y + h + 380})`}>
      {/* posts: base, darker right side */}
      {[x + 70, x + w - 70].map((px, i) => {
        const ph = sandTop(px) - (y + h) + 50;
        return (
          <g key={i}>
            <rect x={px - 15} y={y + h - 20} width={30} height={ph} rx={8} fill={C.rope} />
            <rect x={px + 3} y={y + h - 20} width={12} height={ph} rx={6} fill={C.ropeDark} />
          </g>
        );
      })}
      {/* rope frame: darker underside, base, lighter top edge, twist marks */}
      <rect x={x - fr} y={y - fr + 6} width={w + fr * 2} height={h + fr * 2} rx={40} fill={C.ropeDark} />
      <rect x={x - fr} y={y - fr} width={w + fr * 2} height={h + fr * 2} rx={40} fill={C.rope} />
      <rect x={x + 20} y={y - fr + 3} width={w - 40} height={6} rx={3} fill={C.ropeLight} />
      {marks}
      {/* board: cream, with a darker band under the top rope (inner shade) */}
      <rect x={x + fr} y={y + fr} width={w - fr * 2} height={h - fr * 2} rx={22} fill={C.cream} />
      <rect x={x + fr} y={y + fr} width={w - fr * 2} height={14} rx={7} fill={C.creamDark} />
      {/* faint guide dots */}
      {[0.42, 0.74].map((t, i) =>
        Array.from({ length: 26 }, (_, k) => (
          <circle key={`${i}-${k}`} cx={x + 50 + k * ((w - 100) / 25)} cy={y + h * t} r={2.4} fill={C.creamDark} />
        )),
      )}
      {letterRow.slice(0, letters).map((L, i) => {
        const lx = x + w * 0.19 + i * w * 0.206;
        return (
          <g key={L} transform={`rotate(${2.5 * wave(f, 0.5, i * 1.3)} ${lx} ${y + h * 0.5})`}>
            <ChunkyText
              text={L}
              x={lx}
              y={y + h * 0.66}
              size={118 * (w / 480)}
              base={tones[i].base}
              dark={tones[i].dark}
              light={tones[i].light}
              depth={4}
              glint={GLINT[L]}
              id={`slate-glint-${L}`}
            />
          </g>
        );
      })}
      <Shell x={x + 8} y={y + 8} size={1.3} rot={-35} color={C.coral} />
      <Shell x={x + w - 6} y={y + 10} size={1.15} rot={30} color={C.orange} />
      <Shell x={x + w - 4} y={y + h - 6} size={1.25} rot={150} color={C.grape} />
      <Shell x={x + 4} y={y + h - 4} size={1.05} rot={-140} color={C.cyan} />
      <Shell x={x + w / 2} y={y - 4} size={0.95} rot={0} color={C.yellow} />
    </g>
  );
};

/* ---------------- bubbles ---------------- */
/** Bubble without outline: pale disc, a darker lower crescent and a white shine. */
export const Bubble: React.FC<{ x: number; y: number; r: number; s?: number }> = ({ x, y, r, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r={r} fill={C.bubble} fillOpacity={0.42} />
    <path d={`M ${-r * 0.8} ${r * 0.2} A ${r * 0.85} ${r * 0.85} 0 0 0 ${r * 0.8} ${r * 0.2} A ${r} ${r} 0 0 1 ${-r * 0.8} ${r * 0.2} Z`} fill={C.bubble} fillOpacity={0.5} />
    <ellipse cx={-r * 0.36} cy={-r * 0.4} rx={r * 0.28} ry={r * 0.18} transform={`rotate(-35 ${-r * 0.36} ${-r * 0.4})`} fill={C.white} />
    <circle cx={r * 0.38} cy={-r * 0.05} r={Math.max(1.2, r * 0.09)} fill={C.white} fillOpacity={0.85} />
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
  const items = Array.from({ length: 44 }, () => ({ x: rnd() * WORLD_W, y: rnd() * 780, r: 2 + rnd() * 3, ph: rnd() * 6.28, sp: 0.1 + rnd() * 0.2 }));
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
