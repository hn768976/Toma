import React from "react";
import { useCurrentFrame } from "remotion";
import { revealAt } from "../animation";
import { FONT_MONO } from "../constants";
import { mulberry32 } from "../random";

export type ArcRailProps = {
  // Centre of the imaginary circle the rail is bent around. Placing it
  // far below the frame gives the gentle bow the reference has.
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  count: number;
  seed: number;
  barColor?: string;
  maxBarHeight?: number;
  railColors?: string[];
  labels?: string[];
  appearAt?: number;
  drawDuration?: number;
  opacity?: number;
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
};

// A histogram bent around a circle, with rails running along it. This is
// what gives version 3 its curved-terminal look: the bars stay upright
// relative to the arc, so the whole strip appears to wrap away from the
// camera.
export const ArcRail: React.FC<ArcRailProps> = ({
  cx,
  cy,
  radius,
  startAngle,
  endAngle,
  count,
  seed,
  barColor = "#2f9fe0",
  maxBarHeight = 220,
  railColors = ["#f07a3c", "#dfeaf7"],
  labels,
  appearAt = 0,
  drawDuration = 150,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const span = endAngle - startAngle;
  const rand = mulberry32(seed * 2237 + 23);

  let level = 0.4;
  const bars = Array.from({ length: count }, () => {
    level += (rand() - 0.47) * 0.26;
    level = Math.min(1, Math.max(0.1, level));
    return { height: level, phase: rand() * Math.PI * 2 };
  });

  const perBar = drawDuration / (count + 20);
  const barAngularWidth = (span / count) * 0.62;

  return (
    <g opacity={opacity}>
      {railColors.map((color, i) => (
        <path
          key={color}
          d={arcPath(cx, cy, radius - i * 16 - 10, startAngle, endAngle)}
          fill="none"
          stroke={color}
          strokeWidth={i === 0 ? 5 : 3}
          opacity={i === 0 ? 0.9 : 0.55}
        />
      ))}
      {bars.map((bar, i) => {
        const grow = revealAt(frame, appearAt + i * perBar, perBar * 18);
        if (grow <= 0) {
          return null;
        }
        const angle = startAngle + ((i + 0.5) / count) * span;
        const breathe = 1 + Math.sin(frame * 0.1 + bar.phase) * 0.07 * grow;
        const h = bar.height * maxBarHeight * grow * breathe;
        const inner = polar(cx, cy, radius, angle);
        const halfW = (barAngularWidth * Math.PI * radius) / 360;
        // Rotate a plain rect into place rather than building a wedge -
        // at these bar widths the difference is invisible and the rect
        // keeps the crisp vertical edges the reference bars have.
        return (
          <rect
            key={i}
            x={-halfW}
            y={-h}
            width={halfW * 2}
            height={h}
            fill={barColor}
            opacity={0.85}
            transform={`translate(${inner.x.toFixed(2)},${inner.y.toFixed(2)}) rotate(${(angle + 90).toFixed(2)})`}
          />
        );
      })}
      {labels ? (
        <g
          fontFamily={FONT_MONO}
          fontSize={26}
          fill="rgba(190, 220, 250, 0.75)"
          textAnchor="middle"
        >
          {labels.map((label, i) => {
            const angle = startAngle + ((i + 0.5) / labels.length) * span;
            const p = polar(cx, cy, radius - 58, angle);
            return (
              <text
                key={`${label}-${i}`}
                x={0}
                y={0}
                transform={`translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${(angle + 90).toFixed(2)})`}
              >
                {label}
              </text>
            );
          })}
        </g>
      ) : null}
    </g>
  );
};
