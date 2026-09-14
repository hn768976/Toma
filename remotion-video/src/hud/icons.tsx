import React from "react";
import { useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { type Box } from "./primitives";
import { noise1d } from "./rng";

/**
 * Wind turbine with a slowly turning rotor - the reference's hero pictogram.
 *
 * It sizes itself from the box it is given rather than from a hand-tuned
 * height, so the swept circle of the blades is always fully inside its housing
 * no matter how the panel is laid out. The rotor is the constraint: it needs a
 * full diameter of width and, stacked above the tower, roughly two thirds of
 * the height.
 */
export const Turbine: React.FC<{
  box: Box;
  /** Rotor revolutions per minute. */
  rpm?: number;
  /** Fraction of the box kept clear around the pictogram. */
  inset?: number;
}> = ({ box, rpm = 11, inset = 0.08 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();

  const padX = box.w * inset;
  const padY = box.h * inset;
  const innerW = box.w - padX * 2;
  const innerH = box.h - padY * 2;

  // The rotor must fit the width and leave at least a third of the height for
  // the tower; whichever limit bites first sets the blade length.
  const bladeLength = Math.min(innerW / 2, innerH * 0.33);
  const cx = box.x + box.w / 2;
  const hubY = box.y + padY + bladeLength;
  const baseY = box.y + box.h - padY;
  const towerHeight = baseY - hubY;
  const rotation = (frame / 30) * rpm * 6;

  return (
    <g>
      {/* Tower - tapered so it does not read as a plain stick. */}
      <path
        d={`M ${cx - towerHeight * 0.035} ${baseY} L ${cx - towerHeight * 0.013} ${hubY} L ${cx + towerHeight * 0.013} ${hubY} L ${cx + towerHeight * 0.035} ${baseY} Z`}
        fill={theme.mid}
        opacity={0.55}
        stroke={theme.bright}
        strokeWidth={1.2}
      />
      <line
        x1={cx - towerHeight * 0.1}
        y1={baseY}
        x2={cx + towerHeight * 0.1}
        y2={baseY}
        stroke={theme.bright}
        strokeWidth={1.6}
      />
      <g transform={`rotate(${rotation} ${cx} ${hubY})`}>
        {[0, 120, 240].map((a) => (
          <path
            key={a}
            transform={`rotate(${a} ${cx} ${hubY})`}
            d={`M ${cx - bladeLength * 0.028} ${hubY} L ${cx - bladeLength * 0.052} ${hubY - bladeLength * 0.6} L ${cx} ${hubY - bladeLength} L ${cx + bladeLength * 0.022} ${hubY - bladeLength * 0.58} L ${cx + bladeLength * 0.028} ${hubY} Z`}
            fill={theme.mid}
            opacity={0.45}
            stroke={theme.bright}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        ))}
      </g>
      <circle cx={cx} cy={hubY} r={Math.max(3, bladeLength * 0.055)} fill={theme.hot} />
    </g>
  );
};

/** Segmented battery whose charge creeps up and holds. */
export const Battery: React.FC<{
  box: Box;
  segments?: number;
  seed?: string;
}> = ({ box, segments = 8, seed = "battery" }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const level = 0.45 + noise1d(seed, frame / 120) * 0.5;
  const filled = Math.max(1, Math.round(level * segments));
  const slot = box.w / segments;
  const capW = box.w * 0.035;

  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="none"
        stroke={theme.bright}
        strokeWidth={2}
      />
      <rect
        x={box.x + box.w + 3}
        y={box.y + box.h * 0.28}
        width={capW}
        height={box.h * 0.44}
        fill={theme.bright}
      />
      {Array.from({ length: segments }, (_, i) => (
        <rect
          key={i}
          x={box.x + i * slot + slot * 0.14}
          y={box.y + box.h * 0.14}
          width={slot * 0.72}
          height={box.h * 0.72}
          fill={i < filled ? theme.bright : theme.hairline}
          opacity={i < filled ? 0.95 : 0.5}
        />
      ))}
    </g>
  );
};

/** Meshing gears - a pure texture element in the console's lower corners. */
export const Gear: React.FC<{
  cx: number;
  cy: number;
  r: number;
  teeth?: number;
  rpm?: number;
  opacity?: number;
}> = ({ cx, cy, r, teeth = 12, rpm = 4, opacity = 0.5 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const rotation = (frame / 30) * rpm * 6;
  const inner = r * 0.8;
  const toothW = (Math.PI * 2) / teeth / 2.6;

  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const pts = [
      [a0 - toothW, inner],
      [a0 - toothW * 0.62, r],
      [a0 + toothW * 0.62, r],
      [a0 + toothW, inner],
      [a0 + (Math.PI * 2) / teeth - toothW, inner],
    ] as const;
    pts.forEach(([a, rad], j) => {
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      d += `${i === 0 && j === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
  }
  d += "Z";

  return (
    <g transform={`rotate(${rotation} ${cx} ${cy})`} opacity={opacity}>
      <path d={d} fill="none" stroke={theme.mid} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r * 0.34} fill="none" stroke={theme.mid} strokeWidth={2} />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r * 0.34}
            y1={cy + Math.sin(a) * r * 0.34}
            x2={cx + Math.cos(a) * inner}
            y2={cy + Math.sin(a) * inner}
            stroke={theme.mid}
            strokeWidth={1.4}
          />
        );
      })}
    </g>
  );
};

/** Plug-and-leaf mark that sits under the turbine as the section's sign-off. */
export const PlugMark: React.FC<{ cx: number; cy: number; size: number }> = ({
  cx,
  cy,
  size,
}) => {
  const theme = useTheme();
  const w = size;
  const h = size * 0.78;

  return (
    <g stroke={theme.bright} strokeWidth={2} fill="none" strokeLinecap="round">
      <path d={`M ${cx - w * 0.34} ${cy - h * 0.5} L ${cx - w * 0.34} ${cy + h * 0.18}`} />
      <path d={`M ${cx + w * 0.02} ${cy - h * 0.5} L ${cx + w * 0.02} ${cy + h * 0.18}`} />
      <rect
        x={cx - w * 0.48}
        y={cy + h * 0.18}
        width={w * 0.62}
        height={h * 0.42}
        fill={theme.bright}
        opacity={0.85}
        stroke="none"
      />
      <path d={`M ${cx - w * 0.17} ${cy + h * 0.6} L ${cx - w * 0.17} ${cy + h * 0.85}`} />
      <path
        d={`M ${cx + w * 0.2} ${cy + h * 0.1} q ${w * 0.4} ${-h * 0.1} ${w * 0.42} ${-h * 0.55} q ${-w * 0.46} ${h * 0.05} ${-w * 0.42} ${h * 0.55} Z`}
        fill={theme.mid}
        opacity={0.55}
      />
    </g>
  );
};
