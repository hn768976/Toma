import React from "react";
import { useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { Grid, Label, MONO, type Box } from "./primitives";
import { noise1d, randomSeries } from "./rng";

/**
 * Sample a scrolling series: index 0 is the oldest sample, the last index is
 * the live edge. Advancing `frame` slides the whole window left, which is what
 * makes the plots look like they are streaming.
 */
const scrollingSeries = (
  seed: string,
  count: number,
  frame: number,
  speed: number,
): number[] => {
  const head = (frame * speed) / 30;
  return Array.from({ length: count }, (_, i) =>
    noise1d(seed, head + (i - count) * 0.35),
  );
};

const toPoints = (values: number[], box: Box, pad = 0): string =>
  values
    .map((v, i) => {
      const x = box.x + (box.w * i) / (values.length - 1);
      const y = box.y + box.h - pad - v * (box.h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

/** Filled area plot with a live-edge marker - the console's primary graph. */
export const AreaChart: React.FC<{
  box: Box;
  seed: string;
  speed?: number;
  samples?: number;
  grid?: boolean;
}> = ({ box, seed, speed = 1, samples = 34, grid = true }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const values = scrollingSeries(seed, samples, frame, speed);
  const points = toPoints(values, box, 4);
  const last = values[values.length - 1];

  return (
    <g>
      {grid ? <Grid box={box} cols={6} rows={3} opacity={0.35} /> : null}
      <polygon
        points={`${box.x},${box.y + box.h} ${points} ${box.x + box.w},${box.y + box.h}`}
        fill={theme.mid}
        opacity={0.22}
      />
      <polyline points={points} fill="none" stroke={theme.bright} strokeWidth={1.8} />
      <circle
        cx={box.x + box.w}
        cy={box.y + box.h - 4 - last * (box.h - 8)}
        r={2.6}
        fill={theme.hot}
      />
    </g>
  );
};

/** Two overlaid traces, for panels that need a busier read. */
export const DualTrace: React.FC<{ box: Box; seed: string; speed?: number }> = ({
  box,
  seed,
  speed = 1.4,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const a = scrollingSeries(`${seed}:a`, 40, frame, speed);
  const b = scrollingSeries(`${seed}:b`, 40, frame, speed * 0.7);

  return (
    <g>
      <Grid box={box} cols={8} rows={4} opacity={0.3} />
      <polyline points={toPoints(b, box, 5)} fill="none" stroke={theme.line} strokeWidth={1.4} />
      <polyline points={toPoints(a, box, 5)} fill="none" stroke={theme.bright} strokeWidth={1.8} />
    </g>
  );
};

/** Column chart whose bars breathe on their own offsets. */
export const BarChart: React.FC<{
  box: Box;
  seed: string;
  bars?: number;
  speed?: number;
  /** Highlight every nth bar in the hot colour. */
  accentEvery?: number;
}> = ({ box, seed, bars = 14, speed = 1, accentEvery = 5 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const phases = randomSeries(`${seed}:phase`, bars, 0, 20);
  const slot = box.w / bars;

  return (
    <g>
      {phases.map((phase, i) => {
        const v = 0.15 + noise1d(`${seed}:${i}`, (frame * speed) / 26 + phase) * 0.85;
        const h = box.h * v;
        return (
          <rect
            key={i}
            x={box.x + i * slot + slot * 0.18}
            y={box.y + box.h - h}
            width={slot * 0.64}
            height={h}
            fill={i % accentEvery === 0 ? theme.bright : theme.mid}
            opacity={0.85}
          />
        );
      })}
      <line
        x1={box.x}
        y1={box.y + box.h}
        x2={box.x + box.w}
        y2={box.y + box.h}
        stroke={theme.line}
        strokeWidth={1.2}
      />
    </g>
  );
};

/** Horizontal progress rows - the "channel load" style readout. */
export const BarRows: React.FC<{
  box: Box;
  seed: string;
  rows?: number;
  speed?: number;
}> = ({ box, seed, rows = 5, speed = 1 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const rowHeight = box.h / rows;
  const phases = randomSeries(`${seed}:p`, rows, 0, 30);

  return (
    <g>
      {phases.map((phase, i) => {
        const v = 0.2 + noise1d(`${seed}:r${i}`, (frame * speed) / 34 + phase) * 0.8;
        const y = box.y + i * rowHeight + rowHeight * 0.2;
        const h = rowHeight * 0.5;
        return (
          <g key={i}>
            <rect x={box.x} y={y} width={box.w} height={h} fill={theme.hairline} opacity={0.5} />
            <rect x={box.x} y={y} width={box.w * v} height={h} fill={theme.mid} />
            <rect x={box.x + box.w * v - 2} y={y} width={2} height={h} fill={theme.hot} />
          </g>
        );
      })}
    </g>
  );
};

/** Stepped waveform, reads as a digital signal trace. */
export const StepTrace: React.FC<{ box: Box; seed: string; steps?: number; speed?: number }> = ({
  box,
  seed,
  steps = 26,
  speed = 1,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const head = (frame * speed) / 30;
  const slot = box.w / steps;
  let d = "";
  for (let i = 0; i < steps; i++) {
    const v = noise1d(seed, head + i * 0.5) > 0.5 ? 0.85 : 0.15;
    const x = box.x + i * slot;
    const y = box.y + box.h - v * box.h;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    d += ` L ${x + slot} ${y}`;
  }

  return <path d={d} fill="none" stroke={theme.bright} strokeWidth={1.6} opacity={0.9} />;
};

/** Semicircular needle gauge. */
export const Gauge: React.FC<{
  cx: number;
  cy: number;
  r: number;
  seed: string;
  label?: string;
  speed?: number;
}> = ({ cx, cy, r, seed, label, speed = 1 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const v = noise1d(seed, (frame * speed) / 40);
  const angle = Math.PI * (1 - v);
  const ticks = 11;

  return (
    <g>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={theme.hairline}
        strokeWidth={1.4}
      />
      <path
        d={`M ${cx - r * 0.72} ${cy} A ${r * 0.72} ${r * 0.72} 0 0 1 ${cx + r * 0.72} ${cy}`}
        fill="none"
        stroke={theme.line}
        strokeWidth={r * 0.16}
        strokeDasharray={`${Math.PI * r * 0.72 * v} ${Math.PI * r * 0.72}`}
        opacity={0.75}
      />
      {Array.from({ length: ticks }, (_, i) => {
        const a = Math.PI * (1 - i / (ticks - 1));
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r}
            y1={cy - Math.sin(a) * r}
            x2={cx + Math.cos(a) * r * 0.86}
            y2={cy - Math.sin(a) * r * 0.86}
            stroke={theme.mid}
            strokeWidth={1}
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.cos(angle) * r * 0.9}
        y2={cy - Math.sin(angle) * r * 0.9}
        stroke={theme.hot}
        strokeWidth={1.8}
      />
      <circle cx={cx} cy={cy} r={2.4} fill={theme.hot} />
      {label ? (
        <text
          x={cx}
          y={cy + 15}
          fill={theme.bright}
          fontSize={10}
          fontFamily={MONO}
          textAnchor="middle"
          letterSpacing={1.6}
          opacity={0.85}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** Ring gauge with a sweeping arc, used as a corner accent. */
export const RingGauge: React.FC<{
  cx: number;
  cy: number;
  r: number;
  seed: string;
  speed?: number;
}> = ({ cx, cy, r, seed, speed = 1 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const v = 0.2 + noise1d(seed, (frame * speed) / 45) * 0.75;
  const circumference = 2 * Math.PI * r;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.hairline} strokeWidth={r * 0.22} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.bright}
        strokeWidth={r * 0.22}
        strokeDasharray={`${circumference * v} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="butt"
      />
      <text
        x={cx}
        y={cy + 4}
        fill={theme.hot}
        fontSize={r * 0.55}
        fontFamily={MONO}
        textAnchor="middle"
      >
        {Math.round(v * 100)}
      </text>
    </g>
  );
};

/** Grid of cells whose brightness drifts - a load / occupancy map. */
export const HeatGrid: React.FC<{
  box: Box;
  seed: string;
  cols?: number;
  rows?: number;
  speed?: number;
}> = ({ box, seed, cols = 12, rows = 5, speed = 1 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const phases = randomSeries(`${seed}:h`, cols * rows, 0, 40);

  return (
    <g>
      {phases.map((phase, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const v = noise1d(`${seed}:c${i}`, (frame * speed) / 30 + phase);
        return (
          <rect
            key={i}
            x={box.x + col * cellW + 1}
            y={box.y + row * cellH + 1}
            width={cellW - 2}
            height={cellH - 2}
            fill={v > 0.84 ? theme.hot : v > 0.45 ? theme.mid : theme.hairline}
            opacity={0.2 + v * 0.42}
          />
        );
      })}
    </g>
  );
};

/** Scatter of plotted samples with a crosshair, like a targeting readout. */
export const ScatterPlot: React.FC<{ box: Box; seed: string; count?: number }> = ({
  box,
  seed,
  count = 26,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const xs = randomSeries(`${seed}:x`, count, 0.05, 0.95);
  const ys = randomSeries(`${seed}:y`, count, 0.05, 0.95);
  const sweep = ((frame / 90) % 1) * box.w;

  return (
    <g>
      <Grid box={box} cols={5} rows={4} opacity={0.3} />
      {xs.map((x, i) => (
        <circle
          key={i}
          cx={box.x + x * box.w}
          cy={box.y + ys[i] * box.h}
          r={1.8}
          fill={i % 6 === 0 ? theme.hot : theme.mid}
          opacity={0.9}
        />
      ))}
      <line
        x1={box.x + sweep}
        y1={box.y}
        x2={box.x + sweep}
        y2={box.y + box.h}
        stroke={theme.bright}
        strokeWidth={1.2}
        opacity={0.5}
      />
    </g>
  );
};

/** Label + value pair stacked into a compact stats block. */
export const StatBlock: React.FC<{
  box: Box;
  seed: string;
  entries: string[];
}> = ({ box, seed, entries }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const rowHeight = box.h / entries.length;

  return (
    <g>
      {entries.map((entry, i) => {
        const v = noise1d(`${seed}:${i}`, frame / 24 + i * 3);
        return (
          <g key={entry}>
            <Label x={box.x} y={box.y + i * rowHeight + rowHeight * 0.7} size={10} opacity={0.7}>
              {entry}
            </Label>
            <text
              x={box.x + box.w}
              y={box.y + i * rowHeight + rowHeight * 0.7}
              fill={theme.hot}
              fontSize={11}
              fontFamily={MONO}
              textAnchor="end"
            >
              {(v * 100).toFixed(1)}
            </text>
          </g>
        );
      })}
    </g>
  );
};
