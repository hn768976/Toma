import React, { useMemo } from "react";
import { rgba } from "./constants";

// A seven-segment LED display, drawn as SVG polygons rather than loaded as
// a font. The readouts on this kind of broadcast chart are the one element
// a viewer actually reads, and a real segment display gives the mitred
// segment ends and the inter-segment gaps that a "techy" webfont only
// approximates — plus it keeps the render free of any font fetch.

const CELL_W = 100;
const CELL_H = 155;
/** Segment thickness. */
const T = 19;
/** Shrink each segment slightly so neighbours don't touch at the mitres. */
const GAP = 3.2;

type Seg = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const DIGITS: Record<string, Seg[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

/** Horizontal segment: a flattened hexagon with mitred ends. */
const hbar = (x0: number, x1: number, y0: number): string => {
  const h = T / 2;
  const a = x0 + GAP;
  const b = x1 - GAP;
  return `${a + h},${y0} ${b - h},${y0} ${b},${y0 + h} ${b - h},${y0 + T} ${
    a + h
  },${y0 + T} ${a},${y0 + h}`;
};

/** Vertical segment: the same hexagon stood on end. */
const vbar = (x0: number, y0: number, y1: number): string => {
  const h = T / 2;
  const a = y0 + GAP;
  const b = y1 - GAP;
  return `${x0},${a + h} ${x0 + h},${a} ${x0 + T},${a + h} ${x0 + T},${
    b - h
  } ${x0 + h},${b} ${x0},${b - h}`;
};

const MID = (CELL_H - T) / 2;

const SEGMENT_POINTS: Record<Seg, string> = {
  a: hbar(0, CELL_W, 0),
  g: hbar(0, CELL_W, MID),
  d: hbar(0, CELL_W, CELL_H - T),
  f: vbar(0, 0, MID + T),
  b: vbar(CELL_W - T, 0, MID + T),
  e: vbar(0, MID, CELL_H),
  c: vbar(CELL_W - T, MID, CELL_H),
};

/**
 * "Q" has no seven-segment form, so it gets a hand-drawn glyph in the same
 * visual language: a squared-off ring with a mitred tail.
 */
const Q_GLYPH = (() => {
  const w = CELL_W;
  const h = CELL_H;
  const t = T;
  const outer = `M ${t * 0.6},0 L ${w - t * 0.6},0 L ${w},${t * 0.6} L ${w},${
    h - t * 0.6
  } L ${w - t * 0.6},${h} L ${t * 0.6},${h} L 0,${h - t * 0.6} L 0,${t * 0.6} Z`;
  const inner = `M ${t * 1.35},${t} L ${w - t},${t} L ${w - t},${h - t} L ${
    t * 1.35
  },${h - t} L ${t},${h - t * 1.35} L ${t},${t * 1.35} Z`;
  const tail = `M ${w - t * 2.1},${h - t * 1.9} L ${w + t * 0.5},${
    h + t * 0.55
  } L ${w - t * 0.9},${h + t * 0.55} L ${w - t * 3.2},${h - t * 0.6} Z`;
  return { outer, inner, tail };
})();

export type SegmentTextProps = {
  /** Digits, plus "Q" and " " (blank cell). */
  readonly children: string;
  /** Cap height in design px. */
  readonly size: number;
  readonly color: string;
  /** Colour of the unlit segments; omit for none. */
  readonly ghostColor?: string;
  /** Glow radius in design px. 0 disables the bloom. */
  readonly glow?: number;
  readonly opacity?: number;
  readonly style?: React.CSSProperties;
};

export const SegmentText: React.FC<SegmentTextProps> = ({
  children,
  size,
  color,
  ghostColor,
  glow = 0,
  opacity = 1,
  style,
}) => {
  const chars = useMemo(() => children.split(""), [children]);
  // `color` arrives as a hex literal or as an rgb() string from the colour
  // ramps; only the former can be thinned down for the outer halo.
  const halo = color.startsWith("#") ? rgba(color, 0.45) : color;
  const advance = CELL_W + 34;
  const width = chars.length * advance - 34;
  const scale = size / CELL_H;

  return (
    <svg
      viewBox={`-6 -6 ${width + 12} ${CELL_H + 12}`}
      width={width * scale}
      height={size}
      style={{
        overflow: "visible",
        opacity,
        filter: glow
          ? `drop-shadow(0 0 ${glow}px ${color}) drop-shadow(0 0 ${
              glow * 2
            }px ${halo})`
          : undefined,
        ...style,
      }}
    >
      {chars.map((ch, i) => {
        const x = i * advance;
        if (ch === " ") return null;
        if (ch === "Q") {
          return (
            <g key={i} transform={`translate(${x}, 0)`}>
              <path
                d={`${Q_GLYPH.outer} ${Q_GLYPH.inner}`}
                fill={color}
                fillRule="evenodd"
              />
              <path d={Q_GLYPH.tail} fill={color} />
            </g>
          );
        }
        const lit = DIGITS[ch] ?? [];
        // A real seven-segment "1" lights only the right-hand pair, which
        // reads as a gap next to the previous digit. Centre it in its cell.
        const nudge = ch === "1" ? -(CELL_W - T) / 2 : 0;
        return (
          <g key={i} transform={`translate(${x}, 0)`}>
            {ghostColor
              ? (Object.keys(SEGMENT_POINTS) as Seg[]).map((seg) => (
                  <polygon
                    key={seg}
                    points={SEGMENT_POINTS[seg]}
                    fill={ghostColor}
                  />
                ))
              : null}
            <g transform={`translate(${nudge}, 0)`}>
              {lit.map((seg) => (
                <polygon key={seg} points={SEGMENT_POINTS[seg]} fill={color} />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
};

/** Width a SegmentText will occupy, so callers can centre it themselves. */
export const segmentTextWidth = (text: string, size: number): number => {
  const advance = CELL_W + 34;
  return ((text.length * advance - 34) * size) / CELL_H;
};
