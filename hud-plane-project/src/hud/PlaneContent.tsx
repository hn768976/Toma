import React from "react";
import {
  DURATION_IN_FRAMES,
  DRIFT_X,
  DRIFT_Y,
  HAIR,
  SWEEP_REVOLUTIONS,
  VB_H,
  VB_W,
} from "./constants";
import {
  BLOCK_CLUSTERS,
  BRACKETS,
  DOT_LINES,
  DOT_MATRICES,
  GRID,
  MINI_RINGS,
  POINTS,
  RADAR,
  RADAR_RINGS,
  RADAR_SCALE,
  RULES,
  TICK_ROWS,
  type Ring,
} from "./layout";
import type { Palette } from "./palette";
import { clamp, frac, hash01, loopWave } from "./random";
import { arcPath, polar, wedgePath } from "./svg";

/** Normalised loop position in [0, 1). */
type Ctx = { t: number; fm: number; p: Palette; pre: string };

// ---------------------------------------------------------------------------
// Faint grid
// ---------------------------------------------------------------------------

const Grid: React.FC<{ p: Palette }> = ({ p }) => {
  const lines: React.ReactElement[] = [];
  for (let i = 0, x = 0; x <= VB_W; i++, x += GRID.stepX) {
    lines.push(
      <line
        key={`gv${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={VB_H}
        strokeWidth={HAIR}
        opacity={i % GRID.majorEvery === 0 ? GRID.opacity * 1.9 : GRID.opacity}
      />,
    );
  }
  for (let i = 0, y = 0; y <= VB_H; i++, y += GRID.stepY) {
    lines.push(
      <line
        key={`gh${i}`}
        x1={0}
        y1={y}
        x2={VB_W}
        y2={y}
        strokeWidth={HAIR}
        opacity={i % GRID.majorEvery === 0 ? GRID.opacity * 1.9 : GRID.opacity}
      />,
    );
  }
  return <g stroke={p.line}>{lines}</g>;
};

// ---------------------------------------------------------------------------
// Radar assembly
// ---------------------------------------------------------------------------

const ringGeometry = (ring: Ring, key: string, strokeWidth: number) => {
  if (ring.ticks) {
    // A stroke as wide as the tick length, dashed along the circumference,
    // reads as radial tick marks around the ring.
    const circumference = 2 * Math.PI * ring.r;
    const period = circumference / ring.ticks.count;
    return (
      <circle
        key={key}
        cx={RADAR.cx}
        cy={RADAR.cy}
        r={ring.r}
        fill="none"
        strokeWidth={ring.ticks.len}
        strokeDasharray={`${(HAIR * 1.6).toFixed(2)} ${(period - HAIR * 1.6).toFixed(3)}`}
      />
    );
  }
  if (!ring.segments) {
    return (
      <circle
        key={key}
        cx={RADAR.cx}
        cy={RADAR.cy}
        r={ring.r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={ring.dash}
      />
    );
  }
  return (
    <g key={key} fill="none" strokeWidth={strokeWidth} strokeLinecap="round">
      {ring.segments.map((s, i) => (
        <path
          key={i}
          d={arcPath(RADAR.cx, RADAR.cy, ring.r, s.a0, s.a1)}
          strokeDasharray={ring.dash}
        />
      ))}
    </g>
  );
};

/** The rings, at their own slow fade rates. */
const Rings: React.FC<Ctx & { boost: number }> = ({ t, p, boost }) => (
  <g>
    {RADAR_RINGS.map((ring) => {
      const fade = 0.5 + 0.5 * loopWave(t, ring.cycles, ring.phase);
      return (
        <g
          key={ring.id}
          stroke={ring.accent ? p.accent : p.line}
          opacity={clamp(ring.opacity * fade * boost, 0, 1)}
        >
          {ringGeometry(ring, ring.id, HAIR)}
        </g>
      );
    })}
  </g>
);

/** Smaller ring fragments elsewhere on the plane. */
const MiniRingGroups: React.FC<Ctx> = ({ t, p }) => (
  <g stroke={p.line} fill="none" strokeWidth={HAIR}>
    {MINI_RINGS.map((m) => {
      const o = m.opacity * (0.6 + 0.4 * loopWave(t, m.cycles, m.phase));
      return (
        <g key={m.id} opacity={o}>
          {m.radii.map((r, i) =>
            m.arc ? (
              <path key={i} d={arcPath(m.cx, m.cy, r, m.arc.a0, m.arc.a1)} />
            ) : (
              <circle key={i} cx={m.cx} cy={m.cy} r={r} />
            ),
          )}
        </g>
      );
    })}
  </g>
);

/**
 * The sweep: a fan of wedges at decreasing opacity, rotating an integer number
 * of turns per loop. The same fan drives a mask that brightens whatever ring
 * segments it is passing over.
 */
const SWEEP_STEPS = 9;
const sweepFan = (sweep: number, span: number) =>
  Array.from({ length: SWEEP_STEPS }, (_, i) => {
    const a1 = sweep - (i * span) / SWEEP_STEPS;
    const a0 = sweep - ((i + 1) * span) / SWEEP_STEPS;
    const k = 1 - i / SWEEP_STEPS;
    return { a0, a1, k: k * k };
  });

const Radar: React.FC<Ctx> = (ctx) => {
  const { t, fm, p, pre } = ctx;
  const sweep = -90 + 360 * SWEEP_REVOLUTIONS * t;
  const fan = sweepFan(sweep, RADAR.sweepWedge);
  const maskId = `${pre}-sweep-mask`;

  const coreGlow = 0.72 + 0.28 * loopWave(t, 2, 0.13);
  const scaleDots = Array.from({ length: RADAR_SCALE.count }, (_, i) => {
    const a =
      RADAR_SCALE.a0 +
      ((RADAR_SCALE.a1 - RADAR_SCALE.a0) * i) / (RADAR_SCALE.count - 1);
    const [x, y] = polar(RADAR.cx, RADAR.cy, RADAR_SCALE.r, a);
    const lit = hash01(`scale-${i}`, Math.floor(fm / 9));
    return { x, y, a, o: 0.2 + 0.55 * (lit > 0.72 ? 1 : 0.25) };
  });

  return (
    <g>
      <defs>
        <radialGradient
          id={`${pre}-sweep-fade`}
          gradientUnits="userSpaceOnUse"
          cx={RADAR.cx}
          cy={RADAR.cy}
          r={RADAR.sweepR}
        >
          <stop offset="0%" stopColor={p.line} stopOpacity={1} />
          <stop offset="55%" stopColor={p.line} stopOpacity={0.35} />
          <stop offset="100%" stopColor={p.line} stopOpacity={0} />
        </radialGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={VB_W} height={VB_H}>
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="black" />
          {fan.map((w, i) => (
            <path
              key={i}
              d={wedgePath(RADAR.cx, RADAR.cy, RADAR.sweepR, w.a0, w.a1)}
              fill="white"
              opacity={w.k}
            />
          ))}
        </mask>
      </defs>

      <Rings {...ctx} boost={1} />

      {/* Ring segments the sweep is passing over, brightened through the mask. */}
      <g mask={`url(#${maskId})`}>
        <Rings {...ctx} boost={3.4} />
      </g>

      {/* The trail itself, very faint, fading out with radius so the outer
          edge of the wedge never reads as a hard boundary. */}
      <g fill={`url(#${pre}-sweep-fade)`}>
        {fan.map((w, i) => (
          <path
            key={i}
            d={wedgePath(RADAR.cx, RADAR.cy, RADAR.sweepR, w.a0, w.a1)}
            opacity={0.035 * w.k}
          />
        ))}
      </g>
      <line
        x1={RADAR.cx}
        y1={RADAR.cy}
        x2={polar(RADAR.cx, RADAR.cy, RADAR.sweepR, sweep)[0]}
        y2={polar(RADAR.cx, RADAR.cy, RADAR.sweepR, sweep)[1]}
        stroke={p.line}
        strokeWidth={HAIR}
        opacity={0.5}
      />

      {/* Indicator scale riding ring-3. */}
      <g fill={p.line}>
        {scaleDots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={RADAR_SCALE.dotR} opacity={d.o} />
        ))}
      </g>

      {/* Core + crosshair. */}
      <g filter={`url(#${pre}-bloom)`}>
        <g stroke={p.line} strokeWidth={HAIR} opacity={0.42}>
          <line
            x1={RADAR.cx - RADAR.crosshair}
            y1={RADAR.cy}
            x2={RADAR.cx + RADAR.crosshair}
            y2={RADAR.cy}
          />
          <line
            x1={RADAR.cx}
            y1={RADAR.cy - RADAR.crosshair}
            x2={RADAR.cx}
            y2={RADAR.cy + RADAR.crosshair}
          />
        </g>
        <circle
          cx={RADAR.cx}
          cy={RADAR.cy}
          r={RADAR.coreR}
          fill={p.core}
          opacity={coreGlow}
        />
      </g>
    </g>
  );
};

// ---------------------------------------------------------------------------
// Data blocks
// ---------------------------------------------------------------------------

const DataBlocks: React.FC<Ctx> = ({ t, fm, p, pre }) => (
  <g filter={`url(#${pre}-bloom)`}>
    {BLOCK_CLUSTERS.map((cluster) => (
      <g key={cluster.id}>
        {cluster.blocks.map((b) => {
          const wave = 0.55 + 0.45 * loopWave(t, b.cycles, b.phase);
          // Staggered hard flicker. The step index is derived from
          // frame % durationInFrames, so the pattern repeats at the loop point.
          const h = hash01(b.id, Math.floor(fm / 6));
          const kick = h < 0.05 ? 1.75 : h > 0.95 ? 0.28 : 1;
          const fill = b.accent
            ? p.accent
            : b.bright
              ? p.blockBright
              : p.block;
          return (
            <rect
              key={b.id}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={fill}
              opacity={clamp(b.base * wave * kick, 0, 1)}
            />
          );
        })}
      </g>
    ))}
  </g>
);

// ---------------------------------------------------------------------------
// Dotted lines
// ---------------------------------------------------------------------------

const DottedLines: React.FC<Ctx> = ({ t, p }) => (
  <g fill={p.line}>
    {DOT_LINES.map((l) => {
      const dx = l.x1 - l.x0;
      const dy = l.y1 - l.y0;
      const dots: React.ReactElement[] = [];
      for (let i = 0; i < l.count; i++) {
        const u = frac(i / l.count + l.cycles * t);
        // Fade in at the wrap point so nothing pops, then optionally fade the
        // run out before it reaches the end.
        let env = Math.min(1, u / 0.05);
        if (l.fadeFrom < 1 && u > l.fadeFrom) {
          env *= Math.max(0, 1 - (u - l.fadeFrom) / (1 - l.fadeFrom));
        }
        if (env <= 0.01) continue;
        const runner = i % 9 === 0;
        dots.push(
          <circle
            key={i}
            cx={l.x0 + dx * u}
            cy={l.y0 + dy * u}
            r={runner ? l.dotR * 1.35 : l.dotR}
            opacity={l.opacity * env * (runner ? 2.1 : 1)}
          />,
        );
      }
      return <g key={l.id}>{dots}</g>;
    })}
  </g>
);

// ---------------------------------------------------------------------------
// Bracket frames
// ---------------------------------------------------------------------------

const Brackets: React.FC<Ctx> = ({ t, p }) => (
  <g stroke={p.line} fill="none" strokeWidth={HAIR}>
    {BRACKETS.map((b) => {
      const o = b.opacity * (0.6 + 0.4 * loopWave(t, b.cycles, b.phase));
      if (b.kind === "open") {
        return (
          <rect
            key={b.id}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            opacity={o}
            strokeDasharray="14 10"
          />
        );
      }
      const { x, y, w, h, arm } = b;
      const d = [
        `M ${x} ${y + arm} L ${x} ${y} L ${x + arm} ${y}`,
        `M ${x + w - arm} ${y} L ${x + w} ${y} L ${x + w} ${y + arm}`,
        `M ${x + w} ${y + h - arm} L ${x + w} ${y + h} L ${x + w - arm} ${y + h}`,
        `M ${x + arm} ${y + h} L ${x} ${y + h} L ${x} ${y + h - arm}`,
      ].join(" ");
      return <path key={b.id} d={d} opacity={o} />;
    })}
  </g>
);

// ---------------------------------------------------------------------------
// Tick rows
// ---------------------------------------------------------------------------

const TickRows: React.FC<Ctx> = ({ t, p }) => (
  <g stroke={p.line} strokeWidth={HAIR}>
    {TICK_ROWS.map((row) => {
      const o = row.opacity * (0.65 + 0.35 * loopWave(t, row.cycles, row.phase));
      const ticks: React.ReactElement[] = [];
      for (let i = 0; i < row.count; i++) {
        const major = i % row.majorEvery === 0;
        const len = major ? row.len * 1.9 : row.len;
        const x = row.x + i * row.gap;
        ticks.push(
          <line key={i} x1={x} y1={row.y} x2={x} y2={row.y + len} />,
        );
      }
      return (
        <g key={row.id} opacity={o}>
          {ticks}
        </g>
      );
    })}
  </g>
);

// ---------------------------------------------------------------------------
// Rules — the long straight skeleton the fragments hang off.
// ---------------------------------------------------------------------------

const Rules: React.FC<Ctx> = ({ t, p }) => (
  <g stroke={p.line} strokeWidth={HAIR}>
    {RULES.map((r) => (
      <line
        key={r.id}
        x1={r.x0}
        y1={r.y0}
        x2={r.x1}
        y2={r.y1}
        strokeDasharray={r.dash}
        opacity={r.opacity * (0.65 + 0.35 * loopWave(t, r.cycles, r.phase))}
      />
    ))}
  </g>
);

// ---------------------------------------------------------------------------
// Dot matrices — the small readout texture between the larger fragments.
// ---------------------------------------------------------------------------

const DotMatrices: React.FC<Ctx> = ({ t, fm, p }) => (
  <g fill={p.line}>
    {DOT_MATRICES.map((m) => {
      const o = m.opacity * (0.6 + 0.4 * loopWave(t, m.cycles, m.phase));
      const dots: React.ReactElement[] = [];
      for (let r = 0; r < m.rows; r++) {
        for (let c = 0; c < m.cols; c++) {
          // A slowly changing subset of cells is lit, seeded per cell.
          const lit = hash01(`${m.id}-${r}-${c}`, Math.floor(fm / 15));
          if (lit < 0.42) continue;
          dots.push(
            <circle
              key={`${r}-${c}`}
              cx={m.x + c * m.gap}
              cy={m.y + r * m.gap}
              r={m.dotR}
              opacity={lit > 0.9 ? 1 : 0.55}
            />,
          );
        }
      }
      return (
        <g key={m.id} opacity={o}>
          {dots}
        </g>
      );
    })}
  </g>
);

// ---------------------------------------------------------------------------
// Scattered points
// ---------------------------------------------------------------------------

const Points: React.FC<Ctx> = ({ t, fm, p }) => (
  <g>
    {POINTS.map((pt) => {
      const wave = 0.35 + 0.65 * loopWave(t, pt.cycles, pt.phase);
      const pop = hash01(pt.id, Math.floor(fm / 12)) > 0.965 ? 2.4 : 1;
      return (
        <circle
          key={pt.id}
          cx={pt.x}
          cy={pt.y}
          r={pt.r}
          fill={
            pt.tone === "accent"
              ? p.accent
              : pt.tone === "block"
                ? p.block
                : p.line
          }
          opacity={clamp(pt.opacity * wave * pop, 0, 1)}
        />
      );
    })}
  </g>
);

// ---------------------------------------------------------------------------
// The plane
// ---------------------------------------------------------------------------

export const PlaneContent: React.FC<{
  frame: number;
  palette: Palette;
  /** Unique per rendered copy so SVG defs ids never collide. */
  idPrefix: string;
  planeW: number;
  planeH: number;
}> = ({ frame, palette, idPrefix, planeW, planeH }) => {
  const fm = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const t = fm / DURATION_IN_FRAMES;
  const ctx: Ctx = { t, fm, p: palette, pre: idPrefix };

  // Whole-plane drift: one closed ellipse per loop, so frame 360 lands exactly
  // where frame 0 started.
  const dx = DRIFT_X * Math.sin(Math.PI * 2 * t);
  const dy = DRIFT_Y * Math.cos(Math.PI * 2 * t);

  return (
    <svg
      width={planeW}
      height={planeH}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <filter
          id={`${idPrefix}-bloom`}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={2.2} result="b" />
          <feComponentTransfer in="b" result="halo">
            <feFuncA type="linear" slope={0.85} />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${dx.toFixed(3)} ${dy.toFixed(3)})`}>
        <Grid p={palette} />
        <Rules {...ctx} />
        <TickRows {...ctx} />
        <Brackets {...ctx} />
        <MiniRingGroups {...ctx} />
        <DotMatrices {...ctx} />
        <DottedLines {...ctx} />
        <Points {...ctx} />
        <Radar {...ctx} />
        <DataBlocks {...ctx} />
      </g>
    </svg>
  );
};
