import React from "react";
import { gearPath } from "./geometry";

// ---------------------------------------------------------------------------
// Line icons, drawn from scratch for this project.
//
// NO ICON LIBRARY IS USED ANYWHERE IN THIS COMPOSITION. Every glyph below is
// an original path authored here. Most icon sets carry attribution or licence
// terms that are incompatible with selling rendered output, so importing one
// would make the clip unsaleable.
//
// All nine are drawn on the same 100 x 100 grid with a single uniform stroke
// weight, round caps and round joins, so they sit on a consistent optical
// grid when tiled into the icon cluster.
// ---------------------------------------------------------------------------

export type IconPart =
  | { k: "path"; d: string; fill?: boolean }
  | { k: "circle"; cx: number; cy: number; r: number; fill?: boolean }
  | { k: "rect"; x: number; y: number; w: number; h: number; rx: number }
  | { k: "ellipse"; cx: number; cy: number; rx: number; ry: number };

export type IconDef = { name: string; parts: IconPart[] };

export const ICONS: IconDef[] = [
  {
    name: "microphone",
    parts: [
      { k: "rect", x: 39, y: 13, w: 22, h: 44, rx: 11 },
      { k: "path", d: "M 30 47 A 20 20 0 0 0 70 47" },
      { k: "path", d: "M 50 67 L 50 82" },
      { k: "path", d: "M 37 82 L 63 82" },
    ],
  },
  {
    name: "image",
    parts: [
      { k: "rect", x: 15, y: 22, w: 70, h: 56, rx: 6 },
      { k: "circle", cx: 35, cy: 40, r: 6 },
      { k: "path", d: "M 19 70 L 40 49 L 54 62 L 66 52 L 81 67" },
    ],
  },
  {
    name: "gear",
    parts: [
      { k: "path", d: gearPath(50, 50, 8, 28, 40) },
      { k: "circle", cx: 50, cy: 50, r: 13 },
    ],
  },
  {
    name: "cloud",
    parts: [
      {
        k: "path",
        d: "M 30 71 A 15 15 0 0 1 31 42 A 21 21 0 0 1 70 39 A 17 17 0 0 1 70 71 Z",
      },
    ],
  },
  {
    name: "lightbulb",
    parts: [
      { k: "circle", cx: 50, cy: 41, r: 22 },
      { k: "path", d: "M 40 59 L 40 73 L 60 73 L 60 59" },
      { k: "path", d: "M 41 80 L 59 80" },
      { k: "path", d: "M 45 87 L 55 87" },
      { k: "path", d: "M 43 40 L 50 50 L 57 40" },
    ],
  },
  {
    name: "person",
    parts: [
      { k: "circle", cx: 50, cy: 33, r: 14 },
      { k: "path", d: "M 22 80 A 28 28 0 0 1 78 80" },
    ],
  },
  {
    name: "globe",
    parts: [
      { k: "circle", cx: 50, cy: 50, r: 31 },
      { k: "ellipse", cx: 50, cy: 50, rx: 13, ry: 31 },
      { k: "path", d: "M 19 50 L 81 50" },
      { k: "path", d: "M 25 33 Q 50 45 75 33" },
      { k: "path", d: "M 25 67 Q 50 55 75 67" },
    ],
  },
  {
    name: "robot",
    parts: [
      { k: "rect", x: 21, y: 31, w: 58, h: 45, rx: 11 },
      { k: "path", d: "M 50 17 L 50 31" },
      { k: "circle", cx: 50, cy: 12, r: 5 },
      { k: "circle", cx: 37, cy: 49, r: 5, fill: true },
      { k: "circle", cx: 63, cy: 49, r: 5, fill: true },
      { k: "path", d: "M 39 64 L 61 64" },
      { k: "path", d: "M 14 45 L 14 60" },
      { k: "path", d: "M 86 45 L 86 60" },
    ],
  },
  {
    name: "chat",
    parts: [
      { k: "rect", x: 15, y: 21, w: 70, h: 47, rx: 11 },
      { k: "path", d: "M 35 68 L 31 85 L 52 68" },
      { k: "circle", cx: 35, cy: 45, r: 4, fill: true },
      { k: "circle", cx: 50, cy: 45, r: 4, fill: true },
      { k: "circle", cx: 65, cy: 45, r: 4, fill: true },
    ],
  },
];

/**
 * Renders one icon into a `size` x `size` box with its top-left at (x, y).
 * `stroke` is in the caller's user units and is converted to the icon's own
 * 100-unit grid, so line weight stays optically constant at any icon size.
 */
export const Icon: React.FC<{
  def: IconDef;
  x: number;
  y: number;
  size: number;
  color: string;
  stroke: number;
  opacity: number;
}> = ({ def, x, y, size, color, stroke, opacity }) => {
  const s = size / 100;
  const sw = stroke / s;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={opacity}
    >
      {def.parts.map((p, i) => {
        if (p.k === "path")
          return <path key={i} d={p.d} fill={p.fill ? color : "none"} />;
        if (p.k === "circle")
          return (
            <circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill={p.fill ? color : "none"}
              stroke={p.fill ? "none" : color}
            />
          );
        if (p.k === "ellipse")
          return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />;
        return (
          <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} />
        );
      })}
    </g>
  );
};
