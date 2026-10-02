import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useFonts, INTER, MONO } from "../../lib/fonts";
import { makeRand } from "../../lib/random";
import { TAU, clamp, mod, phase, smoothstep, wave } from "../../lib/loop";
import type { OverlayPalette } from "../../versions";

// A financial HUD meant to be screen/add-blended over footage. Pure black
// background, no grain. Every motion is periodic over 600 frames.

const LOOP = 600;
const rand = makeRand(3993);

// ---------- periodic candle data (period P candles) ----------
const P = 48;
const HARM = Array.from({ length: 5 }, (_, k) => ({ a: rand.range(0.05, 0.18) / (k + 1), ph: rand.next() }));
const candleVal = (j: number) =>
  0.5 + HARM.reduce((s, h, k) => s + h.a * Math.sin(TAU * ((k + 1) * j / P + h.ph)), 0);
const RAW = Array.from({ length: P + 1 }, (_, j) => candleVal(j));
const MIN = Math.min(...RAW);
const MAX = Math.max(...RAW);
const norm = (v: number) => 0.12 + (0.76 * (v - MIN)) / (MAX - MIN);
const CANDLES = Array.from({ length: P }, (_, j) => {
  const o = norm(RAW[j]);
  const c = norm(RAW[j + 1]);
  return { o, c, hi: Math.max(o, c) + rand.range(0.01, 0.05), lo: Math.min(o, c) - rand.range(0.01, 0.05) };
});

const NUMBERS = Array.from({ length: 12 }, (_, i) => {
  const period = rand.pick([60, 75, 100, 120, 150]);
  const slots = LOOP / period;
  let v = rand.range(0.2, 9.5);
  const values = Array.from({ length: slots }, () => {
    v = Math.max(0.05, v + rand.range(-0.35, 0.35));
    return v;
  });
  return {
    x: [2380, 2900, 3330, 1720, 3120, 1950, 3450, 3080, 1620, 1880, 3250, 2150][i],
    y: [760, 640, 900, 1250, 1300, 1500, 1120, 1700, 1980, 1760, 2020, 2040][i],
    size: rand.range(46, 96),
    period,
    offset: rand.int(0, period),
    values,
    digits: rand.next() < 0.4 ? 1 : 2,
    white: rand.next() < 0.45,
  };
});

const CODES = ["IDX-01", "SEC-A", "FND-7", "IDX-14", "SEC-K", "FND-2", "IDX-09"];
const LIST = CODES.map((code) => ({
  code,
  base: rand.range(5, 45),
  amp: rand.range(0.5, 4),
  c: rand.int(1, 4),
  ph: rand.next(),
}));

const BARS = Array.from({ length: 11 }, () => ({ base: rand.range(0.35, 1), c: rand.int(1, 4), ph: rand.next() }));

const lineData = (n: number, seed: number) => {
  const r = makeRand(seed);
  let v = 0.5;
  return Array.from({ length: n }, () => {
    v = clamp(v + r.range(-0.18, 0.18), 0.05, 0.95);
    return v;
  });
};
const RED_LINE = lineData(70, 11);
const GREEN_LINE = lineData(70, 12);
const BLUE_LINE = lineData(60, 13);

// ---------- pieces ----------

const fmt = (v: number, d: number) => v.toFixed(d);

const CandleChart: React.FC<{ frame: number; pal: OverlayPalette }> = ({ frame, pal }) => {
  const W = 1900;
  const H = 1000;
  const step = 58;
  // scroll exactly one data repeat (P candles) per loop
  const shift = (frame / LOOP) * P * step;
  const first = Math.floor(shift / step);
  const items: React.ReactNode[] = [];
  const Y = (v: number) => H - v * H;
  for (let k = -1; k < W / step + 2; k++) {
    const j = first + k;
    const cd = CANDLES[mod(j, P)];
    const x = j * step - shift + 20;
    const up = cd.c >= cd.o;
    const top = Y(Math.max(cd.o, cd.c));
    const bh = Math.max(4, Math.abs(Y(cd.o) - Y(cd.c)));
    items.push(
      <g key={j} opacity={x < 120 ? clamp(x / 120) : x > W - 200 ? clamp((W - x) / 200) : 1}>
        <line x1={x} x2={x} y1={Y(cd.hi)} y2={Y(cd.lo)} stroke={pal.main} strokeWidth={3.5} opacity={0.8} />
        <rect x={x - 13} y={top} width={26} height={bh} fill={up ? pal.main : "none"} stroke={pal.main} strokeWidth={3} />
      </g>,
    );
  }
  return (
    <svg width={W} height={H} style={{ position: "absolute", overflow: "visible" }}>
      {items}
    </svg>
  );
};

const GuideLines: React.FC<{ frame: number; pal: OverlayPalette }> = ({ frame, pal }) => (
  <svg width={2400} height={1300} style={{ position: "absolute", overflow: "visible" }}>
    {Array.from({ length: 7 }, (_, i) => {
      const y = 60 + i * 180;
      const label = (3.2 - i * 0.25 + 0.04 * wave(frame, LOOP, 2, i * 0.13)).toFixed(2);
      return (
        <g key={i}>
          <line x1={0} x2={2200} y1={y} y2={y} stroke={pal.white} strokeOpacity={0.55} strokeWidth={2.5} strokeDasharray="14 12" strokeDashoffset={-(phase(frame, LOOP, 4) * 26 * 10)} />
          <text x={2220} y={y + 12} fill={pal.white} fillOpacity={0.8} fontFamily={INTER} fontSize={34}>
            {label}
          </text>
        </g>
      );
    })}
  </svg>
);

const FloatingNumbers: React.FC<{ frame: number; pal: OverlayPalette }> = ({ frame, pal }) => (
  <>
    {NUMBERS.map((n, i) => {
      const t = frame + n.offset;
      const slots = n.values.length;
      const k = mod(Math.floor(t / n.period), slots);
      const v = n.values[k];
      const prev = n.values[mod(k - 1, slots)];
      const up = v >= prev;
      const u = mod(t, n.period);
      const flash = 1 - smoothstep(0, 14, u);
      const color = n.white ? pal.white : pal.main;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: n.x,
            top: n.y + 8 * wave(frame, LOOP, 1, i * 0.17),
            fontFamily: INTER,
            fontWeight: 500,
            fontSize: n.size,
            color,
            opacity: 0.88,
            display: "flex",
            alignItems: "center",
            gap: n.size * 0.25,
            textShadow: `0 0 ${10 + 20 * flash}px ${color}`,
          }}
        >
          <svg width={n.size * 0.5} height={n.size * 0.45} viewBox="0 0 20 18">
            {up ? (
              <path d="M10 2 L18 16 L2 16 Z" fill="none" stroke={pal.up} strokeWidth={2.4} />
            ) : (
              <path d="M2 2 L18 2 L10 16 Z" fill="none" stroke={n.white ? pal.light : pal.down} strokeWidth={2.4} />
            )}
          </svg>
          {fmt(v, n.digits)}
        </div>
      );
    })}
  </>
);

const BarStack: React.FC<{ frame: number; pal: OverlayPalette }> = ({ frame, pal }) => (
  <svg width={760} height={760} style={{ position: "absolute", overflow: "visible" }}>
    {BARS.map((b, i) => {
      const w = 700 * b.base * (0.55 + 0.45 * wave(frame, LOOP, b.c, b.ph));
      return (
        <g key={i}>
          <rect x={0} y={i * 66} width={700} height={44} fill={pal.light} fillOpacity={0.08} />
          <rect x={0} y={i * 66} width={w} height={44} fill={i % 3 === 0 ? pal.light : pal.main} fillOpacity={0.72} />
        </g>
      );
    })}
  </svg>
);

const Ring: React.FC<{ r: number; frame: number; c: number; arc: number; color: string; w: number; dir: number }> = ({ r, frame, c, arc, color, w, dir }) => {
  const circ = TAU * r;
  return (
    <circle
      r={r}
      cx={0}
      cy={0}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeDasharray={`${circ * arc} ${circ}`}
      transform={`rotate(${dir * 360 * phase(frame, LOOP, c)})`}
      strokeLinecap="round"
    />
  );
};

const Gauges: React.FC<{ frame: number; pal: OverlayPalette }> = ({ frame, pal }) => (
  <svg width={900} height={500} style={{ position: "absolute", overflow: "visible" }}>
    <g transform="translate(220 230)" opacity={0.85}>
      <Ring r={190} frame={frame} c={1} arc={0.62} color={pal.main} w={8} dir={1} />
      <Ring r={160} frame={frame} c={2} arc={0.35} color={pal.white} w={3} dir={-1} />
      <Ring r={130} frame={frame} c={1} arc={0.8} color={pal.light} w={2} dir={1} />
      <text x={0} y={18} textAnchor="middle" fill={pal.white} fontFamily={INTER} fontSize={52}>
        {(62 + 9 * wave(frame, LOOP, 1)).toFixed(1)}%
      </text>
    </g>
    <g transform="translate(640 280)" opacity={0.75}>
      <Ring r={120} frame={frame} c={3} arc={0.45} color={pal.main} w={6} dir={-1} />
      <Ring r={96} frame={frame} c={1} arc={0.7} color={pal.white} w={2} dir={1} />
      <text x={0} y={14} textAnchor="middle" fill={pal.main} fontFamily={INTER} fontSize={38}>
        {(2.01 + 0.4 * wave(frame, LOOP, 2, 0.3)).toFixed(2)}%
      </text>
    </g>
  </svg>
);

const CodeList: React.FC<{ frame: number; pal: OverlayPalette }> = ({ frame, pal }) => (
  <div style={{ position: "absolute", fontFamily: MONO, fontSize: 36, lineHeight: 1.7, color: pal.white }}>
    {LIST.map((l, i) => {
      const v = l.base + l.amp * wave(frame, LOOP, l.c, l.ph);
      const up = Math.cos(TAU * ((frame * l.c) / LOOP + l.ph)) >= 0;
      return (
        <div key={l.code} style={{ display: "flex", alignItems: "center", gap: 22, opacity: 0.85 }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, background: up ? pal.up : pal.down, boxShadow: `0 0 10px ${up ? pal.up : pal.down}` }} />
          <span style={{ width: 190 }}>{l.code}</span>
          <span style={{ color: i % 2 ? pal.main : pal.light }}>{v.toFixed(2)}%</span>
        </div>
      );
    })}
  </div>
);

const DrawLine: React.FC<{ frame: number; data: number[]; color: string; offset: number; w: number; h: number }> = ({ frame, data, color, offset, w, h }) => {
  // draw in 0-120, hold to 230, fade 230-280, empty to 300 (2 cycles per loop)
  const u = mod(frame + offset, 300);
  const prog = smoothstep(0, 120, u);
  const op = 1 - smoothstep(230, 280, u);
  const n = data.length;
  const pts = data.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${((1 - v) * h).toFixed(1)}`).join(" ");
  const len = w * 2.6;
  return (
    <polyline
      points={pts}
      fill="none"
      stroke={color}
      strokeWidth={4}
      strokeLinejoin="round"
      strokeDasharray={`${len} ${len}`}
      strokeDashoffset={len * (1 - prog)}
      opacity={op * 0.9}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
    />
  );
};

const Panel: React.FC<{ x: number; y: number; w: number; h: number; color: string; o?: number }> = ({ x, y, w, h, color, o = 0.4 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, border: `2px solid ${color}`, opacity: o }} />
);

export const FinanceOverlay: React.FC<{ palette: OverlayPalette }> = ({ palette: pal }) => {
  const frame = useCurrentFrame();
  const fonts = useFonts();
  if (!fonts) return <AbsoluteFill style={{ background: "#000" }} />;
  // key={frame}: rebuild the DOM every frame so Chromium rasterises it from
  // scratch. Otherwise tiles kept from earlier frames can anti-alias edges a
  // little differently from a cold render of the same frame.
  return (
    <AbsoluteFill key={frame} style={{ background: "#000", overflow: "hidden" }}>
      {/* left group: tilted candle chart + guides */}
      <div style={{ position: "absolute", inset: 0, perspective: 2600 }}>
        <div style={{ position: "absolute", left: 140, top: 300, transform: "rotateY(24deg) rotateX(4deg)", transformOrigin: "0 50%" }}>
          <Panel x={-40} y={-60} w={2000} h={1140} color={pal.light} o={0.28} />
          <GuideLines frame={frame} pal={pal} />
          <div style={{ position: "absolute", left: 40, top: 80 }}>
            <CandleChart frame={frame} pal={pal} />
          </div>
        </div>
        {/* right group: tilted the other way */}
        <div style={{ position: "absolute", left: 2250, top: 200, transform: "rotateY(-18deg)", transformOrigin: "100% 50%" }}>
          <Panel x={0} y={0} w={1450} h={1650} color={pal.main} o={0.25} />
          <Panel x={60} y={1080} w={820} h={520} color={pal.light} o={0.3} />
          <div style={{ position: "absolute", left: 100, top: 1120 }}>
            <BarStack frame={frame} pal={pal} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1500, top: 60 }}>
        <Gauges frame={frame} pal={pal} />
      </div>
      <div style={{ position: "absolute", left: 2480, top: 120 }}>
        <Panel x={-30} y={-20} w={560} h={470} color={pal.white} o={0.22} />
        <CodeList frame={frame} pal={pal} />
      </div>
      <FloatingNumbers frame={frame} pal={pal} />
      {/* bottom line charts */}
      <svg width={3840} height={2160} style={{ position: "absolute", inset: 0 }}>
        <g transform="translate(160 1640)">
          <DrawLine frame={frame} data={RED_LINE} color={pal.down} offset={0} w={1300} h={380} />
          <DrawLine frame={frame} data={GREEN_LINE} color={pal.up} offset={60} w={1300} h={380} />
          <DrawLine frame={frame} data={BLUE_LINE} color={pal.light} offset={150} w={1300} h={380} />
        </g>
        <text x={170} y={2090} fill={pal.white} fillOpacity={0.6} fontFamily={MONO} fontSize={30}>
          SEC-A / FND-7 · {(7.12 + 0.3 * wave(frame, LOOP, 3)).toFixed(2)}%
        </text>
      </svg>
    </AbsoluteFill>
  );
};
