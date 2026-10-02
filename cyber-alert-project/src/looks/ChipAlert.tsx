import React from "react";
import { AbsoluteFill } from "remotion";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { osc, saw, useLoopFrame, useUnits } from "../lib/loop";
import { mulberry32, range } from "../lib/random";
import type { ChipPalette } from "./palettes";

// ---------------------------------------------------------------------------
// Board geometry, generated once at module level (seeded).
// Board space is BW x BH units. The board is a flat plane tilted with CSS 3D.
// ---------------------------------------------------------------------------
const BW = 3400;
const BH = 2700;
const CX = BW / 2;
const CY = BH / 2;

type Pt = [number, number];
type Trace = { pts: Pt[]; len: number; w: number; bright: boolean; pad: number };

const lenOf = (pts: Pt[]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};
const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");

// Nested rounded rectangles of the chip: [w, h, rx, stroke, brightness 0..1]
const RINGS: [number, number, number, number, number][] = [
  [1360, 1380, 70, 5, 0.6],
  [1290, 1310, 60, 12, 1],
  [1190, 1205, 48, 4, 0.5],
  [1120, 1135, 40, 4, 0.65],
  [960, 970, 36, 11, 0.95],
  [880, 885, 30, 4, 0.55],
  [800, 800, 26, 3, 0.5],
];
const DIE_W = 700;
const DIE_H = 700;
// Thin broken outlines with notched (chamfered) corners between the rings.
const NOTCHED: [number, number, number][] = [
  [1240, 1258, 40],
  [1050, 1060, 34],
  [740, 742, 24],
];
const WALL = 7; // stacked copies that build the raised walls of the bright rings
const WALL_STEP = 9; // board units per copy

const rng = mulberry32(0xc41f);

// Comb of short contacts between ring 1 and ring 2 (the "pins").
const combs: { x: number; y: number; w: number; h: number }[] = [];
{
  const [w1, h1] = RINGS[1];
  const [w2, h2] = RINGS[3];
  const gx = (w1 - w2) / 2;
  const gy = (h1 - h2) / 2;
  const N = 22;
  for (let i = 0; i < N; i++) {
    const tx = CX - w2 / 2 + 40 + ((w2 - 80) * (i + 0.5)) / N;
    const ty = CY - h2 / 2 + 40 + ((h2 - 80) * (i + 0.5)) / N;
    const l = gy * 0.55;
    combs.push({ x: tx - 5, y: CY - h1 / 2 + (gy - l) / 2, w: 10, h: l });
    combs.push({ x: tx - 5, y: CY + h2 / 2 + (gy - l) / 2, w: 10, h: l });
    const lx = gx * 0.55;
    combs.push({ x: CX - w1 / 2 + (gx - lx) / 2, y: ty - 5, w: lx, h: 10 });
    combs.push({ x: CX + w2 / 2 + (gx - lx) / 2, y: ty - 5, w: lx, h: 10 });
  }
}

// Traces leaving every side of the package: straight, 45 deg jog, straight, pad.
const traces: Trace[] = [];
const PKG_W = RINGS[0][0];
const PKG_H = RINGS[0][1];
for (let side = 0; side < 4; side++) {
  const horizontal = side === 0 || side === 2;
  const n = horizontal ? 16 : 20;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const out: Pt = [[1, 0, -1, 0][side], [0, 1, 0, -1][side]];
    const tan: Pt = [-out[1], out[0]];
    const along = t * (horizontal ? PKG_H - 160 : PKG_W - 160);
    const half = horizontal ? PKG_W / 2 : PKG_H / 2;
    const start: Pt = [CX + out[0] * (half + 6) + tan[0] * along, CY + out[1] * (half + 6) + tan[1] * along];
    const l1 = range(rng, 30, 140);
    const jog = Math.sign(t || 0.01) * range(rng, 20, 120) * (rng() < 0.3 ? 0 : 1);
    const l3 = range(rng, 120, 600);
    const p1: Pt = [start[0] + out[0] * l1, start[1] + out[1] * l1];
    const p2: Pt = [p1[0] + out[0] * Math.abs(jog) + tan[0] * jog, p1[1] + out[1] * Math.abs(jog) + tan[1] * jog];
    const p3: Pt = [p2[0] + out[0] * l3, p2[1] + out[1] * l3];
    traces.push({ pts: [start, p1, p2, p3], len: 0, w: range(rng, 4, 7), bright: rng() < 0.35, pad: range(rng, 8, 13) });
  }
}
for (const t of traces) t.len = lenOf(t.pts);

// Filler traces and component clusters out on the board.
const filler: Trace[] = [];
for (let i = 0; i < 120; i++) {
  let x = range(rng, 0, BW);
  let y = range(rng, 0, BH);
  if (Math.abs(x - CX) < PKG_W * 0.6 && Math.abs(y - CY) < PKG_H * 0.6) continue;
  const pts: Pt[] = [[x, y]];
  const dirs: Pt[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const d = Math.floor(rng() * 4);
  for (let s = 0; s < 3; s++) {
    const L = range(rng, 40, 220);
    if (s === 1) {
      const b = dirs[(d + (rng() < 0.5 ? 1 : 3)) % 4];
      x += (dirs[d][0] + b[0]) * L * 0.5;
      y += (dirs[d][1] + b[1]) * L * 0.5;
    } else {
      x += dirs[d][0] * L;
      y += dirs[d][1] * L;
    }
    pts.push([x, y]);
  }
  filler.push({ pts, len: lenOf(pts), w: range(rng, 3, 5), bright: rng() < 0.2, pad: range(rng, 6, 10) });
}

// Component blocks: columns along the package's left/right, plus scattered.
const parts: { x: number; y: number; w: number; h: number; bright: boolean }[] = [];
for (const sx of [-1, 1]) {
  for (let i = 0; i < 44; i++) {
    const x = CX + sx * (PKG_W / 2 + range(rng, 60, 340));
    const y = CY + range(rng, -PKG_H / 2, PKG_H / 2);
    parts.push({ x, y, w: range(rng, 18, 46), h: range(rng, 10, 26), bright: rng() < 0.6 });
  }
}
for (let i = 0; i < 420; i++) {
  const x = range(rng, 60, BW - 60);
  const y = range(rng, 60, BH - 60);
  if (Math.abs(x - CX) < PKG_W * 0.55 && Math.abs(y - CY) < PKG_H * 0.55) continue;
  parts.push({ x, y, w: range(rng, 20, 60), h: range(rng, 12, 34), bright: rng() < 0.4 });
}
// Pin columns rising toward the triangle from the near (bottom) side.
const pinCols: { x: number; y: number; w: number; h: number }[] = [];
for (let i = 0; i < 26; i++) {
  const x = CX + (i - 12.5) * 22 + range(rng, -3, 3);
  const h = range(rng, 90, 320);
  pinCols.push({ x: x - 6, y: CY + RINGS[0][1] / 2 + 20, w: 12, h });
  pinCols.push({ x: x - 5, y: CY + DIE_H / 2 + 30 + range(rng, 0, 40), w: 10, h: range(rng, 40, 120) });
}
// Dense rows of small pads just outside the package on every side.
const padRows: { x: number; y: number; s: number }[] = [];
for (let row = 0; row < 3; row++) {
  const off = RINGS[0][0] / 2 + 40 + row * 34;
  for (let i = 0; i < 46; i++) {
    const t = -0.5 + (i + 0.5) / 46;
    if (rng() < 0.25) continue;
    padRows.push({ x: CX + t * RINGS[0][0], y: CY - off, s: 14 });
    padRows.push({ x: CX + t * RINGS[0][0], y: CY + off, s: 14 });
    padRows.push({ x: CX - off, y: CY + t * RINGS[0][1], s: 14 });
    padRows.push({ x: CX + off, y: CY + t * RINGS[0][1], s: 14 });
  }
}
// Near-white sparkles (specular hot spots), mostly in the defocused areas.
const sparkles = Array.from({ length: 90 }, () => ({ x: range(rng, 0, BW), y: range(rng, 0, BH), r: range(rng, 4, 9) })).filter(
  (d) => Math.abs(d.y - CY) > 380 || Math.abs(d.x - CX) > 900,
);
// Bright dots (become bokeh once blurred).
const dots = Array.from({ length: 520 }, () => ({ x: range(rng, 0, BW), y: range(rng, 0, BH), r: range(rng, 6, 17) })).filter(
  (d) => !(Math.abs(d.x - CX) < PKG_W * 0.5 && Math.abs(d.y - CY) < PKG_H * 0.5),
);

// Light pulses along chip traces, inward or outward, whole cycles per loop.
const pulses = traces.filter(() => rng() < 0.28).map((t) => ({
  t,
  inward: rng() < 0.5,
  cycles: [2, 3, 4][Math.floor(rng() * 3)],
  offset: rng(),
  dash: range(rng, 70, 140),
}));

// Two-pass neon line: wide faint halo + bright core (no filter, cheap).
const Neon: React.FC<{ d: string; c: string; w: number; a?: number }> = ({ d, c, w, a = 1 }) => (
  <>
    <path d={d} stroke={c} strokeWidth={w * 3.2} strokeOpacity={0.16 * a} />
    <path d={d} stroke={c} strokeWidth={w} strokeOpacity={a} />
  </>
);
const rr = (w: number, h: number, r: number) => {
  const x = CX - w / 2;
  const y = CY - h / 2;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
};

const notched = (w: number, h: number, c: number) => {
  const x = CX - w / 2;
  const y = CY - h / 2;
  return `M${x + c} ${y}H${x + w - c}L${x + w} ${y + c}V${y + h - c}L${x + w - c} ${y + h}H${x + c}L${x} ${y + h - c}V${y + c}Z`;
};

const Board: React.FC<{ p: ChipPalette; f: number; id: string }> = ({ p, f, id }) => (
  <svg viewBox={`0 0 ${BW} ${BH}`} width="100%" height="100%" style={{ display: "block" }}>
    <defs>
      <radialGradient id={`bd-${id}`} cx="50%" cy="50%" r="65%">
        <stop offset="0%" stopColor={p.bgCenter} />
        <stop offset="100%" stopColor={p.board} />
      </radialGradient>
    </defs>
    <rect width={BW} height={BH} fill={`url(#bd-${id})`} />
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {filler.map((t, i) => (
        <Neon key={i} d={toD(t.pts)} c={t.bright ? p.traceBright : p.trace} w={t.w * 0.6} a={t.bright ? 0.4 : 0.45} />
      ))}
      {traces.map((t, i) => (
        <Neon key={i} d={toD(t.pts)} c={t.bright ? p.traceBright : p.trace} w={t.w} a={t.bright ? 0.85 : 0.9} />
      ))}
      {traces.map((t, i) => {
        const e = t.pts[t.pts.length - 1];
        return <circle key={i} cx={e[0]} cy={e[1]} r={t.pad} stroke={t.bright ? p.traceBright : p.trace} strokeWidth={t.w * 0.9} />;
      })}
    </g>
    {parts.map((c, i) => (
      <rect key={i} x={c.x - c.w / 2} y={c.y - c.h / 2} width={c.w} height={c.h} rx={3} fill={c.bright ? p.traceBright : p.trace} fillOpacity={c.bright ? 0.85 : 0.6} />
    ))}
    {dots.map((d, i) => (
      <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? p.traceBright : p.chipEdge} fillOpacity={0.85} />
    ))}
    {/* chip: nested rounded rectangles */}
    <path d={rr(RINGS[0][0], RINGS[0][1], RINGS[0][2])} fill={p.chipFill} />
    {combs.map((c, i) => (
      <rect key={i} {...c} rx={3} fill={p.traceBright} fillOpacity={0.8} />
    ))}
    <g fill="none">
      {RINGS.map(([w, h, r, sw, b], i) => (
        b > 0.8 ? (
          // Raised wall: stacked copies stepping toward the far side, dim at the
          // base, bright rim with a pale specular line on top.
          <g key={i}>
            {Array.from({ length: WALL }, (_, k) => (
              <path key={k} d={rr(w, h, r)} transform={`translate(0 ${-k * WALL_STEP})`} stroke={p.chipEdge} strokeWidth={sw} strokeOpacity={0.22 + (0.5 * k) / WALL} />
            ))}
            <g transform={`translate(0 ${-WALL * WALL_STEP})`}>
              <Neon d={rr(w, h, r)} c={p.chipEdge} w={sw} a={1} />
              <path d={rr(w, h, r)} stroke={p.traceBright} strokeWidth={sw * 0.4} />
              <path d={rr(w, h, r)} stroke="#cfe6ff" strokeOpacity={0.35} strokeWidth={sw * 0.12} />
            </g>
          </g>
        ) : (
          <Neon key={i} d={rr(w, h, r)} c={p.chipEdge} w={sw} a={0.45 + 0.55 * b} />
        )
      ))}
    </g>
    <g fill="none">
      {NOTCHED.map(([w, h, c], i) => (
        <path key={i} d={notched(w, h, c)} stroke={p.traceBright} strokeOpacity={0.7} strokeWidth={3} strokeDasharray={`${180 + i * 60} 26 ${60 + i * 20} 18`} />
      ))}
    </g>
    {padRows.map((q, i) => (
      <rect key={i} x={q.x - q.s / 2} y={q.y - q.s / 2} width={q.s} height={q.s} rx={2} fill={i % 4 ? p.trace : p.traceBright} fillOpacity={0.9} />
    ))}
    <path d={rr(DIE_W, DIE_H, 26)} fill={p.board} stroke={p.chipEdge} strokeWidth={4} strokeOpacity={0.6} />
    {pinCols.map((q, i) => (
      <rect key={i} {...q} rx={4} fill={i % 3 ? p.traceBright : p.chipEdge} fillOpacity={0.9} />
    ))}
    {sparkles.map((d, i) => (
      <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#a9d2ff" fillOpacity={0.75} />
    ))}
    <g fill="none" strokeLinecap="round">
      {pulses.map((q, i) => {
        let s = saw(f, q.cycles, q.offset);
        if (q.inward) s = 1 - s;
        const total = q.t.len + q.dash;
        return (
          <React.Fragment key={i}>
            <path d={toD(q.t.pts)} stroke={p.traceBright} strokeWidth={q.t.w * 4} strokeOpacity={0.25} strokeDasharray={`${q.dash} ${total + q.dash}`} strokeDashoffset={q.dash - s * total} />
            <path d={toD(q.t.pts)} stroke={p.traceBright} strokeOpacity={0.9} strokeWidth={q.t.w * 1.2} strokeDasharray={`${q.dash} ${total + q.dash}`} strokeDashoffset={q.dash - s * total} />
          </React.Fragment>
        );
      })}
    </g>
  </svg>
);

// ---------------------------------------------------------------------------
// Depth of field: the tilted board is cut into horizontal strips (in board
// space), each blurred once by its distance from the focus line through the
// chip centre. Strips overlap and fade in over the one before, so blur rises
// smoothly. Total blurred area is about one board, not one board per level.
// ---------------------------------------------------------------------------
const STRIPS = 18;
const FOCUS_Y = CY;
const SHARP = 150; // half-height of the sharp band, board units
const blurAt = (y: number) => {
  const d = Math.max(0, Math.abs(y - FOCUS_Y) - SHARP);
  return Math.min(24, Math.pow(d / 640, 1.1) * 24); // 1080p px
};
const STRIP_H = BH / STRIPS;

// Side depth of field: columns away from the chip get extra blur by their
// horizontal distance, so the blur grows in every direction from the focus.
// Each column covers only the height where it is blurrier than the
// row strips underneath, with feathered edges.
const SIDE_COLS = 4;
const SIDE_START = 760; // board units from CX where side blur begins
const SIDE_W = 340;
const sideBlurAt = (dx: number) => Math.min(20, Math.pow(Math.max(0, dx - SIDE_START) / 900, 1.05) * 20);
const sideCols = [-1, 1].flatMap((dir) =>
  Array.from({ length: SIDE_COLS }, (_, i) => {
    const dx0 = SIDE_START + i * SIDE_W;
    const b = sideBlurAt(dx0 + SIDE_W * 0.75);
    // rows where the row blur is below this column's blur
    const reach = SHARP + 640 * Math.pow(b / 24, 1 / 1.1);
    const x0 = dir > 0 ? CX + dx0 : CX - dx0 - SIDE_W;
    const last = i === SIDE_COLS - 1;
    return { dir, x0: last && dir > 0 ? x0 : dir < 0 && last ? 0 : x0, w: last ? (dir > 0 ? BW - x0 : CX - dx0) : SIDE_W, y0: CY - reach, y1: CY + reach, b };
  }),
);

// Triangle in the overlay's 1920x1080 space.
const TRI_CX = 960;
const TRI_CY = 488;
const TRI_SIDE = 480; // base width (25% of frame)
const TRI_H = TRI_SIDE * 0.78; // wider than equilateral, like a road sign
const triTop = TRI_CY - TRI_H * 0.6;
const triBase = TRI_CY + TRI_H * 0.4;
// Rounded corners: each vertex replaced by a quadratic curve.
const roundTri = (pts: Pt[], r: number) => {
  let d = "";
  for (let i = 0; i < 3; i++) {
    const a = pts[(i + 2) % 3];
    const b = pts[i];
    const c = pts[(i + 1) % 3];
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const p1: Pt = [b[0] + ((a[0] - b[0]) * r) / la, b[1] + ((a[1] - b[1]) * r) / la];
    const p2: Pt = [b[0] + ((c[0] - b[0]) * r) / lc, b[1] + ((c[1] - b[1]) * r) / lc];
    d += `${i ? "L" : "M"}${p1[0].toFixed(1)} ${p1[1].toFixed(1)}Q${b[0]} ${b[1]} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
};
const triPath = roundTri(
  [
    [TRI_CX, triTop],
    [TRI_CX + TRI_SIDE / 2, triBase],
    [TRI_CX - TRI_SIDE / 2, triBase],
  ],
  34,
);

const Triangle: React.FC<{ p: ChipPalette; breath: number }> = ({ p, breath }) => {
  const gain = 0.55 + 1.35 * breath;
  const barTop = TRI_CY - TRI_H * 0.27;
  const barBot = TRI_CY + TRI_H * 0.08;
  const dotY = TRI_CY + TRI_H * 0.23;
  const mark = (
    <>
      <path d={`M${TRI_CX} ${barTop}L${TRI_CX} ${barBot}`} />
      <path d={`M${TRI_CX} ${dotY}L${TRI_CX} ${dotY + 0.5}`} />
    </>
  );
  return (
    <>
      <defs>
        <GlowFilter id="triGlow" base={4} gain={gain} weights={[1.2, 0.9, 0.65]} />
        <radialGradient id="triFill" cx="50%" cy="62%" r="60%">
          <stop offset="0%" stopColor={p.alert} stopOpacity={0.55} />
          <stop offset="100%" stopColor={p.alertDeep} stopOpacity={1} />
        </radialGradient>
      </defs>
      {/* Reflection: flat stacked copies of the base, fading downward */}
      <g filter="url(#triGlow)" opacity={0.95}>
        {Array.from({ length: 7 }, (_, i) => {
          const y = triBase + 20 + i * 14;
          const w = TRI_SIDE * (0.97 - i * 0.012);
          return <rect key={i} x={TRI_CX - w / 2} y={y} width={w} height={7} rx={3.5} fill={p.alert} opacity={0.8 * Math.pow(0.7, i) * (0.75 + 0.25 * breath)} />;
        })}
      </g>
      <path d={triPath} fill="url(#triFill)" />
      <g filter="url(#triGlow)" strokeLinejoin="round" strokeLinecap="round">
        <path d={triPath} fill="none" stroke={p.alert} strokeWidth={32} />
        <g stroke={p.alert} strokeWidth={44} fill="none">{mark}</g>
      </g>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={0.93 + 0.07 * breath}>
        <path d={triPath} stroke={p.alertCore} strokeWidth={9} />
        <g stroke={p.alertCore} strokeWidth={22}>{mark}</g>
      </g>
    </>
  );
};

export const ChipAlert: React.FC<{ palette: ChipPalette }> = ({ palette: p }) => {
  const f = useLoopFrame();
  const { u, width, height } = useUnits();

  // Camera: one closed cycle per loop. Sideways sway + push in/out.
  const swayX = osc(f, 1) * 30 * u;
  const swayY = osc(f, 2, 0.25) * 8 * u;
  const push = 1.04 + 0.045 * osc(f, 1, 0.25);
  const originX = 50 + 3 * osc(f, 1);

  // Triangle pulse: 5 smooth breaths per loop.
  const breath = 0.5 - 0.5 * Math.cos(2 * Math.PI * saw(f, 5));

  const boardW = BW * u * 0.9;
  const boardH = BH * u * 0.9;
  const k = boardH / BH; // px per board unit

  return (
    <AbsoluteFill style={{ background: p.bgEdge, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${swayX}px, ${swayY}px) scale(${push})` }}>
        <AbsoluteFill style={{ perspective: 1500 * u, perspectiveOrigin: `${originX}% 35%` }}>
          <div
            style={{
              position: "absolute",
              left: width / 2 - boardW / 2,
              top: height * 0.53 - boardH / 2,
              width: boardW,
              height: boardH,
              transform: "rotateX(27deg)",
              transformOrigin: "50% 50%",
            }}
          >
            {Array.from({ length: STRIPS }, (_, i) => {
              const y0 = i * STRIP_H;
              const y1 = y0 + STRIP_H;
              const b = blurAt(Math.abs(y0 + STRIP_H / 2 - FOCUS_Y) < Math.abs(y1 - FOCUS_Y) ? y0 + STRIP_H / 2 : y0 + STRIP_H / 2);
              const ext = (3 * Math.max(b, blurAt(y0 - STRIP_H / 2))) / 0.9 + 30; // board units
              const fade = 40;
              const top = i === 0 ? 0 : y0 - fade - ext;
              const bottom = i === STRIPS - 1 ? BH : y1 + fade + ext;
              const mask =
                i === 0
                  ? undefined
                  : `linear-gradient(to bottom, transparent ${ext * k}px, black ${(ext + 2 * fade) * k}px)`;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: top * k,
                    width: boardW,
                    height: (bottom - top) * k,
                    overflow: "hidden",
                    filter: b > 0.05 ? `blur(${b * u}px)` : undefined,
                    maskImage: mask,
                    WebkitMaskImage: mask,
                  }}
                >
                  <div style={{ position: "absolute", left: 0, top: -top * k, width: boardW, height: boardH }}>
                    <Board p={p} f={f} id={`s${i}`} />
                  </div>
                </div>
              );
            })}
            {sideCols.map((c, i) => {
              const fade = 60;
              const ext = 3 * c.b + 30;
              const x0 = c.x0 - (c.dir > 0 ? ext + fade : 0);
              const x1 = c.x0 + c.w + (c.dir < 0 ? ext + fade : 0);
              const y0 = Math.max(0, c.y0 - fade - ext);
              const y1 = Math.min(BH, c.y1 + fade + ext);
              const W = x1 - x0;
              const H = y1 - y0;
              const hx =
                c.dir > 0
                  ? `linear-gradient(to right, transparent ${ext * k}px, black ${(ext + 2 * fade) * k}px)`
                  : `linear-gradient(to left, transparent ${ext * k}px, black ${(ext + 2 * fade) * k}px)`;
              const vy = `linear-gradient(to bottom, transparent ${ext * k}px, black ${(ext + 2 * fade) * k}px, black ${(H - ext - 2 * fade) * k}px, transparent ${(H - ext) * k}px)`;
              return (
                <div
                  key={`c${i}`}
                  style={{
                    position: "absolute",
                    left: x0 * k,
                    top: y0 * k,
                    width: W * k,
                    height: H * k,
                    overflow: "hidden",
                    filter: `blur(${c.b * u}px)`,
                    maskImage: `${hx}, ${vy}`,
                    WebkitMaskImage: `${hx}, ${vy}`,
                    maskComposite: "intersect",
                    WebkitMaskComposite: "source-in",
                  }}
                >
                  <div style={{ position: "absolute", left: -x0 * k, top: -y0 * k, width: boardW, height: boardH }}>
                    <Board p={p} f={f} id={`c${i}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
        {/* Red light spilling from the triangle onto the chip */}
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 19% 26% at 50% 47%, rgba(${p.alertRgb},${0.16 + 0.12 * breath}) 0%, rgba(${p.alertRgb},0.05) 60%, rgba(${p.alertRgb},0) 100%)`, mixBlendMode: "screen" }} />
        {/* Triangle: nearer to the camera, slightly more parallax */}
        <AbsoluteFill style={{ transform: `translate(${swayX * 0.3}px, ${swayY * 0.3}px)` }}>
          <svg viewBox="0 0 1920 1080" width={width} height={height} style={{ position: "absolute", overflow: "visible" }}>
            <Triangle p={p} breath={breath} />
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>
      {/* Warm glow leaking into the bottom-left corner */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 24% 30% at 0% 100%, rgba(${p.warm},0.8) 0%, rgba(${p.warm},0.25) 38%, rgba(${p.warm},0) 75%)`, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 78% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.5) 100%)" }} />
      <Grain opacity={0.022} salt={3} />
    </AbsoluteFill>
  );
};
