import React from "react";

// Skull and crossbones, drawn for this project. 100 x 100 box.
// One even-odd path cuts the eyes, nose and tooth gaps out of the head.
const HEAD =
  "M50 13 C67 13 78 25 78 40 C78 49 73 54.5 66.5 57.5 L66.5 66 C66.5 70.5 63.5 73 59 73 L41 73 C36.5 73 33.5 70.5 33.5 66 L33.5 57.5 C27 54.5 22 49 22 40 C22 25 33 13 50 13 Z " +
  "M32.8 41 a7.2 7.2 0 1 0 14.4 0 a7.2 7.2 0 1 0 -14.4 0 Z " +
  "M52.8 41 a7.2 7.2 0 1 0 14.4 0 a7.2 7.2 0 1 0 -14.4 0 Z " +
  "M50 49.5 L46.2 57 L53.8 57 Z " +
  "M42.6 62.5 h2.6 v7.5 h-2.6 Z M48.7 62.5 h2.6 v7.5 h-2.6 Z M54.8 62.5 h2.6 v7.5 h-2.6 Z";

// A bone from (x1,y1) to (x2,y2): a rounded shaft plus two knobs per end.
const bone = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const knobs = [
    [x1, y1, -1],
    [x2, y2, 1],
  ].flatMap(([x, y, s]) =>
    [-1, 1].map((side) => ({
      cx: x + px * 4.2 * side + ux * 1.5 * s,
      cy: y + py * 4.2 * side + uy * 1.5 * s,
    })),
  );
  return { x1, y1, x2, y2, knobs };
};
const BONES = [bone(17, 66, 83, 92), bone(17, 92, 83, 66)];

export const SkullShape: React.FC<{ color: string }> = ({ color }) => (
  <g fill={color}>
    {BONES.map((b, i) => (
      <g key={i}>
        <line
          x1={b.x1}
          y1={b.y1}
          x2={b.x2}
          y2={b.y2}
          stroke={color}
          strokeWidth={7.5}
          strokeLinecap="round"
        />
        {b.knobs.map((k, j) => (
          <circle key={j} cx={k.cx} cy={k.cy} r={4.8} />
        ))}
      </g>
    ))}
    <path d={HEAD} fillRule="evenodd" />
  </g>
);
