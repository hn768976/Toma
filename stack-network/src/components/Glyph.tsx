import React from "react";

/**
 * Icon glyphs, drawn here as plain SVG paths.
 *
 * These are deliberately not from an icon library: a stock clip cannot
 * carry the attribution or licence text those come with, so every shape
 * below is constructed from primitives in a 100x100 box.
 */
export type GlyphName =
  | "globe"
  | "gears"
  | "database"
  | "document"
  | "refresh"
  | "check"
  | "bolt"
  | "search"
  | "chart"
  | "bulb"
  | "cloud"
  | "lock";

/** Vertices of a gear outline: alternating outer and inner radii. */
const gearPath = (cx: number, cy: number, teeth: number, outer: number, inner: number) => {
  const step = Math.PI / teeth;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // Flat-topped teeth: each radius is held across a small arc.
    const a0 = i * step - step * 0.34;
    const a1 = i * step + step * 0.34;
    points.push(`${(cx + Math.cos(a0) * r).toFixed(2)} ${(cy + Math.sin(a0) * r).toFixed(2)}`);
    points.push(`${(cx + Math.cos(a1) * r).toFixed(2)} ${(cy + Math.sin(a1) * r).toFixed(2)}`);
  }
  return `M ${points[0]} ` + points.slice(1).map((p) => `L ${p}`).join(" ") + " Z";
};

const BIG_GEAR = gearPath(41, 44, 8, 26, 18);
const SMALL_GEAR = gearPath(70, 70, 7, 19, 13);

/** Each entry draws inside a 0 0 100 100 viewBox, stroked not filled. */
const GLYPHS: Record<GlyphName, React.ReactNode> = {
  globe: (
    <>
      <circle cx="50" cy="50" r="34" />
      <ellipse cx="50" cy="50" rx="15" ry="34" />
      <path d="M 17 39 H 83 M 17 61 H 83 M 50 16 V 84" />
    </>
  ),
  gears: (
    <>
      <path d={BIG_GEAR} />
      <circle cx="41" cy="44" r="8" />
      <path d={SMALL_GEAR} />
      <circle cx="70" cy="70" r="6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="50" cy="26" rx="30" ry="11" />
      <path d="M 20 26 V 50 C 20 56 33 61 50 61 C 67 61 80 56 80 50 V 26" />
      <path d="M 20 50 V 74 C 20 80 33 85 50 85 C 67 85 80 80 80 74 V 50" />
    </>
  ),
  document: (
    <>
      <path d="M 28 14 H 58 L 74 32 V 86 H 28 Z" />
      <path d="M 58 14 V 32 H 74" />
      <path d="M 38 48 H 64 M 38 60 H 64 M 38 72 H 54" />
    </>
  ),
  refresh: (
    <>
      {/* Open circle with an arrowhead, drawn as an arc plus a chevron. */}
      <path d="M 76 38 A 30 30 0 1 0 79 56" />
      <path d="M 62 36 L 78 39 L 81 22" />
    </>
  ),
  check: <path d="M 24 52 L 43 71 L 78 30" />,
  bolt: <path d="M 57 12 L 30 55 H 48 L 43 88 L 71 44 H 52 Z" />,
  search: (
    <>
      <circle cx="45" cy="44" r="24" />
      <path d="M 62 61 L 82 81" />
    </>
  ),
  chart: (
    <>
      <path d="M 18 78 H 84" />
      <path d="M 24 64 L 42 44 L 56 56 L 80 26" />
      <path d="M 66 26 H 80 V 40" />
    </>
  ),
  bulb: (
    <>
      <path d="M 50 16 C 35 16 24 27 24 41 C 24 52 32 58 36 66 H 64 C 68 58 76 52 76 41 C 76 27 65 16 50 16 Z" />
      <path d="M 40 74 H 60 M 44 84 H 56" />
    </>
  ),
  cloud: (
    <>
      <path d="M 30 70 C 20 70 13 62 13 53 C 13 44 20 37 29 37 C 32 25 43 17 55 17 C 70 17 82 29 82 44 C 88 47 92 54 92 61 C 92 66 88 70 82 70 Z" />
    </>
  ),
  lock: (
    <>
      <rect x="26" y="45" width="48" height="40" rx="6" />
      <path d="M 36 45 V 33 C 36 23 42 16 50 16 C 58 16 64 23 64 33 V 45" />
      <circle cx="50" cy="63" r="5" />
    </>
  ),
};

export const Glyph: React.FC<{
  name: GlyphName;
  size: number;
  color: string;
  strokeWidth: number;
  opacity?: number;
}> = ({ name, size, color, strokeWidth, opacity = 1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={opacity}
    style={{ display: "block", overflow: "visible" }}
  >
    {GLYPHS[name]}
  </svg>
);
