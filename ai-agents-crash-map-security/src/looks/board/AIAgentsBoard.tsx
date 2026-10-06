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
  { icon: "shieldOutline", x: 2950, y: 896 },
  { icon: "cloud", x: 3314, y: 896 },
  { icon: "gearFine", x: 2587, y: 1259 },
  { icon: "document", x: 2950, y: 1259 },
  { icon: "globe", x: 3314, y: 1259 },
];
const TILE_SIZE = 252;

// Invented filler copy (no real text).
const FILLER = [
  "agent nodes plan each task, call the right tool, check the result and then",
  "hand the next step to a peer node. every run is logged, scored and kept so",
  "the swarm keeps learning from its own traces. queue depth stays low while",
  "throughput holds steady across all regions of the cluster grid, and slow",
  "steps are retried on a fresh node before the window closes for the batch.",
];

const typed = (s: string, p: number) => s.slice(0, Math.floor(clamp01(p) * s.length + 0.0001));

// Circuit traces from the chip edge out to the ring (static, seeded).
// Orthogonal circuit-board traces from the chip edge to terminal dots on the ring.
const RING_R = 330;
const TRACES = (() => {
  const r = mulberry32(2024);
  const out: { d: string; end: [number, number]; delay: number }[] = [];
  // 5 traces per side; each leaves the chip straight, bends 45°, then runs to the ring
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) * 58 + (r() - 0.5) * 10; // along the chip edge
      const out1 = 200 + r() * 30; // first straight run (distance from centre)
      const bend = (k - 2) * 0.16 + (r() - 0.5) * 0.05; // final angle offset from the side normal
      const base = (side * Math.PI) / 2;
      const rot = (x: number, y: number): [number, number] => [
        x * Math.cos(base) - y * Math.sin(base),
        x * Math.sin(base) + y * Math.cos(base),
      ];
      const p0 = rot(166, off);
      const p1 = rot(out1, off);
      const endA = Math.atan2(off, out1) * 0.4 + bend;
      const e: [number, number] = rot(Math.cos(endA) * (RING_R - 12), Math.sin(endA) * (RING_R - 12));
      // diagonal then straight into the dot
      const mid: [number, number] = [p1[0] + (e[0] - p1[0]) * 0.55, p1[1] + (e[1] - p1[1]) * 0.55];
      const f = (q: [number, number]) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
      out.push({ d: `M${f(p0)} L${f(p1)} L${f(mid)} L${f(e)}`, end: e, delay: r() * 14 });
    }
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
      `${n(13, 4)}  ${n(14, 4)}  ${n(15, 4)}`,
      `${n(16, 4)}  ${n(17, 4)}  ${n(18, 4)}`,
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
            <feGaussianBlur stdDeviation="14" result="b" />
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
            <stop offset="0" stopColor="#4E9BFF" />
            <stop offset="1" stopColor={row.accent} />
          </linearGradient>
          <linearGradient id="chip" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#F2F7FC" />
          </linearGradient>
          <linearGradient id="tilefill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#6A9AC8" stopOpacity="0.6" />
            <stop offset="1" stopColor={row.tile} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* HUD decorations */}
        <g opacity={range(frame, 100, 130)}>
          <Chevrons x={2520} y={648} n={8} size={52} opacity={0.55} />
          <Chevrons x={3190} y={1068} n={3} size={44} opacity={0.5} />
          <Chevrons x={1780} y={1660} n={1} size={40} opacity={0.4} dir={1} />
          {/* faint hexagon outlines */}
          {[
            [1410, 660, 120],
            [2760, 1690, 110],
          ].map(([x, y, r], i) => (
            <polygon key={i} fill="none" stroke="#6FB8FF" strokeWidth={4} opacity={0.18}
              points={Array.from({ length: 6 }, (_, k) => `${x + r * Math.cos((k * Math.PI) / 3)},${y + r * Math.sin((k * Math.PI) / 3)}`).join(" ")} />
          ))}
        </g>

        {/* Ring */}
        <g transform={`translate(${CENTER.x} ${CENTER.y})`} filter="url(#glow)">
          <circle r={RING_R} fill="none" stroke="#6FE8FF" strokeWidth={6} opacity={0.8} pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={1 - ringP} transform={`rotate(${-90 + rotC})`} />
          <circle r={420} fill="none" stroke={ringColor} strokeWidth={4} opacity={0.4} pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={1 - ringP} transform={`rotate(${-90 + rotC})`} />
          <g transform={`rotate(${rotA})`}>
            <circle r={372} fill="none" stroke={ringColor} strokeWidth={10} opacity={0.3 * ringP}
              strokeDasharray="70 18 22 18" />
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <circle key={i} cx={Math.cos(a) * 420} cy={Math.sin(a) * 420} r={5} fill="#9FD8FF" opacity={0.35 * ringP} />
              );
            })}
          </g>
          <path d={TICKS} stroke={ringColor} strokeWidth={3} opacity={0.3 * ringP} transform={`rotate(${rotB})`} />
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
                <path d={t.d} fill="none" stroke="#9FEFFF" strokeWidth={5.5} pathLength={1} strokeDasharray="1 1"
                  strokeDashoffset={1 - p} />
                <circle cx={t.end[0]} cy={t.end[1]} r={8} fill="#E2F8FF" stroke="none"
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
          <rect x={-166} y={-166} width={332} height={332} rx={32} fill="none" stroke="#9FE8FF" strokeWidth={14}
            opacity={0.45} filter="url(#softglow)" />
          <rect x={-162} y={-162} width={324} height={324} rx={30} fill="url(#chip)" />
          <text x={0} y={8} textAnchor="middle" dominantBaseline="middle" fontFamily={INTER} fontWeight={700}
            fontSize={150} fill="#0B2552" letterSpacing={-2}>
            AI
          </text>
        </g>

        {/* Left block */}
        <g>
          <g transform={`translate(876 856) scale(${0.6 + 0.4 * pillIn} 1)`} opacity={clamp01(pillIn)}>
            <rect x={-268} y={-31} width={536} height={62} rx={31} fill="url(#pill)" opacity={0.95} filter="url(#glow)" />
            <text x={0} y={3} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontWeight={400}
              fontSize={54} fill="#FFFFFF">
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
            <text x={790} y={1036} opacity={0.75}>{numbers[4]}</text>
            <text x={790} y={1062} opacity={0.75}>{numbers[5]}</text>
            <text x={1180} y={1036} opacity={0.75}>{numbers[2]}</text>
            <text x={1180} y={1062} opacity={0.75}>{numbers[3]}</text>
          </g>
          <text x={876} y={1170} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontWeight={400}
            fontSize={62} fill="#EAF4FF">
            {agentsText}
          </text>
          <g fontFamily={MONO} fontSize={17} fill="#B9CCE8" opacity={0.8}>
            {FILLER.map((line, i) => (
              <text key={i} x={380} y={1236 + i * 24}>
                {typed(line, fillerP * FILLER.length - i)}
              </text>
            ))}
          </g>
          <path d="M375 1250 V1385 H420 M375 1250 H400 M1380 1210 H1440 V1250" fill="none" stroke="#7FB8FF" strokeWidth={3}
            opacity={0.5 * range(frame, 150, 156)} />
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
                stroke="#9CC4E8" strokeWidth={4} strokeOpacity={0.4 + 0.35 * g} />
              <rect x={-half} y={-half} width={TILE_SIZE} height={TILE_SIZE} rx={26} fill="#5AD8FF"
                opacity={0.1 * g} filter="url(#softglow)" />
              <rect x={-half + 16} y={-half + 16} width={TILE_SIZE - 32} height={TILE_SIZE - 32} rx={16} fill="none"
                stroke="#8CC8FF" strokeWidth={2.5} strokeOpacity={0.28 + 0.3 * g} />
              <g transform={`translate(${-96} ${-96}) scale(${192 / 24})`} filter={g > 0.3 ? "url(#glow)" : undefined}>
                {(ICONS[t.icon] as IconDef).fill ? <path d={(ICONS[t.icon] as IconDef).fill} fill="#B8C8D8" /> : null}
                <path d={ICONS[t.icon].stroke} fill="none" stroke={t.icon === "cloud" ? "none" : "#F2F8FF"} strokeWidth={1.0}
                  strokeLinecap="round" strokeLinejoin="round" />
                {t.icon === "shieldOutline" ? (
                  <path d={ICONS.check.stroke} fill="none" stroke="#3AD8FF" strokeWidth={2} strokeLinecap="round"
                    strokeLinejoin="round" />
                ) : null}
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
