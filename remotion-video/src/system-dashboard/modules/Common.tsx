import React from "react";
import { useCurrentFrame } from "remotion";
import { BORDER, FINE, HAIRLINE } from "../constants";
import { appear, drift, ramp, tickingDigits } from "../anim";
import { mulberry32, rand, randRange, stream } from "../random";
import { loremLines, numCode, shortCode } from "../text";
import { useTheme } from "../theme";
import { Corners, GridPaper, Hatch, Reveal, Svg, TickRow, Txt } from "../primitives";

/**
 * The module library. The layout is composed from many instances of these
 * with different props - hand-authoring a hundred bespoke elements would be
 * neither maintainable nor visually consistent.
 */

/** Bordered panel with an optional letter-spaced title bar. */
export const PanelFrame: React.FC<{
  w: number;
  h: number;
  title?: string;
  titleH?: number;
  titleSize?: number;
  p: number;
  grid?: boolean;
  gridStep?: number;
  lift?: boolean;
}> = ({ w, h, title, titleH = 66, titleSize = 34, p, grid, gridStep = 26, lift }) => {
  const theme = useTheme();
  return (
    <>
      {lift ? (
        <div
          style={{ position: "absolute", inset: 0, background: theme.lift, opacity: Math.min(1, p * 2) }}
        />
      ) : null}
      {grid ? (
        <Svg w={w} h={h} style={{ opacity: Math.max(0, p * 1.4 - 0.4) }}>
          <GridPaper w={w} h={h} step={gridStep} opacity={0.5} />
        </Svg>
      ) : null}
      <Reveal p={p}>
        <Svg w={w} h={h}>
          <rect
            x={BORDER / 2}
            y={BORDER / 2}
            width={w - BORDER}
            height={h - BORDER}
            fill="none"
            stroke={theme.primary}
            strokeWidth={BORDER}
          />
          {title ? (
            <path
              d={`M0 ${titleH}H${w}`}
              stroke={theme.primary}
              strokeWidth={HAIRLINE}
            />
          ) : null}
        </Svg>
        {title ? (
          <Txt
            x={0}
            y={titleH / 2 - titleSize * 0.62}
            width={w}
            align="center"
            size={titleSize}
            weight={600}
            ls={titleSize * 0.32}
            glow
          >
            {title}
          </Txt>
        ) : null}
      </Reveal>
    </>
  );
};

const cell = (seed: number, r: number, c: number, frame: number, width: number): string => {
  const kind = rand(seed * 31 + r * 977 + c * 41);
  let s: string;
  if (kind < 0.16) s = tickingDigits(frame, seed + r * 101 + c * 13, Math.min(4, width));
  else if (kind < 0.4) s = shortCode(seed + r * 17 + c * 29);
  else if (kind < 0.72) s = numCode(seed + r * 7 + c * 313, width);
  else s = numCode(seed + r * 53 + c * 11, width - 2) + "." + numCode(seed + r * 3 + c, 1);
  return s.slice(0, width).padEnd(width, " ");
};

/**
 * Dense data table. Rows fill in one after another rather than all at once,
 * and most rows sit at low contrast so the block reads as texture with a
 * few legible lines picked out of it.
 */
export const DataTable: React.FC<{
  w: number;
  rows: number;
  cols: number;
  seed: number;
  start: number;
  size?: number;
  rowStep?: number;
  cellW?: number;
}> = ({ w, rows, cols, seed, start, size = 19, rowStep = 26, cellW = 6 }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const colW = w / cols;
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const p = ramp(frame, start + r * 2.4, 8);
    if (p <= 0) continue;
    const bright = rand(seed * 61 + r) > 0.82;
    let line = "";
    for (let c = 0; c < cols; c++) line += cell(seed, r, c, frame, cellW) + "  ";
    out.push(
      <Txt
        key={r}
        x={0}
        y={r * rowStep}
        size={size}
        mono
        color={bright ? theme.primary : theme.secondary}
        opacity={p * (bright ? 0.95 : randRange(seed * 7 + r, 0.34, 0.7))}
      >
        {line}
      </Txt>,
    );
  }
  return (
    <>
      <Svg w={w} h={rows * rowStep} style={{ opacity: ramp(frame, start, 14) }}>
        <path
          d={`M0 -6H${w}M0 ${rows * rowStep - 8}H${w}`}
          stroke={theme.structure}
          strokeWidth={FINE}
        />
        {new Array(cols - 1).fill(0).map((_, i) => (
          <path
            key={i}
            d={`M${(i + 1) * colW - 8} -6V${rows * rowStep - 8}`}
            stroke={theme.structure}
            strokeWidth={FINE}
            opacity={0.7}
          />
        ))}
      </Svg>
      {out}
    </>
  );
};

/** Narrow vertical bar columns with fine horizontal hatching. */
export const BarColumns: React.FC<{
  w: number;
  h: number;
  count: number;
  seed: number;
  start: number;
  labels?: boolean;
}> = ({ w, h, count, seed, start, labels = true }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const gap = w / count;
  const bw = gap * 0.56;
  return (
    <>
      <Svg w={w} h={h} style={{ opacity: ramp(frame, start, 18) }}>
        {new Array(count).fill(0).map((_, i) => {
          const p = appear(frame, start + i * 9, 26);
          const v = drift(frame, seed * 13 + i, 110 + i * 17, 0.2, 0.95, i * 40);
          const fill = h * v * p;
          return (
            <g key={i}>
              <rect
                x={i * gap}
                y={0}
                width={bw}
                height={h}
                fill="none"
                stroke={theme.structure}
                strokeWidth={FINE}
              />
              <Hatch
                x={i * gap + 1}
                y={h - fill}
                w={bw - 2}
                h={fill}
                step={5}
                opacity={0.85}
              />
              <path
                d={`M${i * gap} ${h - fill}H${i * gap + bw}`}
                stroke={theme.primary}
                strokeWidth={HAIRLINE}
                opacity={p}
              />
            </g>
          );
        })}
      </Svg>
      {labels
        ? new Array(count).fill(0).map((_, i) => (
            <Txt
              key={i}
              x={i * gap}
              y={h + 8}
              size={15}
              mono
              color={theme.secondary}
              opacity={ramp(frame, start + i * 9, 20) * 0.8}
            >
              {numCode(seed + i, 2)}
            </Txt>
          ))
        : null}
    </>
  );
};

const waveCache = new Map<number, number[]>();

const waveData = (seed: number, n = 4096): number[] => {
  const hit = waveCache.get(seed);
  if (hit) return hit;
  const r = mulberry32(seed);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let v =
      0.34 * Math.sin(i * 0.129 + seed) +
      0.26 * Math.sin(i * 0.041 + 1.7) +
      0.2 * Math.sin(i * 0.311 + 0.4) +
      (r() - 0.5) * 0.95;
    if (r() > 0.985) v *= 2.1; // occasional spike
    out[i] = Math.max(-1, Math.min(1, v));
  }
  waveCache.set(seed, out);
  return out;
};

/**
 * Signal trace that scrolls right to left, mirrored about its centre line.
 * The brightest thing in the left panel.
 */
export const Waveform: React.FC<{
  w: number;
  h: number;
  seed: number;
  start: number;
  speed?: number;
  dx?: number;
  mirror?: boolean;
}> = ({ w, h, seed, start, speed = 1.35, dx = 3, mirror = true }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const data = waveData(seed);
  const n = Math.ceil(w / dx) + 2;
  const off = Math.max(0, frame - start) * speed;
  const i0 = Math.floor(off);
  const shift = (off - i0) * dx;
  const mid = h / 2;
  const amp = (h / 2) * 0.92;
  const run = ramp(frame, start, 26);
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = data[(i0 + i) % data.length] * run;
    const x = (i * dx - shift).toFixed(1);
    top.push(`${i === 0 ? "M" : "L"}${x} ${(mid - v * amp).toFixed(1)}`);
    bot.push(`${i === 0 ? "M" : "L"}${x} ${(mid + v * amp).toFixed(1)}`);
  }
  return (
    <Svg w={w} h={h} style={{ clipPath: `inset(0 0 0 0)` }}>
      <path d={`M0 ${mid}H${w}`} stroke={theme.structure} strokeWidth={FINE} opacity={ramp(frame, start - 20, 20)} />
      <g style={{ filter: `drop-shadow(0 0 3px ${theme.glow})` }} opacity={run}>
        <path d={top.join("")} fill="none" stroke={theme.primary} strokeWidth={HAIRLINE} />
        {mirror ? (
          <path d={bot.join("")} fill="none" stroke={theme.primary} strokeWidth={HAIRLINE} opacity={0.7} />
        ) : null}
      </g>
    </Svg>
  );
};

/** Block of lorem paragraph text, fading in line by line at low contrast. */
export const ParagraphBlock: React.FC<{
  w: number;
  lines: number;
  seed: number;
  start: number;
  size?: number;
  lineStep?: number;
  chars?: number;
  opacity?: number;
  color?: string;
}> = ({ w, lines, seed, start, size = 21, lineStep = 27, chars = 64, opacity = 0.52, color }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const text = loremLines(seed, lines, chars);
  return (
    <>
      {text.map((line, i) => {
        const p = ramp(frame, start + i * 3.5, 18);
        if (p <= 0) return null;
        return (
          <Txt
            key={i}
            x={0}
            y={i * lineStep}
            size={size}
            width={w}
            color={color ?? theme.secondary}
            opacity={p * opacity}
          >
            {line}
          </Txt>
        );
      })}
    </>
  );
};

/** Long thin progress bar. */
export const ProgressBar: React.FC<{
  w: number;
  h?: number;
  seed: number;
  start: number;
  segments?: number;
}> = ({ w, h = 14, seed, start, segments = 0 }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 30);
  const v = drift(frame, seed, 150, 0.35, 0.97);
  return (
    <Svg w={w} h={h} style={{ opacity: ramp(frame, start, 20) }}>
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={theme.structure} strokeWidth={FINE} />
      <rect x={1} y={1} width={Math.max(0, w * v * p - 2)} height={h - 2} fill={theme.bar} opacity={0.85} />
      {segments
        ? new Array(segments - 1).fill(0).map((_, i) => (
            <path
              key={i}
              d={`M${((i + 1) * w) / segments} 0V${h}`}
              stroke="#000"
              strokeWidth={HAIRLINE}
            />
          ))
        : null}
    </Svg>
  );
};

/** Segmented strip meter - discrete blocks, lit up to a drifting value. */
export const StripMeter: React.FC<{
  w: number;
  h: number;
  count: number;
  seed: number;
  start: number;
  vertical?: boolean;
}> = ({ w, h, count, seed, start, vertical = false }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 28);
  const v = drift(frame, seed * 29, 95, 0.25, 0.98, seed % 60);
  const lit = Math.round(count * v * p);
  const step = (vertical ? h : w) / count;
  const bs = step * 0.68;
  return (
    <Svg w={w} h={h} style={{ opacity: ramp(frame, start, 20) }}>
      {new Array(count).fill(0).map((_, i) => {
        const on = vertical ? count - 1 - i < lit : i < lit;
        return vertical ? (
          <rect
            key={i}
            x={0}
            y={i * step}
            width={w}
            height={bs}
            fill={on ? theme.bar : "none"}
            stroke={on ? "none" : theme.structure}
            strokeWidth={FINE}
            opacity={on ? 0.9 : 0.8}
          />
        ) : (
          <rect
            key={i}
            x={i * step}
            y={0}
            width={bs}
            height={h}
            fill={on ? theme.bar : "none"}
            stroke={on ? "none" : theme.structure}
            strokeWidth={FINE}
            opacity={on ? 0.9 : 0.8}
          />
        );
      })}
    </Svg>
  );
};

/** Tall thin vertical meter with a scale and a moving index mark. */
export const VerticalMeter: React.FC<{
  w: number;
  h: number;
  seed: number;
  start: number;
  ticks?: number;
}> = ({ w, h, seed, start, ticks = 26 }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 34);
  const v = drift(frame, seed * 71, 130, 0.12, 0.94, seed % 90);
  const y = h * (1 - v * p);
  return (
    <Svg w={w} h={h} style={{ opacity: ramp(frame, start, 22) }}>
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={theme.structure} strokeWidth={FINE} />
      <Hatch x={1} y={y} w={w - 2} h={Math.max(0, h - y - 1)} step={6} opacity={0.7} />
      {new Array(ticks).fill(0).map((_, i) => (
        <path
          key={i}
          d={`M${w} ${(i * h) / ticks}h${i % 5 === 0 ? 14 : 7}`}
          stroke={theme.structure}
          strokeWidth={FINE}
        />
      ))}
      <path d={`M${-8} ${y}H${w + 8}`} stroke={theme.primary} strokeWidth={HAIRLINE} opacity={p} />
    </Svg>
  );
};

/** Row of short filled bars sitting on a baseline. */
export const BarRow: React.FC<{
  w: number;
  h: number;
  count: number;
  seed: number;
  start: number;
}> = ({ w, h, count, seed, start }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const step = w / count;
  return (
    <Svg w={w} h={h} style={{ opacity: ramp(frame, start, 20) }}>
      <path d={`M0 ${h}H${w}`} stroke={theme.structure} strokeWidth={FINE} />
      {new Array(count).fill(0).map((_, i) => {
        const p = appear(frame, start + i * 3, 22);
        const v = drift(frame, seed * 17 + i, 70 + i * 9, 0.12, 1, i * 23);
        const bh = h * v * p;
        return (
          <rect
            key={i}
            x={i * step}
            y={h - bh}
            width={step * 0.62}
            height={bh}
            fill={theme.bar}
            opacity={randRange(seed + i, 0.5, 0.95)}
          />
        );
      })}
    </Svg>
  );
};

/** Column of ticking numeric readouts with short labels. */
export const ReadoutColumn: React.FC<{
  w: number;
  rows: number;
  seed: number;
  start: number;
  size?: number;
  rowStep?: number;
}> = ({ w, rows, seed, start, size = 20, rowStep = 30 }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  return (
    <>
      {new Array(rows).fill(0).map((_, i) => {
        const p = ramp(frame, start + i * 4, 16);
        if (p <= 0) return null;
        return (
          <React.Fragment key={i}>
            <Txt x={0} y={i * rowStep} size={size} mono color={theme.secondary} opacity={p * 0.72}>
              {shortCode(seed + i * 37)}
            </Txt>
            <Txt
              x={0}
              y={i * rowStep}
              size={size}
              width={w}
              align="right"
              mono
              color={theme.primary}
              opacity={p * 0.92}
            >
              {tickingDigits(frame, seed + i * 91, 5)}
            </Txt>
          </React.Fragment>
        );
      })}
    </>
  );
};

/** Checkerboard transparency pattern, drawn behind display frames. */
export const Checkerboard: React.FC<{
  w: number;
  h: number;
  cell?: number;
  color?: string;
  opacity?: number;
}> = ({ w, h, cell = 22, color, opacity = 0.5 }) => {
  const theme = useTheme();
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2) continue;
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={c * cell}
          y={r * cell}
          width={Math.min(cell, w - c * cell)}
          height={Math.min(cell, h - r * cell)}
        />,
      );
    }
  }
  return (
    <g fill={color ?? theme.structure} opacity={opacity}>
      {rects}
    </g>
  );
};

/** Loose scatter of small filler marks: brackets, ticks and crosses. */
export const FillerCluster: React.FC<{
  w: number;
  h: number;
  seed: number;
  start: number;
}> = ({ w, h, seed, start }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = ramp(frame, start, 30);
  const xs = stream(seed, 7, 0, w * 0.86);
  const ys = stream(seed + 3, 7, 0, h * 0.8);
  return (
    <Svg w={w} h={h} style={{ opacity: p * 0.9 }}>
      {xs.map((x, i) => {
        const kind = rand(seed * 11 + i);
        if (kind < 0.34)
          return (
            <g key={i} transform={`translate(${x} ${ys[i]})`}>
              <Corners w={randRange(seed + i, 40, 110)} h={randRange(seed * 3 + i, 26, 60)} len={10} color={theme.structure} sw={FINE} />
            </g>
          );
        if (kind < 0.7)
          return (
            <g key={i} transform={`translate(${x} ${ys[i]})`}>
              <TickRow w={randRange(seed * 7 + i, 90, 220)} step={10} len={6} majorLen={13} />
            </g>
          );
        return (
          <path
            key={i}
            d={`M${x - 9} ${ys[i]}H${x + 9}M${x} ${ys[i] - 9}V${ys[i] + 9}`}
            stroke={theme.structure}
            strokeWidth={FINE}
          />
        );
      })}
    </Svg>
  );
};
