import React from "react";
import { FONT_FAMILY } from "./load-fonts";
import { HALF, layerById, LayerId } from "./scene/layers";
import {
  explodeAmount,
  getCamera,
  HEIGHT,
  labelOpacity,
  project,
  Variant,
  WIDTH,
} from "./timeline";

const INK = "#1c1c1e";
const U = HEIGHT / 432; // reference pixels -> composition pixels

/** Right-hand callouts: [text, layer, position inside layer 0..1, stagger]. */
const CALLOUTS: [string, LayerId, number, number][] = [
  ["Stratum Corneum", "corneum", 0.5, 0],
  ["Squamous Cells", "squamous", 0.5, 1],
  ["Basal Cells", "basal", 0.5, 2],
  ["Hair Follicle", "dermis", 0.97, 3],
  ["Sweat Pore", "dermis", 0.68, 4],
  ["Dermis", "dermis", 0.3, 5],
  ["Adipose Layer", "hypodermis", 0.45, 6],
];

/** Left-hand groups: [text, top layer, bottom layer, stagger]. */
const GROUPS: [string, LayerId, LayerId, number][] = [
  ["Epidermis", "corneum", "basal", 1],
  ["Dermis", "dermis", "dermis", 3],
  ["Hypodermis", "hypodermis", "hypodermis", 5],
  ["Muscle", "muscle", "muscle", 6],
];

export const Labels: React.FC<{ t: number; variant: Variant }> = ({
  t,
  variant,
}) => {
  const cam = getCamera(t, variant);
  const e = explodeAmount(t);
  const yOf = (id: LayerId, k: number) => {
    const l = layerById(id);
    return l.y0 + (l.y1 - l.y0) * k + l.offset * e;
  };

  // ---- right callouts, anchored on the right-hand silhouette edge ----
  const textX = 572 * U;
  const minGap = 15.5 * U;
  let prevY = -Infinity;
  const callouts = CALLOUTS.map(([text, id, k, idx]) => {
    const a = project(cam, HALF, yOf(id, k), -HALF);
    const y = Math.max(a.y, prevY + minGap);
    prevY = y;
    return { text, ax: a.x + 3.5 * U, ay: a.y, y, o: labelOpacity(t, idx) };
  });

  // ---- left brackets, anchored on the left-hand silhouette edge ----
  const tickYs = GROUPS.map(([, topId], i) => {
    if (i === 0) return project(cam, -HALF, yOf(topId, 1), HALF).y;
    const above = GROUPS[i - 1][2];
    const y = (yOf(above, 0) + yOf(topId, 1)) / 2;
    return project(cam, -HALF, y, HALF).y;
  });
  tickYs.push(project(cam, -HALF, yOf("muscle", 0), HALF).y);
  const railX = 190 * U;
  const tickX = 160 * U;
  const stroke = 0.9 * U;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ position: "absolute", inset: 0 }}
    >
      {callouts.map((c) => {
        const elbowX = textX - 26 * U;
        return (
          <g key={c.text} opacity={c.o}>
            <circle cx={c.ax} cy={c.ay} r={1.9 * U} fill={INK} />
            <polyline
              points={`${c.ax},${c.ay} ${elbowX},${c.y} ${elbowX + (14 * U) * c.o},${c.y}`}
              fill="none"
              stroke={INK}
              strokeWidth={stroke * 0.8}
              strokeLinejoin="round"
              opacity={0.75}
            />
            <text
              x={textX - 6 * U + 6 * U * c.o}
              y={c.y}
              dominantBaseline="central"
              fontFamily={FONT_FAMILY}
              fontWeight={500}
              fontSize={11.6 * U}
              fill={INK}
            >
              {c.text}
            </text>
          </g>
        );
      })}
      {GROUPS.map(([text, , , idx], i) => {
        const o = labelOpacity(t, idx);
        const y0 = tickYs[i];
        const y1 = tickYs[i + 1];
        const first = i === 0;
        return (
          <g key={text} opacity={o}>
            <path
              d={
                (first ? `M ${tickX} ${y0} L ${railX} ${y0} ` : `M ${railX} ${y0} `) +
                `L ${railX} ${y0 + (y1 - y0) * o} ` +
                (o > 0.98 ? `M ${tickX} ${y1} L ${railX} ${y1}` : "")
              }
              fill="none"
              stroke={INK}
              strokeWidth={stroke}
            />
            <text
              x={141 * U}
              y={(y0 + y1) / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontFamily={FONT_FAMILY}
              fontWeight={700}
              fontSize={11.6 * U}
              fill={INK}
            >
              {text}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
