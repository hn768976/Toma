import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp01, easeOutBack, easeOutCubic, range } from "../../lib/anim";
import { INTER, loadFonts, MONO } from "../../lib/fonts";
import { ICONS, IconDef, IconName } from "../../lib/icons";
import { getNoiseTiles, NOISE_MEAN_LEVELS, TILE, TILE_COUNT } from "../../lib/noiseTiles";
import { hash, mulberry32 } from "../../lib/random";
import { useAssets } from "../../lib/useAssets";
import { loadLandMask } from "../../lib/worldmap";
import type { BoardRow } from "../../versions";
import { BoardCanvas, CENTER, H, W } from "./BoardCanvas";

const TILES: { icon: IconName; x: number; y: number }[] = [
  { icon: "agent", x: 2587, y: 896 },
  { icon: "shield", x: 2950, y: 896 },
  { icon: "cloud", x: 3314, y: 896 },
  { icon: "gear", x: 2587, y: 1259 },
  { icon: "document", x: 2950, y: 1259 },
  { icon: "globe", x: 3314, y: 1259 },
];
const TILE_SIZE = 252;

// Invented filler copy (no real text).
const FILLER = [
  "agent nodes plan each task, call the right tool, check the result and",
  "hand the next step to a peer node. every run is logged, scored and",
  "replayed so the swarm keeps learning. queue depth stays low while",
  "throughput holds steady across all regions of the cluster grid.",
];

const typed = (s: string, p: number) => s.slice(0, Math.floor(clamp01(p) * s.length + 0.0001));

// Circuit traces from the chip edge out to the ring (static, seeded).
const TRACES = (() => {
  const r = mulberry32(2024);
  const out: { d: string; end: [number, number]; delay: number }[] = [];
  const N = 20;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 + 0.16;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const edge = 178 / Math.max(Math.abs(c), Math.abs(s));
    const p0: [number, number] = [c * edge, s * edge];
    const r1 = Math.max(edge + 22, 205 + r() * 40);
    const p1: [number, number] = [c * r1, s * r1];
    const bend = (r() < 0.5 ? -1 : 1) * (0.16 + r() * 0.2);
    const r2 = 262 + r() * 34;
    const p2: [number, number] = [Math.cos(a + bend) * r2, Math.sin(a + bend) * r2];
    out.push({
      d: `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`,
      end: p2,
      delay: r() * 14,
    });
  }
  return out;
})();

const ticksPath = (r0: number, r1: number, n: number, every = 0, r2 = r1) => {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = every && i % every === 0 ? r2 : r1;
    d += `M${(Math.cos(a) * r0).toFixed(1)} ${(Math.sin(a) * r0).toFixed(1)} L${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)} `;
  }
  return d;
};
const arcPath = (r: number, a0: number, a1: number) => {
  const p = (a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
};
const TICKS = ticksPath(326, 342, 144, 6, 352);
const ARCS = [arcPath(300, 0.3, 1.5), arcPath(300, 2.2, 3.0), arcPath(300, 3.6, 5.2)];

const Chevrons: React.FC<{ x: number; y: number; n: number; size: number; opacity: number; dir?: 1 | -1 }> = ({
  x,
  y,
  n,
  size,
  opacity,
  dir = -1,
}) => {
  let d = "";
  for (let i = 0; i < n; i++) {
    const cx = x + i * size * 0.9;
    d += `M${cx - (dir * size) / 2} ${y - size / 2} L${cx + (dir * size) / 2} ${y} L${cx - (dir * size) / 2} ${y + size / 2} `;
  }
  return <path d={d} fill="none" stroke="#6FB8FF" strokeWidth={5} opacity={opacity} />;
};

const Board: React.FC<{ row: BoardRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const tiles = useMemo(() => getNoiseTiles(), []);
  const lift = NOISE_MEAN_LEVELS;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  // --- build-in timing (frames)
  const ringP = easeOutCubic(range(frame, 90, 136));
  const chipIn = range(frame, 98, 104);
  const chipScale = 0.9 + 0.1 * easeOutBack(range(frame, 98, 116));
  const tracesP = (k: number) => easeOutCubic(range(frame, 108 + TRACES[k].delay, 132 + TRACES[k].delay));
  const live = Math.max(0, frame - 90);
  const rotA = live * 0.11;
  const rotB = -live * 0.07;
  const rotC = live * 0.05;

  // left block
  const pillIn = easeOutBack(range(frame, 104, 112));
  const genText = typed("AI Generate", range(frame, 108, 124));
  const boxIn = range(frame, 112, 120);
  const agentsText = typed("AI Agents", range(frame, 120, 134));
  const fillerP = range(frame, 126, 156);
  const numbers = (() => {
    const k = Math.floor(frame / 4);
    const n = (i: number, len: number) =>
      Array.from({ length: len }, (_, j) => Math.floor(hash(i, j, frame >= 150 ? k : 0) * 10)).join("");
    return [
      `${n(1, 5)}  ${n(2, 6)}  ${n(3, 2)}`,
      `${n(4, 5)}  ${n(5, 6)}  ${n(6, 2)}`,
      `${n(7, 5)}  ${n(8, 4)}  ${n(9, 4)}`,
      `${n(10, 5)}  ${n(11, 5)}  ${n(12, 3)}`,
    ];
  })();
  const numsIn = range(frame, 116, 124);

  // tiles glow sweep (live hold), period 120 frames
  const sweep = ((Math.max(0, frame - 150) % 120) / 120) * 8 - 1;

  const ringColor = row.ring;
  return (
    <AbsoluteFill style={{ backgroundColor: row.bgTop }}>
      <BoardCanvas row={row} lift={lift} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="22" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="pill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#3E7BFF" />
            <stop offset="1" stopColor={row.accent} />
          </linearGradient>
          <linearGradient id="chip" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DDEFFF" />
          </linearGradient>
          <linearGradient id="tilefill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={row.tile} stopOpacity="0.85" />
            <stop offset="1" stopColor={row.tile} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* HUD decorations */}
        <g opacity={range(frame, 100, 130)}>
          <Chevrons x={2560} y={648} n={9} size={40} opacity={0.35} />
          <Chevrons x={3500} y={1080} n={3} size={30} opacity={0.3} />
          <Chevrons x={1800} y={1660} n={2} size={30} opacity={0.25} dir={1} />
          <path d="M2380 760 H2470 M2380 1400 H2470 M3530 760 V1400" stroke="#6FB8FF" strokeWidth={3} opacity={0.25} />
        </g>

        {/* Ring */}
        <g transform={`translate(${CENTER.x} ${CENTER.y})`} filter="url(#glow)">
          <circle r={400} fill="none" stroke={ringColor} strokeWidth={4} opacity={0.55} pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={1 - ringP} transform={`rotate(${-90 + rotC})`} />
          <g transform={`rotate(${rotA})`}>
            <circle r={372} fill="none" stroke={ringColor} strokeWidth={10} opacity={0.3 * ringP}
              strokeDasharray="70 18 22 18" />
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <circle key={i} cx={Math.cos(a) * 400} cy={Math.sin(a) * 400} r={9} fill="#BFF0FF" opacity={ringP} />
              );
            })}
          </g>
          <path d={TICKS} stroke={ringColor} strokeWidth={4} opacity={0.6 * ringP} transform={`rotate(${rotB})`} />
          <g transform={`rotate(${rotC * 2})`} opacity={ringP}>
            {ARCS.map((d, i) => (
              <path key={i} d={d} stroke={ringColor} strokeWidth={8} fill="none" opacity={0.8} />
            ))}
          </g>
          <circle r={250} fill="none" stroke={ringColor} strokeWidth={3} opacity={0.35 * ringP} strokeDasharray="6 14" />
          {TRACES.map((t, k) => {
            const p = tracesP(k);
            return (
              <g key={k} opacity={p > 0 ? 1 : 0}>
                <path d={t.d} fill="none" stroke="#8FE4FF" strokeWidth={4} pathLength={1} strokeDasharray="1 1"
                  strokeDashoffset={1 - p} />
                <circle cx={t.end[0]} cy={t.end[1]} r={9} fill="none" stroke="#CFF4FF" strokeWidth={4}
                  opacity={p >= 0.98 ? 1 : 0} />
              </g>
            );
          })}
        </g>

        {/* Chip */}
        <g
          transform={`translate(${CENTER.x} ${CENTER.y}) scale(${chipScale})`}
          opacity={chipIn}
        >
          <rect x={-170} y={-170} width={340} height={340} rx={34} fill="none" stroke="#9FE8FF" strokeWidth={10}
            opacity={0.65} filter="url(#softglow)" />
          <rect x={-162} y={-162} width={324} height={324} rx={30} fill="url(#chip)" />
          <text x={0} y={8} textAnchor="middle" dominantBaseline="middle" fontFamily={INTER} fontWeight={700}
            fontSize={150} fill="#0B2552" letterSpacing={-2}>
            AI
          </text>
        </g>

        {/* Left block */}
        <g>
          <g transform={`translate(876 856) scale(${0.6 + 0.4 * pillIn} 1)`} opacity={clamp01(pillIn)}>
            <rect x={-268} y={-31} width={536} height={62} rx={31} fill="url(#pill)" filter="url(#glow)" opacity={0.95} />
            <text x={0} y={3} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontWeight={500}
              fontSize={54} fill="#FFFFFF" filter="url(#glow)">
              {genText}
            </text>
          </g>
          <g opacity={boxIn}>
            <rect x={385} y={944} width={983} height={46} fill="none" stroke="#7FB8FF" strokeWidth={3} opacity={0.65} />
            <text x={404} y={968} dominantBaseline="middle" fontFamily={MONO} fontSize={22} fill="#CFE4FF" opacity={0.85}>
              Command Prompt  &lt;
            </text>
          </g>
          <g opacity={numsIn} fontFamily={MONO} fontSize={19} fill="#AFC8EC">
            <text x={388} y={1036} opacity={0.75}>{numbers[0]}</text>
            <text x={388} y={1062} opacity={0.75}>{numbers[1]}</text>
            <text x={1010} y={1036} opacity={0.75}>{numbers[2]}</text>
            <text x={1010} y={1062} opacity={0.75}>{numbers[3]}</text>
          </g>
          <text x={876} y={1170} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontWeight={500}
            fontSize={62} fill="#F2F8FF" filter="url(#glow)">
            {agentsText}
          </text>
          <g fontFamily={MONO} fontSize={19} fill="#B9CCE8" opacity={0.8}>
            {FILLER.map((line, i) => (
              <text key={i} x={380} y={1238 + i * 27}>
                {typed(line, fillerP * FILLER.length - i)}
              </text>
            ))}
          </g>
          <path d="M385 1350 H560" stroke="#7FB8FF" strokeWidth={3} opacity={0.5 * range(frame, 150, 156)} />
        </g>

        {/* Icon tiles */}
        {TILES.map((t, i) => {
          const start = 112 + i * 6;
          const p = range(frame, start, start + 9);
          if (p <= 0) return null;
          const flick = frame - start < 3 ? (frame - start === 1 ? 0.3 : 0.8) : 1;
          const sc = 0.9 + 0.1 * easeOutBack(p);
          const g = Math.exp(-Math.pow(sweep - i, 2) * 0.9) * range(frame, 150, 170);
          const half = TILE_SIZE / 2;
          return (
            <g key={i} transform={`translate(${t.x} ${t.y}) scale(${sc})`} opacity={clamp01(p * 1.6) * flick}>
              <rect x={-half} y={-half} width={TILE_SIZE} height={TILE_SIZE} rx={26} fill="url(#tilefill)"
                stroke="#8CC8FF" strokeWidth={4} strokeOpacity={0.55 + 0.45 * g} />
              <rect x={-half} y={-half} width={TILE_SIZE} height={TILE_SIZE} rx={26} fill="#5AD8FF"
                opacity={0.18 * g} filter="url(#softglow)" />
              <rect x={-half + 16} y={-half + 16} width={TILE_SIZE - 32} height={TILE_SIZE - 32} rx={16} fill="none"
                stroke="#8CC8FF" strokeWidth={2.5} strokeOpacity={0.28 + 0.3 * g} />
              <g transform={`translate(${-82} ${-82}) scale(${164 / 24})`} filter={g > 0.3 ? "url(#glow)" : undefined}>
                {(ICONS[t.icon] as IconDef).fill ? <path d={(ICONS[t.icon] as IconDef).fill} fill="#FFFFFF" /> : null}
                <path d={ICONS[t.icon].stroke} fill="none" stroke="#FFFFFF" strokeWidth={1.45}
                  strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          );
        })}
      </svg>
      {/* grain + dither: fixed noise tiles indexed by frame, added on top */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${tiles[frame % TILE_COUNT]})`,
          backgroundSize: `${TILE / dpr}px`,
          backgroundPosition: `${Math.floor(hash(frame, 1) * TILE) / dpr}px ${Math.floor(hash(frame, 2) * TILE) / dpr}px`,
          imageRendering: "pixelated",
          mixBlendMode: "plus-lighter",
        }}
      />
    </AbsoluteFill>
  );
};

export const AIAgentsBoard: React.FC<{ row: BoardRow }> = ({ row }) => {
  const ready = useAssets(() => Promise.all([loadFonts(), loadLandMask()]), "board assets");
  return ready ? <Board row={row} /> : <AbsoluteFill style={{ backgroundColor: row.bgTop }} />;
};
