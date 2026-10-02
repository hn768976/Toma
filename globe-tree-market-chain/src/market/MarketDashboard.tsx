import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Grain } from "../lib/Grain";
import { hash01, TAU } from "../lib/random";
import { MarketVersion } from "../versions";
import { CANDLE_P, CANDLES, CODES, LOOP, SECTORS, stepped, wave } from "./data";

const UW = 4600; // repeating unit width on the wall (px)
const WALL_H = 3700;
const MONO = '"JetBrains Mono", monospace';
const HEAD = "Montserrat, Inter, sans-serif";

type P = { v: MarketVersion; lf: number };

const Panel: React.FC<{ x: number; y: number; w: number; h: number; title?: string; tag?: React.ReactNode; v: MarketVersion; children?: React.ReactNode }> = ({ x, y, w, h, title, tag, v, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: `linear-gradient(180deg, ${v.panel} 0%, #0B1B20 100%)`,
      border: "2px solid rgba(120,200,210,0.22)",
      borderRadius: 18,
      boxShadow: "0 0 0 1px rgba(0,0,0,0.4), inset 0 1px 0 rgba(160,230,240,0.12)",
      overflow: "hidden",
    }}
  >
    {title ? (
      <div style={{ position: "absolute", left: 26, top: 18, font: `600 30px ${HEAD}`, letterSpacing: 3, color: v.text }}>{title}</div>
    ) : null}
    {tag ? <div style={{ position: "absolute", right: 26, top: 18 }}>{tag}</div> : null}
    {children}
  </div>
);

const Tag: React.FC<{ value: number; v: MarketVersion; size?: number }> = ({ value, v, size = 28 }) => {
  const up = value >= 0;
  const c = up ? v.green : v.red;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, font: `500 ${size}px ${MONO}`, color: c }}>
      <svg width={size * 0.7} height={size * 0.6} viewBox="0 0 10 8">
        <polygon points={up ? "5,0 10,8 0,8" : "0,0 10,0 5,8"} fill={c} />
      </svg>
      {up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
};

const Heatmap: React.FC<P & { cols: number; rows: number; w: number; h: number; seed: number }> = ({ v, lf, cols, rows, w, h, seed }) => {
  const gap = 8;
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c + seed * 1000;
      const period = [60, 100, 120, 150, 200, 300][Math.floor(hash01(id, 1) * 6)];
      const off = Math.floor(hash01(id, 2) * period);
      const val = (stepped(lf, period, off, id, 3) - 0.5) * 9;
      const since = (((lf + off) % period) + period) % period;
      const flash = since < 10 ? 1 - since / 10 : 0;
      const up = val >= 0;
      const k = Math.min(1, Math.abs(val) / 4.5);
      const base = up ? v.green : v.red;
      cells.push(
        <div
          key={id}
          style={{
            position: "absolute",
            left: c * (cw + gap),
            top: r * (ch + gap),
            width: cw,
            height: ch,
            borderRadius: 6,
            background: base,
            opacity: 0.32 + k * 0.6 + flash * 0.15,
            boxShadow: flash > 0 ? `0 0 ${20 * flash}px ${base}` : undefined,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#F2FFF8",
          }}
        >
          <div style={{ font: `600 ${Math.round(ch * 0.26)}px ${MONO}` }}>
            {up ? "+" : ""}
            {val.toFixed(2)}%
          </div>
          <div style={{ font: `400 ${Math.round(ch * 0.17)}px ${MONO}`, opacity: 0.75 }}>{(1000 + hash01(id, 9) * 9000).toFixed(1)}</div>
        </div>,
      );
    }
  return <div style={{ position: "absolute", left: 26, top: 74, width: w, height: h }}>{cells}</div>;
};

const Candles: React.FC<P & { w: number; h: number }> = ({ v, lf, w, h }) => {
  const M = 40;
  const cw = w / M;
  const offset = (CANDLE_P * lf) / LOOP; // exactly one data period per loop
  const base = Math.floor(offset);
  const frac = offset - base;
  const lo = Math.min(...CANDLES.map((k) => k.lo)) - 1;
  const hi = Math.max(...CANDLES.map((k) => k.hi)) + 1;
  const py = (p: number) => h * 0.04 + h * 0.7 * (1 - (p - lo) / (hi - lo));
  const els = [];
  for (let j = 0; j <= M + 1; j++) {
    const k = CANDLES[(base + j) % CANDLE_P];
    const x = (j - frac) * cw;
    const up = k.c >= k.o;
    const col = up ? v.green : v.red;
    els.push(
      <g key={j}>
        <line x1={x + cw / 2} x2={x + cw / 2} y1={py(k.hi)} y2={py(k.lo)} stroke={col} strokeWidth={3} />
        <rect x={x + cw * 0.18} width={cw * 0.64} y={py(Math.max(k.o, k.c))} height={Math.max(3, Math.abs(py(k.o) - py(k.c)))} fill={col} />
        <rect x={x + cw * 0.18} width={cw * 0.64} y={h - k.v * h * 0.2} height={k.v * h * 0.2} fill={col} opacity={0.45} />
      </g>,
    );
  }
  const last = CANDLES[(base + M - 1) % CANDLE_P];
  // moving average
  const ma: string[] = [];
  for (let j = 0; j <= M + 1; j++) {
    let s = 0;
    for (let q = 0; q < 6; q++) s += CANDLES[(base + j - q + CANDLE_P * 2) % CANDLE_P].c;
    ma.push(`${((j - frac) * cw + cw / 2).toFixed(1)},${py(s / 6).toFixed(1)}`);
  }
  return (
    <svg width={w + 160} height={h} style={{ position: "absolute", left: 26, top: 80 }}>
      <defs>
        <clipPath id="cclip">
          <rect x={0} y={0} width={w} height={h} />
        </clipPath>
      </defs>
      {[0.2, 0.4, 0.6].map((g) => (
        <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke="rgba(160,220,230,0.08)" strokeWidth={2} strokeDasharray="8 10" />
      ))}
      <g clipPath="url(#cclip)">
        {els}
        <polyline points={ma.join(" ")} fill="none" stroke="#E8D27A" strokeWidth={3} opacity={0.7} />
      </g>
      <line x1={0} x2={w} y1={py(last.c)} y2={py(last.c)} stroke={last.c >= last.o ? v.green : v.red} strokeWidth={2} strokeDasharray="6 8" />
      <rect x={w + 10} y={py(last.c) - 22} width={140} height={44} rx={6} fill={last.c >= last.o ? v.green : v.red} />
      <text x={w + 80} y={py(last.c) + 10} textAnchor="middle" style={{ font: `600 28px ${MONO}`, fill: "#04140E" }}>
        {last.c.toFixed(2)}
      </text>
      {[0, 1, 2, 3].map((i) => (
        <text key={i} x={w + 20} y={h * (0.12 + i * 0.18)} style={{ font: `400 24px ${MONO}`, fill: v.text, opacity: 0.55 }}>
          {(hi - ((hi - lo) * i) / 3).toFixed(1)}
        </text>
      ))}
    </svg>
  );
};

const Depth: React.FC<P & { w: number; h: number; seed: number }> = ({ v, lf, w, h, seed }) => {
  const t = lf / LOOP;
  const n = 40;
  const mid = w / 2;
  const bid: string[] = [`0,${h}`];
  const ask: string[] = [`${mid},${h}`];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const yb = h * (0.12 + 0.86 * u) + wave(u, t, seed) * 18;
    bid.push(`${(u * mid).toFixed(1)},${Math.min(h, yb).toFixed(1)}`);
    const ya = h * (0.98 - 0.86 * u) + wave(u, t, seed + 5) * 18;
    ask.push(`${(mid + u * mid).toFixed(1)},${Math.min(h, ya).toFixed(1)}`);
  }
  bid.push(`${mid},${h}`);
  ask.push(`${w},${h}`);
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 26, top: 120 }}>
      <defs>
        <linearGradient id={`dg${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v.green} stopOpacity={0.75} />
          <stop offset="1" stopColor={v.green} stopOpacity={0.12} />
        </linearGradient>
        <linearGradient id={`dr${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v.red} stopOpacity={0.75} />
          <stop offset="1" stopColor={v.red} stopOpacity={0.12} />
        </linearGradient>
      </defs>
      <polygon points={bid.join(" ")} fill={`url(#dg${seed})`} stroke={v.green} strokeWidth={4} />
      <polygon points={ask.join(" ")} fill={`url(#dr${seed})`} stroke={v.red} strokeWidth={4} />
      <text x={10} y={-12} style={{ font: `500 24px Inter`, fill: v.text }}>BIDS</text>
      <line x1={mid} x2={mid} y1={0} y2={h} stroke="rgba(200,230,235,0.2)" strokeWidth={2} strokeDasharray="6 8" />
    </svg>
  );
};

const Line: React.FC<P & { w: number; h: number; seed: number; x?: number; y?: number }> = ({ v, lf, w, h, seed, x = 26, y = 80 }) => {
  const t = lf / LOOP;
  const pts: string[] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) pts.push(`${((i / n) * w).toFixed(1)},${(h / 2 - wave(i / n, t, seed) * h * 0.38).toFixed(1)}`);
  const up = wave(1, t, seed) >= wave(0.9, t, seed);
  const col = up ? v.green : v.red;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: x, top: y }}>
      <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth={4} />
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={col} opacity={0.12} />
    </svg>
  );
};

const Board: React.FC<P & { w: number }> = ({ v, lf, w }) => {
  const cols = ["CODE", "LAST", "CHG%", "VOL", "HIGH"];
  const cx = [0, 0.22, 0.44, 0.64, 0.84].map((q) => q * w);
  return (
    <div style={{ position: "absolute", left: 26, top: 80, width: w }}>
      {cols.map((c, i) => (
        <div key={c} style={{ position: "absolute", left: cx[i], top: 0, font: `500 24px Inter`, letterSpacing: 2, color: v.text, opacity: 0.6 }}>
          {c}
        </div>
      ))}
      {CODES.map((code, r) => {
        const period = [10, 12, 15, 20, 30][r % 5];
        const off = r * 3;
        const ch = (stepped(lf, period * 4, off, r, 1) - 0.5) * 8;
        const last = 20 + hash01(r, 2) * 900 + (stepped(lf, period, off, r, 3) - 0.5) * 2;
        const vol = 10 + stepped(lf, period, off + 1, r, 4) * 990;
        const col = ch >= 0 ? v.green : v.red;
        return (
          <div key={code} style={{ position: "absolute", top: 46 + r * 52, left: 0, width: w, height: 48, font: `500 30px ${MONO}`, color: v.text }}>
            <span style={{ position: "absolute", left: cx[0], color: "#E6F2F4" }}>{code}</span>
            <span style={{ position: "absolute", left: cx[1], color: col }}>{last.toFixed(2)}</span>
            <span style={{ position: "absolute", left: cx[2], color: col }}>
              {ch >= 0 ? "+" : ""}
              {ch.toFixed(2)}
            </span>
            <span style={{ position: "absolute", left: cx[3] }}>{vol.toFixed(1)}K</span>
            <span style={{ position: "absolute", left: cx[4], opacity: 0.7 }}>{(last * 1.03).toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
};

const Indices: React.FC<P & { w: number; h: number; seed: number }> = ({ v, lf, w, h, seed }) => (
  <>
    {[0, 1, 2].map((i) => {
      const val = (stepped(lf, 60, i * 17, seed, i) - 0.45) * 6;
      return (
        <div key={i} style={{ position: "absolute", left: 26, top: 80 + i * ((h - 100) / 3), width: w - 52, height: (h - 120) / 3 }}>
          <div style={{ font: `600 26px ${MONO}`, color: "#E6F2F4" }}>{["IDX-01", "IDX-05", "IDX-12"][i]}</div>
          <div style={{ position: "absolute", right: 0, top: 0 }}>
            <Tag value={val} v={v} size={26} />
          </div>
          <Line v={v} lf={lf} w={w - 52} h={(h - 120) / 3 - 50} seed={seed * 10 + i} x={0} y={44} />
        </div>
      );
    })}
  </>
);

const Unit: React.FC<P & { x: number }> = ({ v, lf, x }) => {
  const tag = (s: number) => <Tag value={(stepped(lf, 75, s * 13, s, 77) - 0.45) * 7} v={v} />;
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: UW, height: WALL_H }}>
      <Panel x={30} y={30} w={2820} h={1000} title="SECTOR HEATMAP" tag={tag(1)} v={v}>
        <Heatmap v={v} lf={lf} cols={14} rows={7} w={2768} h={890} seed={1} />
      </Panel>
      <Panel x={2890} y={30} w={1680} h={1000} title="INDICES" tag={tag(2)} v={v}>
        <Indices v={v} lf={lf} w={1680} h={1000} seed={3} />
      </Panel>
      <Panel x={30} y={1070} w={2240} h={860} title="IDX-01 · 15M" tag={tag(3)} v={v}>
        <Candles v={v} lf={lf} w={1980} h={740} />
      </Panel>
      <Panel x={2310} y={1070} w={1300} h={860} title="DEPTH" tag={tag(4)} v={v}>
        <Depth v={v} lf={lf} w={1248} h={700} seed={11} />
      </Panel>
      <Panel x={3650} y={1070} w={920} h={410} title="FND-7" tag={tag(5)} v={v}>
        <Line v={v} lf={lf} w={868} h={290} seed={21} />
      </Panel>
      <Panel x={3650} y={1520} w={920} h={410} title="SEC-B" tag={tag(6)} v={v}>
        <Line v={v} lf={lf} w={868} h={290} seed={22} />
      </Panel>
      <Panel x={30} y={1970} w={1400} h={860} title="DEPTH" tag={tag(7)} v={v}>
        <Depth v={v} lf={lf} w={1348} h={700} seed={12} />
      </Panel>
      <Panel x={1470} y={1970} w={2100} h={860} title="MARKET BOARD" tag={tag(8)} v={v}>
        <Board v={v} lf={lf} w={2040} />
      </Panel>
      <Panel x={3610} y={1970} w={960} h={860} title="INDICES" tag={tag(9)} v={v}>
        <Indices v={v} lf={lf} w={960} h={860} seed={4} />
      </Panel>
      <Panel x={30} y={2870} w={2240} h={800} title="SECTOR HEATMAP" tag={tag(10)} v={v}>
        <Heatmap v={v} lf={lf} cols={10} rows={5} w={2188} h={690} seed={2} />
      </Panel>
      <Panel x={2310} y={2870} w={2260} h={800} title="MARKET BOARD" tag={tag(11)} v={v}>
        <div style={{ position: "absolute", left: 26, top: 80, display: "flex", flexWrap: "wrap", gap: 16, width: 2200 }}>
          {SECTORS.map((s, i) => (
            <div key={s} style={{ width: 520, height: 70, borderRadius: 10, background: "rgba(160,220,230,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", font: `500 28px ${MONO}`, color: "#E6F2F4" }}>
              {s}
              <Tag value={(stepped(lf, 50, i * 7, i, 31) - 0.5) * 6} v={v} size={26} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export const MarketDashboard: React.FC<{ version: MarketVersion }> = ({ version: v }) => {
  const frame = useCurrentFrame();
  const lf = frame % LOOP;
  const t = lf / LOOP;
  const glide = UW * t; // exactly one repeat per loop
  const sway = Math.sin(TAU * t) * 1.2;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 60%, #0C2A30 0%, ${v.bg} 70%)`, overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 2300, perspectiveOrigin: "50% 30%" }}>
        <div
          style={{
            position: "absolute",
            left: 1920 - UW * 1.5,
            top: 1080 - WALL_H / 2 + 180,
            width: UW * 3,
            height: WALL_H,
            transformOrigin: `${UW * 1.5}px ${WALL_H / 2}px`,
            // Own compositing layer: contents are rasterised flat at a fixed
            // scale every frame and the perspective is applied when compositing,
            // so glyph/path raster caches never depend on earlier frames.
            willChange: "transform",
            transform: `rotateX(46deg) rotateZ(${-7 + sway}deg) translateX(${-glide + 900}px)`,
          }}
        >
          {[-1, 0, 1, 2].map((k) => (
            <Unit key={k} v={v} lf={lf} x={UW + k * UW} />
          ))}
        </div>
      </AbsoluteFill>
      {/* depth of field: blur what lies behind, masked to far & near bands */}
      <AbsoluteFill
        style={{
          backdropFilter: "blur(18px)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 18%, transparent 46%, transparent 72%, rgba(0,0,0,0.9) 100%)",
          maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 18%, transparent 46%, transparent 72%, rgba(0,0,0,0.9) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backdropFilter: "blur(6px)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 20%, #000 34%, transparent 46%, transparent 70%, #000 82%, transparent 95%)",
          maskImage: "linear-gradient(180deg, transparent 20%, #000 34%, transparent 46%, transparent 70%, #000 82%, transparent 95%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(2,8,10,0.55) 100%)" }} />
      <Grain seed={lf} />
    </AbsoluteFill>
  );
};
