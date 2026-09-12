import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { saw } from "../anim";
import { rngFor } from "../random";
import { FONT_MONO, FONT_UI, type HudTheme } from "../theme";
import { NODE_WORDS, STATUS_WORDS } from "../text";

// A column of channel labels whose end-dots fan into one or two hub
// nodes, mirroring the wire-harness motif down both sides of the
// reference. The fan lines are quadratic curves aimed at the hub so the
// bundle reads as a harness rather than a starburst.
export const ChannelHarness: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  rows?: number;
  rowHeight?: number;
  labelWidth?: number;
  /** -1 fans the harness to the left, +1 to the right */
  direction?: 1 | -1;
  seed: string;
}> = ({
  theme,
  x,
  y,
  rows = 18,
  rowHeight = 16,
  labelWidth = 96,
  direction = 1,
  seed,
}) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:harness`);
    const items = Array.from({ length: rows }, (_, i) => ({
      label: `${NODE_WORDS[Math.floor(rand() * NODE_WORDS.length)]}-${(i + 1).toString().padStart(2, "0")}`,
      filled: rand() > 0.45,
      hub: rand() > 0.5 ? 1 : 0,
      // a stable per-row offset into the pulse cycle
      pulse: rand(),
    }));
    const hubs = [
      { x: direction * (labelWidth + 78), y: rowHeight * rows * 0.3 },
      { x: direction * (labelWidth + 78), y: rowHeight * rows * 0.72 },
    ];
    return { items, hubs };
  }, [seed, rows, rowHeight, labelWidth, direction]);

  const anchorX = direction === 1 ? labelWidth + 8 : -8;

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.items.map((item, i) => {
        const ry = i * rowHeight;
        const hub = model.hubs[item.hub];
        const midX = (anchorX + hub.x) / 2;
        return (
          <g key={i}>
            <path
              d={`M${anchorX} ${ry}Q${midX} ${ry} ${hub.x} ${hub.y}`}
              fill="none"
              stroke={theme.lineFaint}
              strokeWidth={1.2}
            />
            <text
              x={direction === 1 ? 0 : 0}
              y={ry + 3.5}
              textAnchor={direction === 1 ? "start" : "end"}
              fontFamily={FONT_MONO}
              fontSize={11}
              fill={theme.textDim}
              letterSpacing={0.4}
            >
              {item.label}
            </text>
            <circle
              cx={anchorX}
              cy={ry}
              r={3.2}
              fill={item.filled ? theme.line : "none"}
              stroke={theme.lineSoft}
              strokeWidth={1.2}
            />
          </g>
        );
      })}
      {model.hubs.map((hub, i) => {
        // Each hub chip holds a status word that swaps twice per loop.
        const phase = saw(frame, 2, i * 0.5);
        const word = STATUS_WORDS[(Math.floor(phase * 4) + i * 3) % STATUS_WORDS.length];
        const chipX = direction === 1 ? hub.x + 10 : hub.x - 58;
        return (
          <g key={`hub-${i}`}>
            <circle cx={hub.x} cy={hub.y} r={5.5} fill={theme.line} />
            <rect
              x={chipX}
              y={hub.y - 8}
              width={48}
              height={16}
              rx={2}
              fill={theme.chipFill}
            />
            <text
              x={chipX + 24}
              y={hub.y + 4}
              textAnchor="middle"
              fontFamily={FONT_UI}
              fontWeight={600}
              fontSize={11}
              fill={theme.chipText}
              letterSpacing={0.8}
            >
              {word}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Compact key/value telemetry rows with a live-looking value column.
export const Readouts: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  rows?: number;
  width?: number;
  rowHeight?: number;
  seed: string;
}> = ({ theme, x, y, rows = 6, width = 190, rowHeight = 20, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:readouts`);
    return Array.from({ length: rows }, (_, i) => ({
      key: `${NODE_WORDS[Math.floor(rand() * NODE_WORDS.length)]}.${(i + 3).toString(16).toUpperCase()}`,
      cycles: 1 + Math.floor(rand() * 4),
      base: rand(),
    }));
  }, [seed, rows]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.map((row, i) => {
        const v = Math.floor(
          (((saw(frame, row.cycles, row.base) + row.base) % 1) * 4096),
        );
        return (
          <g key={i} transform={`translate(0 ${i * rowHeight})`}>
            <line x1={0} y1={7} x2={width} y2={7} stroke={theme.lineFaint} strokeWidth={1} />
            <text fontFamily={FONT_MONO} fontSize={12} fill={theme.textDim} y={4}>
              {row.key}
            </text>
            <text
              x={width}
              y={4}
              textAnchor="end"
              fontFamily={FONT_MONO}
              fontSize={12}
              fill={theme.text}
            >
              {v.toString(16).toUpperCase().padStart(3, "0")}
            </text>
          </g>
        );
      })}
    </g>
  );
};
