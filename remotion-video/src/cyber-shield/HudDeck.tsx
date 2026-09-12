import React from "react";
import { interpolate } from "remotion";
import { HUD_FADE_FRAMES, HUD_FIRST_IN_FRAME, MONO_FONT } from "./constants";
import { HudItem, getHudItems } from "./hud-layout";
import { seriesValue, tickingDigits } from "./hud-text";
import { seededRandom } from "../shared/random";
import { Theme } from "./theme";

// The instrumentation deck. Items fade and slide in on their own
// staggered schedules so the dashboard assembles itself over the first
// ~13s, the way the reference populates rather than cutting in.

const hexPath = (cx: number, cy: number, r: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(
      `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`,
    );
  }
  return `M ${pts.join(" L ")} Z`;
};

/** Panel frame with the top-right corner clipped, a common HUD motif. */
const framePath = (
  x: number,
  y: number,
  w: number,
  h: number,
  notch = 14,
): string =>
  `M ${x} ${y} L ${x + w - notch} ${y} L ${x + w} ${y + notch} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

type ItemProps = { item: HudItem; theme: Theme; frame: number };

const HudElement: React.FC<ItemProps> = ({ item, theme, frame }) => {
  const { palette } = theme;
  const stroke = palette.hudStroke;
  const soft = palette.hudStrokeSoft;

  switch (item.kind) {
    case "panel": {
      const lines = [];
      const inner = item.h - 16;
      const step = item.lines > 0 ? inner / item.lines : inner;
      for (let i = 0; i < item.lines; i++) {
        const w = (0.28 + seededRandom(i, 81) * 0.62) * (item.w - 24);
        // Every few frames one line "refreshes" and briefly brightens.
        const hot = Math.floor(frame / 9 + i) % 11 === 0;
        lines.push(
          <rect
            key={i}
            x={item.x + 12}
            y={item.y + 12 + i * step}
            width={w}
            height={Math.min(5, step * 0.42)}
            fill={hot ? palette.hudAccent : soft}
            opacity={hot ? 0.9 : 0.5}
          />,
        );
      }
      return (
        <g>
          <path
            d={framePath(item.x, item.y, item.w, item.h)}
            fill={palette.hudFill}
            fillOpacity={palette.hudFillOpacity}
            stroke={stroke}
            strokeWidth={1.4}
            opacity={0.8}
          />
          {lines}
        </g>
      );
    }

    case "matrix": {
      const rows = [];
      const rowH = (item.h - 20) / item.rows;
      const groupW = (item.w - 24) / item.cols;
      for (let r = 0; r < item.rows; r++) {
        const cells = [];
        for (let c = 0; c < item.cols; c++) {
          cells.push(
            <text
              key={c}
              x={item.x + 12 + c * groupW}
              y={item.y + 16 + r * rowH + rowH * 0.6}
              fontSize={Math.min(19, rowH * 0.8)}
              fill={palette.hudText}
              fontFamily={MONO_FONT}
              opacity={0.85}
            >
              {tickingDigits(`${item.id}-${r}-${c}`, frame, 4, 0)}
            </text>,
          );
        }
        rows.push(<g key={r}>{cells}</g>);
      }
      return (
        <g>
          <path
            d={framePath(item.x, item.y, item.w, item.h)}
            fill={palette.hudFill}
            fillOpacity={palette.hudFillOpacity}
            stroke={stroke}
            strokeWidth={1.4}
            opacity={0.85}
          />
          {rows}
        </g>
      );
    }

    case "bars": {
      const bars = [];
      const slot = (item.w - 24) / item.count;
      const maxH = item.h - 28;
      for (let i = 0; i < item.count; i++) {
        const v = seriesValue(item.id, i, frame, 36);
        const h = 6 + v * maxH;
        bars.push(
          <rect
            key={i}
            x={item.x + 12 + i * slot}
            y={item.y + item.h - 14 - h}
            width={slot * 0.62}
            height={h}
            fill={v > 0.78 ? palette.hudAccent : soft}
            opacity={0.55 + v * 0.4}
          />,
        );
      }
      return (
        <g>
          <path
            d={framePath(item.x, item.y, item.w, item.h)}
            fill={palette.hudFill}
            fillOpacity={palette.hudFillOpacity}
            stroke={stroke}
            strokeWidth={1.4}
            opacity={0.85}
          />
          {bars}
        </g>
      );
    }

    case "line": {
      const points: string[] = [];
      const steps = 34;
      const maxH = item.h - 30;
      for (let i = 0; i <= steps; i++) {
        const v = seriesValue(item.id, i, frame, 52);
        // A gentle upward bias so the trace reads as a rising trend.
        const biased = Math.min(1, v * 0.6 + (i / steps) * 0.55);
        const x = item.x + 12 + ((item.w - 24) * i) / steps;
        const y = item.y + item.h - 15 - biased * maxH;
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const grid = [];
      for (let i = 1; i < 4; i++) {
        const y = item.y + (item.h * i) / 4;
        grid.push(
          <line
            key={i}
            x1={item.x + 8}
            y1={y}
            x2={item.x + item.w - 8}
            y2={y}
            stroke={soft}
            strokeWidth={0.8}
            opacity={0.3}
          />,
        );
      }
      return (
        <g>
          <path
            d={framePath(item.x, item.y, item.w, item.h)}
            fill={palette.hudFill}
            fillOpacity={palette.hudFillOpacity}
            stroke={stroke}
            strokeWidth={1.4}
            opacity={0.85}
          />
          {grid}
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke={palette.hudAccent}
            strokeWidth={2.2}
            strokeLinejoin="round"
            opacity={0.95}
          />
        </g>
      );
    }

    case "hex": {
      // A slow bob keeps the floating hexes from feeling pasted on.
      const bob = Math.sin(frame * 0.02 + item.x * 0.01) * 4;
      return (
        <g transform={`translate(0 ${bob.toFixed(2)})`}>
          <path
            d={hexPath(item.x, item.y, item.r)}
            fill={item.filled ? palette.hudFill : "none"}
            fillOpacity={item.filled ? palette.hudFillOpacity + 0.2 : 0}
            stroke={stroke}
            strokeWidth={1.6}
            opacity={0.62}
          />
          {item.filled ? (
            <path
              d={hexPath(item.x, item.y, item.r * 0.62)}
              fill="none"
              stroke={palette.hudAccent}
              strokeWidth={1.2}
              opacity={0.5}
            />
          ) : null}
        </g>
      );
    }

    case "gauge": {
      const spin = frame * 0.5;
      const ticks = [];
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI / 12) * i;
        const r1 = item.r * 0.74;
        const r2 = item.r * (i % 6 === 0 ? 0.94 : 0.86);
        ticks.push(
          <line
            key={i}
            x1={item.x + Math.cos(a) * r1}
            y1={item.y + Math.sin(a) * r1}
            x2={item.x + Math.cos(a) * r2}
            y2={item.y + Math.sin(a) * r2}
            stroke={soft}
            strokeWidth={i % 6 === 0 ? 2.2 : 1.2}
            opacity={0.6}
          />,
        );
      }
      const arcLen = 2 * Math.PI * item.r * 0.56;
      return (
        <g>
          <circle
            cx={item.x}
            cy={item.y}
            r={item.r}
            fill={palette.hudFill}
            fillOpacity={palette.hudFillOpacity}
            stroke={stroke}
            strokeWidth={1.4}
            opacity={0.8}
          />
          {ticks}
          <circle
            cx={item.x}
            cy={item.y}
            r={item.r * 0.56}
            fill="none"
            stroke={palette.hudAccent}
            strokeWidth={3}
            strokeDasharray={`${(arcLen * 0.22).toFixed(1)} ${(arcLen * 0.11).toFixed(1)}`}
            opacity={0.85}
            transform={`rotate(${spin.toFixed(2)} ${item.x} ${item.y})`}
          />
          <circle
            cx={item.x}
            cy={item.y}
            r={item.r * 0.26}
            fill={soft}
            opacity={0.45}
          />
        </g>
      );
    }

    case "hatch": {
      const lines = [];
      const step = 9;
      for (let x = 0; x < item.w + item.h; x += step) {
        const x1 = item.x + x;
        const y1 = item.y;
        const x2 = item.x + x - item.h;
        const y2 = item.y + item.h;
        // Clipped by the enclosing rect below.
        lines.push(
          <line
            key={x}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={soft}
            strokeWidth={1.6}
          />,
        );
      }
      const clipId = `${item.id}-hatch-clip`;
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <rect x={item.x} y={item.y} width={item.w} height={item.h} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`} opacity={0.45}>
            {lines}
          </g>
          <rect
            x={item.x}
            y={item.y}
            width={item.w}
            height={item.h}
            fill="none"
            stroke={stroke}
            strokeWidth={1.2}
            opacity={0.5}
          />
        </g>
      );
    }

    case "ticker":
      return (
        <text
          x={item.x}
          y={item.y}
          fontSize={item.size}
          fill={palette.hudText}
          fontFamily={MONO_FONT}
          letterSpacing={item.size * 0.12}
          opacity={0.9}
        >
          {tickingDigits(item.id, frame, item.length)}
        </text>
      );

    case "chips": {
      const chips = [];
      for (let i = 0; i < item.count; i++) {
        const cx = item.x + i * (item.r * 2.5);
        const v = Math.floor(seriesValue(item.id, i, frame, 40) * 100);
        chips.push(
          <g key={i}>
            <circle
              cx={cx}
              cy={item.y}
              r={item.r}
              fill={palette.hudFill}
              fillOpacity={palette.hudFillOpacity + 0.2}
              stroke={stroke}
              strokeWidth={1.4}
              opacity={0.85}
            />
            <circle
              cx={cx}
              cy={item.y}
              r={item.r * 0.72}
              fill="none"
              stroke={palette.hudAccent}
              strokeWidth={1.2}
              opacity={0.6}
            />
            <text
              x={cx}
              y={item.y + item.r * 0.32}
              fontSize={item.r * 0.8}
              fill={palette.hudText}
              fontFamily={MONO_FONT}
              textAnchor="middle"
              opacity={0.9}
            >
              {v}
            </text>
          </g>,
        );
      }
      return <g>{chips}</g>;
    }

    case "bracket": {
      const c = 22;
      const { x, y, w, h } = item;
      return (
        <g fill="none" stroke={stroke} strokeWidth={1.8} opacity={0.55}>
          <path d={`M ${x} ${y + c} L ${x} ${y} L ${x + c} ${y}`} />
          <path d={`M ${x + w - c} ${y} L ${x + w} ${y} L ${x + w} ${y + c}`} />
          <path
            d={`M ${x + w} ${y + h - c} L ${x + w} ${y + h} L ${x + w - c} ${y + h}`}
          />
          <path d={`M ${x + c} ${y + h} L ${x} ${y + h} L ${x} ${y + h - c}`} />
        </g>
      );
    }

    default:
      return null;
  }
};

type HudDeckProps = { theme: Theme; frame: number };

export const HudDeck: React.FC<HudDeckProps> = ({ theme, frame }) => {
  const items = getHudItems(theme.layout);
  return (
    <g>
      {items.map((item) => {
        const start = HUD_FIRST_IN_FRAME + item.delay;
        const opacity = interpolate(
          frame,
          [start, start + HUD_FADE_FRAMES],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
        if (opacity <= 0) return null;
        // Items settle in from a few pixels out, away from frame centre.
        const slide = interpolate(
          frame,
          [start, start + HUD_FADE_FRAMES],
          [14, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
        const dir = item.x < 960 ? -1 : 1;
        return (
          <g
            key={item.id}
            opacity={opacity}
            transform={`translate(${(slide * dir).toFixed(2)} 0)`}
          >
            <HudElement item={item} theme={theme} frame={frame} />
          </g>
        );
      })}
    </g>
  );
};
