import React from "react";
import { useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { MONO, type Box } from "./primitives";
import { noise1d } from "./rng";

/** Wind turbine with a slowly turning rotor - the reference's hero pictogram. */
export const Turbine: React.FC<{
  cx: number;
  /** Ground line: the tower rises from here. */
  baseY: number;
  height: number;
  /** Rotor revolutions per minute. */
  rpm?: number;
}> = ({ cx, baseY, height, rpm = 11 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const hubY = baseY - height;
  const bladeLength = height * 0.52;
  const rotation = (frame / 30) * rpm * 6;

  return (
    <g>
      {/* Tower - tapered so it does not read as a plain stick. */}
      <path
        d={`M ${cx - height * 0.035} ${baseY} L ${cx - height * 0.013} ${hubY} L ${cx + height * 0.013} ${hubY} L ${cx + height * 0.035} ${baseY} Z`}
        fill={theme.mid}
        opacity={0.55}
        stroke={theme.bright}
        strokeWidth={1.2}
      />
      <line
        x1={cx - height * 0.1}
        y1={baseY}
        x2={cx + height * 0.1}
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
      <circle cx={cx} cy={hubY} r={height * 0.035} fill={theme.hot} />
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

/** Solar array pictogram, used in place of the turbine in the second layout. */
export const SolarArray: React.FC<{ box: Box }> = ({ box }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const shimmer = noise1d("solar", frame / 20);
  const cols = 4;
  const rows = 3;
  const cellW = box.w / cols;
  const cellH = (box.h * 0.62) / rows;

  return (
    <g>
      {/* Panels sheared about their own centre so the array reads as tilted
          towards the sun without drifting out of its housing. */}
      <g transform={`translate(${box.x} ${box.y}) skewX(-12) translate(${-box.x} ${-box.y})`}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const lit = (col + row + Math.floor(frame / 14)) % 5 === 0;
          return (
            <rect
              key={i}
              x={box.x + col * cellW + 2}
              y={box.y + row * cellH + 2}
              width={cellW - 4}
              height={cellH - 4}
              fill={lit ? theme.hot : theme.mid}
              opacity={lit ? 0.55 + shimmer * 0.35 : 0.32}
              stroke={theme.bright}
              strokeWidth={1.1}
            />
          );
        })}
      </g>
      <path
        d={`M ${box.x + box.w * 0.34} ${box.y + box.h * 0.64} L ${box.x + box.w * 0.34} ${box.y + box.h}`}
        stroke={theme.bright}
        strokeWidth={2}
      />
      <line
        x1={box.x + box.w * 0.2}
        y1={box.y + box.h}
        x2={box.x + box.w * 0.48}
        y2={box.y + box.h}
        stroke={theme.bright}
        strokeWidth={2}
      />
    </g>
  );
};

/** Radar-style sweep disc for the blue layout's left cluster. */
export const SweepDisc: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const angle = (frame / 30) * 48;

  return (
    <g>
      {[0.33, 0.66, 1].map((k) => (
        <circle
          key={k}
          cx={cx}
          cy={cy}
          r={r * k}
          fill="none"
          stroke={theme.hairline}
          strokeWidth={1}
        />
      ))}
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={theme.hairline} strokeWidth={1} />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={theme.hairline} strokeWidth={1} />
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <path
          d={`M ${cx} ${cy} L ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx + r * Math.cos(-0.9)} ${cy + r * Math.sin(-0.9)} Z`}
          fill={theme.bright}
          opacity={0.18}
        />
        <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke={theme.hot} strokeWidth={1.4} />
      </g>
      <text
        x={cx}
        y={cy + r + 14}
        fill={theme.bright}
        fontSize={9}
        fontFamily={MONO}
        textAnchor="middle"
        letterSpacing={1.8}
        opacity={0.8}
      >
        GRID SCAN
      </text>
    </g>
  );
};
