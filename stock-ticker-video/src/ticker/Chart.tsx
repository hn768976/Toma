import React from "react";
import { SESSION_OPEN_MINUTES, SESSION_POINTS } from "./constants";
import {
  buildPaths,
  revealedLength,
  type Layout,
  type PlayheadState,
  type Scale,
} from "./geometry";
import { hourLabel } from "./series";
import type { Palette } from "./themes";

const HOURS = [10, 11, 12, 13, 14, 15];

/** Index into the session for a wall-clock hour, clamped to the session. */
const hourIndex = (hour: number): number =>
  Math.min(SESSION_POINTS - 1, Math.max(0, hour * 60 - SESSION_OPEN_MINUTES));

export const Chart: React.FC<{
  values: number[];
  prevClose: number;
  scale: Scale;
  layout: Layout;
  palette: Palette;
  head: PlayheadState;
  fontFamily: string;
}> = ({ values, prevClose, scale, layout, palette, head, fontFamily }) => {
  const { unit, plotLeft, plotRight, plotTop, plotBottom } = layout;
  const paths = React.useMemo(
    () => buildPaths(values, scale, layout),
    [values, scale, layout],
  );

  const drawn = revealedLength(head, paths.lengths);
  const strokeWidth = 5 * unit;
  const closeY = scale.y(prevClose);
  const gridRows = 5;

  return (
    <svg
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <linearGradient id="seriesFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.fillTop} />
          <stop offset="100%" stopColor={palette.fillBottom} />
        </linearGradient>
        {/* The fill is clipped to the playhead, so it can never run ahead
            of the stroke the dash reveal is drawing. */}
        <clipPath id="sweptFill">
          <rect
            x={plotLeft}
            y={plotTop - 40 * unit}
            width={Math.max(0, head.x - plotLeft)}
            height={plotBottom - plotTop + 40 * unit}
          />
        </clipPath>
      </defs>

      {/* Gridlines and the time axis are chrome: present from frame 0. */}
      {Array.from({ length: gridRows + 1 }, (_, i) => {
        const y = plotTop + (i / gridRows) * (plotBottom - plotTop);
        return (
          <line
            key={`h${i}`}
            x1={plotLeft}
            x2={plotRight}
            y1={y}
            y2={y}
            stroke={i === gridRows ? palette.gridStrong : palette.grid}
            strokeWidth={unit * (i === gridRows ? 2 : 1.6)}
          />
        );
      })}
      {HOURS.map((hour) => (
        <line
          key={`v${hour}`}
          x1={scale.x(hourIndex(hour))}
          x2={scale.x(hourIndex(hour))}
          y1={plotTop}
          y2={plotBottom}
          stroke={palette.grid}
          strokeWidth={unit * 1.6}
        />
      ))}

      {/* Previous close. */}
      <line
        x1={plotLeft}
        x2={plotRight}
        y1={closeY}
        y2={closeY}
        stroke={palette.textDim}
        strokeWidth={unit * 2}
        strokeDasharray={`${unit * 5} ${unit * 9}`}
      />

      <g clipPath="url(#sweptFill)">
        <path d={paths.area} fill="url(#seriesFill)" />
      </g>

      {/* The whole session sits dim ahead of the playhead... */}
      <path
        d={paths.line}
        fill="none"
        stroke={palette.accentDim}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* ...and lights up behind it. */}
      <path
        d={paths.line}
        fill="none"
        stroke={palette.accent}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={`${drawn} ${paths.totalLength + 1}`}
        style={
          palette.glow
            ? { filter: `drop-shadow(0 0 ${9 * unit}px ${palette.accent})` }
            : undefined
        }
      />

      {/* Session open marker. */}
      <circle
        cx={scale.x(0)}
        cy={scale.y(values[0])}
        r={13 * unit}
        fill={palette.accent}
      />

      {/* Playhead. */}
      <line
        x1={head.x}
        x2={head.x}
        y1={plotTop - 90 * unit}
        y2={plotBottom + 26 * unit}
        stroke={palette.accent}
        strokeWidth={unit * 4.5}
        style={
          palette.glow
            ? { filter: `drop-shadow(0 0 ${12 * unit}px ${palette.accent})` }
            : undefined
        }
      />
      <circle cx={head.x} cy={head.y} r={22 * unit} fill={palette.accent} opacity={0.22} />
      <circle cx={head.x} cy={head.y} r={13 * unit} fill={palette.accent} />

      {HOURS.map((hour) => (
        <text
          key={`t${hour}`}
          x={scale.x(hourIndex(hour))}
          y={plotBottom + 58 * unit}
          fill={palette.text}
          fontFamily={fontFamily}
          fontSize={38 * unit}
          fontWeight={500}
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          {hourLabel(hour)}
        </text>
      ))}
    </svg>
  );
};
