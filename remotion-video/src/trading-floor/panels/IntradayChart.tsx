import React from "react";
import {
  INTRADAY_MAX,
  INTRADAY_MIN,
  INTRADAY_POINTS,
  INTRADAY_REF,
  intradaySeries,
} from "../data/market";
import { fmtPrice } from "../data/format";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

const AXIS_W = 46;
const PAD_T = 10;
const PAD_B = 18;
const BUTTONS = ["1D", "1W", "1M", "3M"];

export const IntradayChart: React.FC<{
  frame: number;
  width: number;
  height: number;
}> = ({ frame, width, height }) => {
  const t = useTheme();
  const series = intradaySeries(frame);
  const plotW = width - AXIS_W - 34;
  const plotH = height - PAD_T - PAD_B;

  const yOf = (v: number) =>
    PAD_T + ((INTRADAY_MAX - v) / (INTRADAY_MAX - INTRADAY_MIN)) * plotH;
  const xOf = (i: number) => AXIS_W + (i / (INTRADAY_POINTS - 1)) * plotW;

  const line = series.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");
  const area = `${AXIS_W},${yOf(INTRADAY_REF)} ${line} ${xOf(
    INTRADAY_POINTS - 1,
  )},${yOf(INTRADAY_REF)}`;

  const yTicks = [82.25, 82.5, 82.75, 83.0, 83.25, 83.5];
  const xTicks = ["10", "11", "12", "14", "15", "16"];

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        borderLeft: `1px solid ${t.divider}`,
        borderTop: `1px solid ${t.divider}`,
      }}
    >
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id={`intraday-${t.name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.areaTop} />
            <stop offset="100%" stopColor={t.areaBottom} />
          </linearGradient>
        </defs>

        {/* Session dividers. */}
        {[0.42, 0.52].map((f) => (
          <line
            key={f}
            x1={AXIS_W + plotW * f}
            x2={AXIS_W + plotW * f}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke={t.sessionLine}
            strokeWidth={1}
          />
        ))}

        <polygon points={area} fill={`url(#intraday-${t.name})`} />
        <polyline
          points={line}
          fill="none"
          stroke={t.areaLine}
          strokeWidth={1.2}
        />

        {/* Previous close / average reference. */}
        <line
          x1={AXIS_W}
          x2={AXIS_W + plotW}
          y1={yOf(INTRADAY_REF)}
          y2={yOf(INTRADAY_REF)}
          stroke={t.refLine}
          strokeWidth={1.2}
        />

        {yTicks.map((v) => (
          <text
            key={v}
            x={AXIS_W - 6}
            y={yOf(v) + 3.5}
            textAnchor="end"
            fontFamily={NUM_FONT}
            fontSize={10}
            fill={v === INTRADAY_REF ? t.refLine : t.textMuted}
          >
            {fmtPrice(v)}
          </text>
        ))}

        {xTicks.map((label, i) => (
          <text
            key={label}
            x={AXIS_W + (plotW * (i + 0.5)) / xTicks.length}
            y={height - 5}
            textAnchor="middle"
            fontFamily={NUM_FONT}
            fontSize={10}
            fill={t.textMuted}
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Timeframe selector. */}
      <div
        style={{
          position: "absolute",
          right: 6,
          top: 8,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {BUTTONS.map((b, i) => (
          <div
            key={b}
            style={{
              width: 21,
              height: 21,
              borderRadius: "50%",
              border: `1px solid ${i === 0 ? t.areaLine : t.iconRing}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: UI_FONT,
              fontSize: 9,
              color: i === 0 ? t.areaLine : t.textMuted,
            }}
          >
            {b}
          </div>
        ))}
      </div>
    </div>
  );
};
