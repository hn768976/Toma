import React, { useMemo } from "react";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";
import { seededRandom } from "../shared/random";
import { Theme } from "./theme";

// The far field: a graded backdrop, a corner bloom, faint circuit traces
// and a scatter of dot-matrix blocks. It drifts sideways a few pixels
// over the full runtime, which is enough to keep the frame alive without
// ever pulling focus from the emblem.

const TRACE_COUNT = 34;
const MATRIX_BLOCK_COUNT = 46;
const PARALLAX_X = 46;

type Trace = { d: string; width: number; opacity: number };

const buildTraces = (): Trace[] => {
  const traces: Trace[] = [];
  for (let i = 0; i < TRACE_COUNT; i++) {
    // Start off the left edge and step right, occasionally jogging
    // vertically at 45 degrees like a PCB trace.
    let x = -120 + seededRandom(i, 21) * 260;
    let y = seededRandom(i, 22) * DESIGN_HEIGHT;
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const steps = 4 + Math.floor(seededRandom(i, 23) * 5);
    for (let s = 0; s < steps; s++) {
      const run = 120 + seededRandom(i * 31 + s, 24) * 420;
      x += run;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      const jog = (seededRandom(i * 31 + s, 25) - 0.5) * 240;
      x += Math.abs(jog);
      y += jog;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    x += 400;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    traces.push({
      d,
      width: seededRandom(i, 26) > 0.75 ? 2 : 1,
      opacity: 0.25 + seededRandom(i, 27) * 0.6,
    });
  }
  return traces;
};

type MatrixBlock = {
  x: number;
  y: number;
  cols: number;
  rows: number;
  seed: number;
};

const buildMatrixBlocks = (): MatrixBlock[] => {
  const blocks: MatrixBlock[] = [];
  for (let i = 0; i < MATRIX_BLOCK_COUNT; i++) {
    blocks.push({
      x: -60 + seededRandom(i, 41) * (DESIGN_WIDTH + 120),
      y: seededRandom(i, 42) * DESIGN_HEIGHT,
      cols: 4 + Math.floor(seededRandom(i, 43) * 10),
      rows: 2 + Math.floor(seededRandom(i, 44) * 5),
      seed: i,
    });
  }
  return blocks;
};

const DOT = 5;
const DOT_GAP = 8;

type BackgroundProps = {
  theme: Theme;
  frame: number;
  progress: number;
  uid: string;
};

export const Background: React.FC<BackgroundProps> = ({
  theme,
  frame,
  progress,
  uid,
}) => {
  const { palette } = theme;
  const traces = useMemo(() => buildTraces(), []);
  const blocks = useMemo(() => buildMatrixBlocks(), []);

  const drift = -PARALLAX_X * progress;
  const gradId = `${uid}-backdrop`;
  const glowId = `${uid}-corner-glow`;
  const vignetteId = `${uid}-vignette`;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={palette.backdropTop} />
          <stop offset="100%" stopColor={palette.backdropBottom} />
        </linearGradient>
        <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
          <stop
            offset="0%"
            stopColor={palette.cornerGlow}
            stopOpacity={palette.cornerGlowOpacity}
          />
          <stop offset="100%" stopColor={palette.cornerGlow} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={vignetteId} cx="0.5" cy="0.5" r="0.72">
          <stop offset="45%" stopColor={palette.vignette} stopOpacity={0} />
          <stop
            offset="100%"
            stopColor={palette.vignette}
            stopOpacity={palette.vignetteOpacity}
          />
        </radialGradient>
      </defs>

      <rect
        width={DESIGN_WIDTH}
        height={DESIGN_HEIGHT}
        fill={`url(#${gradId})`}
      />
      <ellipse cx={120} cy={60} rx={780} ry={620} fill={`url(#${glowId})`} />

      <g transform={`translate(${drift.toFixed(2)} 0)`}>
        <g
          stroke={palette.circuit}
          fill="none"
          opacity={palette.circuitOpacity}
        >
          {traces.map((t, i) => (
            <path key={i} d={t.d} strokeWidth={t.width} opacity={t.opacity} />
          ))}
        </g>

        <g fill={palette.matrixDot} opacity={palette.matrixDotOpacity}>
          {blocks.map((b) => {
            const dots = [];
            for (let r = 0; r < b.rows; r++) {
              for (let c = 0; c < b.cols; c++) {
                const id = b.seed * 997 + r * 31 + c;
                if (seededRandom(id, 51) < 0.35) continue;
                // A slow per-dot pulse keeps the field shimmering.
                const phase = seededRandom(id, 52) * Math.PI * 2;
                const pulse =
                  0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.03 + phase));
                dots.push(
                  <rect
                    key={`${r}-${c}`}
                    x={b.x + c * DOT_GAP}
                    y={b.y + r * DOT_GAP}
                    width={DOT}
                    height={DOT}
                    opacity={pulse}
                  />,
                );
              }
            }
            return <g key={b.seed}>{dots}</g>;
          })}
        </g>
      </g>

      <rect
        width={DESIGN_WIDTH}
        height={DESIGN_HEIGHT}
        fill={`url(#${vignetteId})`}
        pointerEvents="none"
      />
    </g>
  );
};
