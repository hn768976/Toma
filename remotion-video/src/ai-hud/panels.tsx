import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_MONO, FONT_SANS, PALETTE } from "./constants";
import { buildOrder, buildTickRows } from "./geometry";
import { osc, pulse } from "./loop";

// ---------------------------------------------------------------------------
// HUD furniture.
//
// Shared primitives for the two clusters. Nothing here holds state and
// nothing reads the clock — every animated value is derived from
// useCurrentFrame() through the integer-cycle helpers in ./loop.
//
// Text discipline: all labels are generic system words. No company, product
// or model names, and no currency symbols anywhere. Strings are kept short so
// they can be swapped without reflowing a panel.
// ---------------------------------------------------------------------------

/** Numbers use tabular figures so digits never jitter as they count. */
const NUM_STYLE: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const Label: React.FC<{
  x: number;
  y: number;
  size: number;
  children: string;
  color?: string;
  opacity?: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
}> = ({ x, y, size, children, color = PALETTE.text, opacity = 0.8, anchor = "start", weight = 500 }) => (
  <text
    x={x}
    y={y}
    fontFamily={FONT_SANS}
    fontSize={size}
    fontWeight={weight}
    letterSpacing={size * 0.11}
    fill={color}
    opacity={opacity}
    textAnchor={anchor}
  >
    {children}
  </text>
);

export const Num: React.FC<{
  x: number;
  y: number;
  size: number;
  children: string;
  color?: string;
  opacity?: number;
  anchor?: "start" | "middle" | "end";
}> = ({ x, y, size, children, color = PALETTE.text, opacity = 0.9, anchor = "start" }) => (
  <text
    x={x}
    y={y}
    fontFamily={FONT_MONO}
    fontSize={size}
    fontWeight={400}
    fill={color}
    opacity={opacity}
    textAnchor={anchor}
    style={NUM_STYLE}
  >
    {children}
  </text>
);

/** A framed panel with an optional filled header bar and title. */
export const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  filled?: boolean;
  opacity?: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, title, filled = true, opacity = 1, children }) => {
  const head = 34;
  return (
    <g opacity={opacity}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={filled ? "url(#panelGrad)" : "none"}
        stroke={PALETTE.line}
        strokeWidth={2.6}
        opacity={0.62}
      />
      {title ? (
        <>
          <rect x={x} y={y} width={w} height={head} fill={PALETTE.cyanDeep} opacity={0.65} />
          <Label x={x + 14} y={y + head - 11} size={22} opacity={0.85}>
            {title}
          </Label>
        </>
      ) : null}
      {/* Corner ticks — cheap detail that makes a rectangle read as instrumentation. */}
      {[
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.6} fill={PALETTE.cyan} opacity={0.5} />
      ))}
      {children}
    </g>
  );
};

/** Rows of short bars standing in for illegible body copy. */
export const TickRows: React.FC<{
  x: number;
  y: number;
  w: number;
  rows: number;
  seed: number;
  gap?: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, w, rows, seed, gap = 17, color = PALETTE.textDim, opacity = 0.55 }) => {
  const built = React.useMemo(() => buildTickRows(seed, w, rows, gap), [seed, w, rows, gap]);
  return (
    <g fill={color} opacity={opacity}>
      {built.rows.map((r, i) =>
        r.bars.map((b, j) => (
          <rect key={`${i}-${j}`} x={x + b.x} y={y + r.y} width={b.w} height={built.barH} rx={3} />
        )),
      )}
    </g>
  );
};

/** Circular progress arc with a percentage in the middle. */
export const Gauge: React.FC<{
  cx: number;
  cy: number;
  r: number;
  cycles: number;
  shift: number;
  lo: number;
  hi: number;
  label?: string;
  color?: string;
}> = ({ cx, cy, r, cycles, shift, lo, hi, label, color = PALETTE.cyan }) => {
  const frame = useCurrentFrame();
  const value = osc(frame, cycles, shift, lo, hi);
  const sweep = (value / 100) * Math.PI * 2;
  const end = -Math.PI / 2 + sweep;
  const large = sweep > Math.PI ? 1 : 0;
  const ex = cx + Math.cos(end) * r;
  const ey = cy + Math.sin(end) * r;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={PALETTE.cyanDeep} strokeWidth={9} opacity={0.5} />
      <path
        d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0.9}
      />
      <Num x={cx} y={cy + r * 0.16} size={r * 0.46} anchor="middle" opacity={0.92}>
        {`${Math.round(value)}%`}
      </Num>
      {label ? (
        <Label x={cx} y={cy + r + 34} size={20} anchor="middle" opacity={0.6}>
          {label}
        </Label>
      ) : null}
    </g>
  );
};

/** Horizontal bar meter with a moving fill. */
export const BarMeter: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  cycles: number;
  shift: number;
  color?: string;
  label?: string;
}> = ({ x, y, w, h = 13, cycles, shift, color = PALETTE.cyan, label }) => {
  const frame = useCurrentFrame();
  const f = osc(frame, cycles, shift, 0.18, 0.94);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={PALETTE.cyanDeep} opacity={0.5} rx={2} />
      <rect x={x} y={y} width={w * f} height={h} fill={color} opacity={0.85} rx={2} />
      {label ? (
        <Label x={x} y={y - 12} size={19} opacity={0.5}>
          {label}
        </Label>
      ) : null}
    </g>
  );
};

/**
 * A matrix of small squares with a handful lit brighter than the rest. The
 * highlight walks a fixed pseudo-random order, so it looks like activity
 * rather than a raster scan, and returns to frame 0's state exactly.
 */
export const GridBlock: React.FC<{
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell: number;
  gap: number;
  seed: number;
  cycles: number;
}> = ({ x, y, cols, rows, cell, gap, seed, cycles }) => {
  const frame = useCurrentFrame();
  const total = cols * rows;
  const rank = React.useMemo(() => {
    const order = buildOrder(seed, total);
    const out = new Array<number>(total);
    order.forEach((cellIndex, position) => {
      out[cellIndex] = position;
    });
    return out;
  }, [seed, total]);

  return (
    <g>
      {Array.from({ length: total }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const lit = pulse(frame, cycles, rank[i] / total, 0.16);
        return (
          <rect
            key={i}
            x={x + col * (cell + gap)}
            y={y + row * (cell + gap)}
            width={cell}
            height={cell}
            fill={PALETTE.cyan}
            opacity={0.16 + lit * 0.78}
          />
        );
      })}
    </g>
  );
};
