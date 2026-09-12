// The library of HUD widgets scattered across the board. Each one draws into
// its own SVG in design units and animates purely from `frame`, so rendering
// stays deterministic and frame-seekable.

import React from "react";
import type { DataNetworkTheme } from "./theme";
import { digits, hex, intRange, mulberry32, pick, range, type Rng } from "./rng";

export const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

export type ModuleProps = {
  w: number;
  h: number;
  seed: number;
  theme: DataNetworkTheme;
  /** Seconds since the start of the clip. */
  t: number;
};

type ModuleRenderer = React.FC<ModuleProps>;

const svgProps = (w: number, h: number) => ({
  width: w,
  height: h,
  viewBox: `0 0 ${w} ${h}`,
  style: { display: "block" as const, overflow: "visible" as const },
});

/** 0..1 triangle-ish oscillator that never lands on a hard corner. */
const osc = (t: number, speed: number, phase: number) =>
  0.5 + 0.5 * Math.sin((t * speed + phase) * Math.PI * 2);

const seeded = <T,>(seed: number, build: (rng: Rng) => T): T =>
  build(mulberry32(seed));

/* ------------------------------------------------------------------ */
/* Vertical spectrum bars — the magenta/cyan clusters in the reference. */

const SpectrumBars: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 12, 22);
    const colour = pick(rng, theme.accents);
    return {
      count,
      colour,
      gapRatio: range(rng, 0.3, 0.55),
      speed: range(rng, 0.25, 0.7),
      bars: Array.from({ length: count }, () => ({
        base: range(rng, 0.18, 0.95),
        phase: rng(),
        wobble: range(rng, 0.15, 0.5),
      })),
    };
  });

  const slot = w / spec.count;
  const barW = slot * (1 - spec.gapRatio);

  return (
    <svg {...svgProps(w, h)}>
      {spec.bars.map((bar, i) => {
        const level = Math.max(
          0.08,
          Math.min(1, bar.base + (osc(t, spec.speed, bar.phase) - 0.5) * bar.wobble * 2),
        );
        const barH = h * level;
        return (
          <rect
            key={i}
            x={i * slot}
            y={h - barH}
            width={barW}
            height={barH}
            rx={barW / 2}
            fill={spec.colour}
            opacity={0.55 + level * 0.45}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Horizontal rainbow bar chart. */

const RainbowBars: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 5, 9);
    const offset = intRange(rng, 0, theme.accents.length - 1);
    return {
      count,
      offset,
      speed: range(rng, 0.14, 0.34),
      rows: Array.from({ length: count }, () => ({
        base: range(rng, 0.35, 1),
        phase: rng(),
      })),
    };
  });

  const slot = h / spec.count;
  const barH = slot * 0.62;

  return (
    <svg {...svgProps(w, h)}>
      {spec.rows.map((row, i) => {
        const level = Math.max(
          0.12,
          Math.min(1, row.base + (osc(t, spec.speed, row.phase) - 0.5) * 0.24),
        );
        return (
          <rect
            key={i}
            x={0}
            y={i * slot}
            width={w * level}
            height={barH}
            rx={barH / 2}
            fill={theme.accents[(i + spec.offset) % theme.accents.length]}
            opacity={0.92}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Row of multi-segment donut gauges. */

const DonutRow: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 3, 5);
    return {
      count,
      donuts: Array.from({ length: count }, () => ({
        segments: intRange(rng, 3, 5),
        offset: intRange(rng, 0, theme.accents.length - 1),
        spin: range(rng, -26, 26),
        phase: rng(),
        label: digits(rng, 2),
      })),
    };
  });

  const slot = w / spec.count;
  const r = Math.min(slot * 0.34, h * 0.38);
  const stroke = r * 0.46;
  const circumference = 2 * Math.PI * r;

  return (
    <svg {...svgProps(w, h)}>
      {spec.donuts.map((donut, i) => {
        const cx = slot * (i + 0.5);
        const cy = h * 0.44;
        const gap = circumference * 0.035;
        const seg = (circumference - gap * donut.segments) / donut.segments;
        return (
          <g
            key={i}
            transform={`rotate(${donut.spin * t + donut.phase * 360} ${cx} ${cy})`}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={theme.panelStroke}
              strokeWidth={stroke * 0.35}
              opacity={0.5}
            />
            {Array.from({ length: donut.segments }, (_, s) => (
              <circle
                key={s}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={theme.accents[(donut.offset + s) % theme.accents.length]}
                strokeWidth={stroke}
                strokeDasharray={`${seg} ${circumference - seg}`}
                strokeDashoffset={-(seg + gap) * s}
                strokeLinecap="butt"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Long strip of tick marks with a scanning highlight. */

const TickStrip: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 26, 46);
    return {
      count,
      speed: range(rng, 0.08, 0.2),
      lit: Array.from({ length: count }, () => rng() < 0.22),
      colour: pick(rng, theme.accents),
      phase: rng(),
    };
  });

  const slot = w / spec.count;
  const barW = slot * 0.58;
  const head = ((t * spec.speed + spec.phase) % 1) * spec.count;

  return (
    <svg {...svgProps(w, h)}>
      {Array.from({ length: spec.count }, (_, i) => {
        const dist = Math.abs(i - head);
        const near = dist < 3.5 ? 1 - dist / 3.5 : 0;
        const isLit = spec.lit[i];
        return (
          <rect
            key={i}
            x={i * slot}
            y={0}
            width={barW}
            height={h}
            fill={near > 0.15 ? spec.colour : isLit ? theme.micro : theme.panelStroke}
            opacity={0.3 + near * 0.7 + (isLit ? 0.3 : 0)}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Oversized translucent numerals. */

const BigDigits: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => ({
    length: intRange(rng, 2, 5),
    fixed: digits(rng, 5),
    rolls: rng() < 0.55,
    period: range(rng, 0.7, 2.4),
    phase: rng(),
  }));

  const value = spec.rolls
    ? String(
        Math.floor(
          Math.abs(Math.sin((t / spec.period + spec.phase) * 1.7)) *
            10 ** spec.length,
        ),
      ).padStart(spec.length, "0")
    : spec.fixed.slice(0, spec.length);

  const size = Math.min(h * 0.94, (w / spec.length) * 1.42);

  return (
    <svg {...svgProps(w, h)}>
      <text
        x={0}
        y={h * 0.78}
        fill={theme.text}
        opacity={0.26}
        fontFamily={MONO}
        fontSize={size}
        fontWeight={700}
        letterSpacing={size * 0.13}
      >
        {value}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Rows of dashes standing in for unreadable body text. */

const MicroLines: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const rows = intRange(rng, 4, 9);
    return {
      rows,
      speed: range(rng, 0.1, 0.3),
      lines: Array.from({ length: rows }, () => ({
        words: Array.from({ length: intRange(rng, 4, 9) }, () => range(rng, 0.04, 0.17)),
        indent: range(rng, 0, 0.1),
        phase: rng(),
      })),
    };
  });

  const slot = h / spec.rows;
  const lineH = Math.max(1.5, slot * 0.3);

  return (
    <svg {...svgProps(w, h)}>
      {spec.lines.map((line, i) => {
        let x = w * line.indent;
        const flick = osc(t, spec.speed, line.phase);
        return (
          <g key={i} opacity={0.45 + flick * 0.5}>
            {line.words.map((word, j) => {
              const width = w * word;
              const rect = (
                <rect
                  key={j}
                  x={x}
                  y={i * slot + (slot - lineH) / 2}
                  width={width}
                  height={lineH}
                  fill={theme.micro}
                />
              );
              x += width + w * 0.022;
              return rect;
            })}
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Bordered readout panel. */

const PanelBox: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => ({
    rows: intRange(rng, 3, 6),
    title: hex(rng, intRange(rng, 4, 7)),
    values: Array.from({ length: 6 }, () => digits(rng, intRange(rng, 2, 3))),
    accent: pick(rng, theme.accents),
    speed: range(rng, 0.2, 0.5),
    phase: rng(),
  }));

  const header = h * 0.2;
  const rowH = (h - header) / spec.rows;
  const fontSize = Math.min(rowH * 0.62, w * 0.075);

  return (
    <svg {...svgProps(w, h)}>
      <rect x={0} y={0} width={w} height={h} fill={theme.panelFill} />
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="none"
        stroke={theme.panelStroke}
        strokeWidth={Math.max(1, w * 0.004)}
      />
      <rect x={0} y={0} width={w} height={header} fill={theme.panelStroke} opacity={0.45} />
      <text
        x={w * 0.04}
        y={header * 0.74}
        fill={theme.text}
        opacity={0.85}
        fontFamily={MONO}
        fontSize={header * 0.58}
        letterSpacing={header * 0.08}
      >
        {spec.title}
      </text>
      {Array.from({ length: spec.rows }, (_, i) => {
        const y = header + rowH * (i + 0.5);
        const level = osc(t, spec.speed, i * 0.17 + spec.phase);
        return (
          <g key={i}>
            <rect
              x={w * 0.04}
              y={y - rowH * 0.12}
              width={w * 0.34 * (0.5 + level * 0.5)}
              height={rowH * 0.24}
              fill={theme.micro}
              opacity={0.7}
            />
            <rect
              x={w * 0.44}
              y={y - rowH * 0.14}
              width={w * 0.2 * level + w * 0.04}
              height={rowH * 0.28}
              fill={spec.accent}
              opacity={0.8}
            />
            <text
              x={w * 0.96}
              y={y + fontSize * 0.34}
              textAnchor="end"
              fill={theme.textDim}
              fontFamily={MONO}
              fontSize={fontSize}
            >
              {spec.values[i % spec.values.length]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Grid of cells that flicker on and off. */

const SquareGrid: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const cols = intRange(rng, 8, 16);
    const rows = intRange(rng, 3, 7);
    return {
      cols,
      rows,
      colour: pick(rng, theme.accents),
      cells: Array.from({ length: cols * rows }, () => ({
        on: rng() < 0.3,
        accent: rng() < 0.18,
        speed: range(rng, 0.2, 0.9),
        phase: rng(),
      })),
    };
  });

  const cw = w / spec.cols;
  const ch = h / spec.rows;
  const size = Math.min(cw, ch) * 0.68;

  return (
    <svg {...svgProps(w, h)}>
      {spec.cells.map((cell, i) => {
        const col = i % spec.cols;
        const row = Math.floor(i / spec.cols);
        const flick = osc(t, cell.speed, cell.phase);
        const on = cell.on ? 0.35 + flick * 0.65 : 0.12 + flick * 0.12;
        return (
          <rect
            key={i}
            x={col * cw + (cw - size) / 2}
            y={row * ch + (ch - size) / 2}
            width={size}
            height={size}
            fill={cell.accent ? spec.colour : theme.micro}
            opacity={on}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Sparkline with a filled area and a travelling read head. */

const Sparkline: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 14, 26);
    return {
      count,
      colour: pick(rng, theme.accents),
      speed: range(rng, 0.12, 0.28),
      points: Array.from({ length: count }, () => ({
        base: range(rng, 0.15, 0.9),
        phase: rng(),
      })),
    };
  });

  const step = w / (spec.count - 1);
  const ys = spec.points.map((point, i) => {
    const level = Math.max(
      0.05,
      Math.min(1, point.base + (osc(t, spec.speed, point.phase) - 0.5) * 0.3),
    );
    return { x: i * step, y: h - h * level };
  });
  const line = ys.map((p) => `${p.x},${p.y}`).join(" ");
  const head = ys[Math.floor(((t * 0.22) % 1) * (spec.count - 1))];

  return (
    <svg {...svgProps(w, h)}>
      <polygon
        points={`0,${h} ${line} ${w},${h}`}
        fill={spec.colour}
        opacity={0.16}
      />
      <polyline
        points={line}
        fill="none"
        stroke={spec.colour}
        strokeWidth={Math.max(1.4, h * 0.028)}
        strokeLinejoin="round"
      />
      <circle cx={head.x} cy={head.y} r={Math.max(2, h * 0.055)} fill={theme.text} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Radar-style dial with a rotating sweep. */

const RadarDial: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => ({
    rings: intRange(rng, 2, 4),
    speed: range(rng, 22, 70),
    colour: pick(rng, theme.accents),
    ticks: intRange(rng, 10, 18),
    phase: rng(),
  }));

  const r = Math.min(w, h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  const angle = spec.speed * t + spec.phase * 360;

  return (
    <svg {...svgProps(w, h)}>
      {Array.from({ length: spec.rings }, (_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r * (1 - i / (spec.rings + 0.6))}
          fill="none"
          stroke={theme.panelStroke}
          strokeWidth={Math.max(1, r * 0.03)}
          opacity={0.7 - i * 0.12}
        />
      ))}
      {Array.from({ length: spec.ticks }, (_, i) => {
        const a = ((i / spec.ticks) * 360 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r * 0.86}
            y1={cy + Math.sin(a) * r * 0.86}
            x2={cx + Math.cos(a) * r}
            y2={cy + Math.sin(a) * r}
            stroke={theme.micro}
            strokeWidth={Math.max(1, r * 0.035)}
            opacity={0.65}
          />
        );
      })}
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.92}
          y2={cy}
          stroke={spec.colour}
          strokeWidth={Math.max(1.5, r * 0.05)}
        />
        <circle cx={cx + r * 0.92} cy={cy} r={r * 0.07} fill={spec.colour} />
      </g>
      <circle cx={cx} cy={cy} r={r * 0.08} fill={theme.text} opacity={0.8} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Horizontally scrolling digit stream. */

const DigitStream: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => ({
    text: digits(rng, 160),
    speed: range(rng, 18, 56) * (rng() < 0.5 ? -1 : 1),
    size: range(rng, 0.5, 0.95),
    phase: range(rng, 0, 600),
  }));

  const fontSize = h * spec.size;
  const shift = -(((spec.phase + t * spec.speed) % 600) + 600) % 600;

  return (
    <svg {...svgProps(w, h)}>
      <defs>
        <clipPath id={`clip-${seed}`}>
          <rect x={0} y={0} width={w} height={h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${seed})`}>
        <text
          x={shift}
          y={h * 0.78}
          fill={theme.micro}
          fontFamily={MONO}
          fontSize={fontSize}
          letterSpacing={fontSize * 0.42}
        >
          {spec.text}
        </text>
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Thick rounded bars in a graded accent stack. */

const StackBars: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 5, 9);
    const offset = intRange(rng, 0, theme.accents.length - 1);
    return {
      count,
      offset,
      vertical: rng() < 0.5,
      speed: range(rng, 0.18, 0.44),
      bars: Array.from({ length: count }, () => ({
        base: range(rng, 0.3, 1),
        phase: rng(),
      })),
    };
  });

  const along = spec.vertical ? w : h;
  const across = spec.vertical ? h : w;
  const slot = along / spec.count;
  const thickness = slot * 0.5;

  return (
    <svg {...svgProps(w, h)}>
      {spec.bars.map((bar, i) => {
        const level = Math.max(
          0.15,
          Math.min(1, bar.base + (osc(t, spec.speed, bar.phase) - 0.5) * 0.3),
        );
        const length = across * level;
        const colour = theme.accents[(i + spec.offset) % theme.accents.length];
        return spec.vertical ? (
          <rect
            key={i}
            x={i * slot}
            y={h - length}
            width={thickness}
            height={length}
            rx={thickness / 2}
            fill={colour}
          />
        ) : (
          <rect
            key={i}
            x={0}
            y={i * slot}
            width={length}
            height={thickness}
            rx={thickness / 2}
            fill={colour}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Arc gauge with a percentage caption. */

const GaugeArc: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => ({
    colour: pick(rng, theme.accents),
    base: range(rng, 0.35, 0.9),
    speed: range(rng, 0.12, 0.3),
    phase: rng(),
  }));

  const r = Math.min(w, h) * 0.42;
  const cx = w / 2;
  const cy = h / 2;
  const circumference = 2 * Math.PI * r;
  const level = Math.max(
    0.06,
    Math.min(0.99, spec.base + (osc(t, spec.speed, spec.phase) - 0.5) * 0.22),
  );

  return (
    <svg {...svgProps(w, h)}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.panelStroke}
        strokeWidth={r * 0.16}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={spec.colour}
        strokeWidth={r * 0.16}
        strokeDasharray={`${circumference * level} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy + r * 0.24}
        textAnchor="middle"
        fill={theme.text}
        opacity={0.82}
        fontFamily={MONO}
        fontSize={r * 0.62}
      >
        {Math.round(level * 100)}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Symmetric waveform. */

const WaveForm: ModuleRenderer = ({ w, h, seed, theme, t }) => {
  const spec = seeded(seed, (rng) => {
    const count = intRange(rng, 20, 34);
    return {
      count,
      colour: pick(rng, theme.accents),
      speed: range(rng, 0.35, 0.9),
      bars: Array.from({ length: count }, () => ({
        base: range(rng, 0.2, 1),
        phase: rng(),
      })),
    };
  });

  const slot = w / spec.count;
  const barW = slot * 0.46;

  return (
    <svg {...svgProps(w, h)}>
      {spec.bars.map((bar, i) => {
        const level = Math.max(
          0.08,
          Math.min(1, bar.base * (0.45 + osc(t, spec.speed, bar.phase) * 0.75)),
        );
        const barH = h * level;
        return (
          <rect
            key={i}
            x={i * slot}
            y={(h - barH) / 2}
            width={barW}
            height={barH}
            rx={barW / 2}
            fill={spec.colour}
            opacity={0.6 + level * 0.4}
          />
        );
      })}
    </svg>
  );
};

export const MODULES = {
  SpectrumBars,
  RainbowBars,
  DonutRow,
  TickStrip,
  BigDigits,
  MicroLines,
  PanelBox,
  SquareGrid,
  Sparkline,
  RadarDial,
  DigitStream,
  StackBars,
  GaugeArc,
  WaveForm,
} as const;

export type ModuleName = keyof typeof MODULES;
