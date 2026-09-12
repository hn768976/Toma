import React from "react";
import { chartState } from "../data/market";
import { fmtPrice } from "../data/format";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

const AXIS_W = 64;
const PAD_T = 46;
const PAD_B = 26;
const VOL_SHARE = 0.12; // bottom slice of the plot given to volume bars

export const CandleChart: React.FC<{
  frame: number;
  width: number;
  height: number;
  symbol: string;
}> = ({ frame, width, height, symbol }) => {
  const t = useTheme();
  const { candles, last, prevClose, change, changePct, high, low } =
    chartState(frame);

  const plotW = width - AXIS_W;
  const plotH = height - PAD_T - PAD_B;
  const priceH = plotH * (1 - VOL_SHARE);

  // Pad the price range so candles never touch the frame edges.
  const range = Math.max(0.02, high - low);
  const top = high + range * 0.06;
  const bottom = low - range * 0.06;

  const yOf = (v: number) => PAD_T + ((top - v) / (top - bottom)) * priceH;
  const slot = plotW / candles.length;
  const bodyW = Math.max(2, slot * 0.62);
  const xOf = (i: number) => i * slot + slot / 2;

  const maxVol = Math.max(...candles.map((c) => c.volume));
  const volTop = PAD_T + priceH + 6;
  const volH = plotH - priceH - 6;

  // Grid lines every 0.02 within the visible range.
  const step = 0.02;
  const gridValues: number[] = [];
  for (
    let v = Math.ceil(bottom / step) * step;
    v <= top;
    v = Math.round((v + step) * 1000) / 1000
  ) {
    gridValues.push(Math.round(v * 1000) / 1000);
  }

  const up = change >= 0;

  return (
    <div style={{ width, height, background: t.chartBg, position: "relative" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Horizontal price grid. */}
        {gridValues.map((v) => (
          <line
            key={`h${v}`}
            x1={0}
            x2={plotW}
            y1={yOf(v)}
            y2={yOf(v)}
            stroke={t.chartGrid}
            strokeWidth={1}
          />
        ))}
        {/* Vertical time grid. */}
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(plotW * (i + 1)) / 10}
            x2={(plotW * (i + 1)) / 10}
            y1={PAD_T - 10}
            y2={PAD_T + plotH}
            stroke={t.chartGrid}
            strokeWidth={1}
          />
        ))}

        {/* Volume histogram. */}
        {candles.map((c, i) => (
          <rect
            key={`vol${i}`}
            x={xOf(i) - bodyW / 2}
            y={volTop + volH * (1 - c.volume / maxVol)}
            width={bodyW}
            height={Math.max(1, (volH * c.volume) / maxVol)}
            fill={c.close >= c.open ? t.volumeBarUp : t.volumeBarDown}
          />
        ))}

        {/* Candles. */}
        {candles.map((c, i) => {
          const rising = c.close >= c.open;
          const colour = rising ? t.candleUp : t.candleDown;
          const yHigh = yOf(c.high);
          const yLow = yOf(c.low);
          const yOpen = yOf(c.open);
          const yClose = yOf(c.close);
          return (
            <g key={`c${i}`}>
              <line
                x1={xOf(i)}
                x2={xOf(i)}
                y1={yHigh}
                y2={yLow}
                stroke={colour}
                strokeWidth={1.3}
              />
              <rect
                x={xOf(i) - bodyW / 2}
                y={Math.min(yOpen, yClose)}
                width={bodyW}
                height={Math.max(1.2, Math.abs(yClose - yOpen))}
                fill={colour}
              />
            </g>
          );
        })}

        {/* Last price line across the plot. */}
        <line
          x1={0}
          x2={plotW}
          y1={yOf(last)}
          y2={yOf(last)}
          stroke={t.priceLine}
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* Right-hand price scale. */}
        {gridValues.map((v) => (
          <text
            key={`l${v}`}
            x={plotW + 9}
            y={yOf(v) + 3.5}
            fontFamily={NUM_FONT}
            fontSize={10.5}
            fill={t.chartAxisText}
          >
            {v.toFixed(2)}
          </text>
        ))}

        {/* Live price tag and previous close tag. */}
        <rect
          x={plotW + 2}
          y={yOf(last) - 8}
          width={AXIS_W - 4}
          height={16}
          fill={t.priceTagBg}
          rx={2}
        />
        <text
          x={plotW + 7}
          y={yOf(last) + 3.5}
          fontFamily={NUM_FONT}
          fontSize={10.5}
          fontWeight={600}
          fill={t.priceTagText}
        >
          {last.toFixed(2)}
        </text>
        <rect
          x={plotW + 2}
          y={yOf(prevClose) - 8}
          width={AXIS_W - 4}
          height={16}
          fill={t.prevTagBg}
          rx={2}
          opacity={0.9}
        />
        <text
          x={plotW + 7}
          y={yOf(prevClose) + 3.5}
          fontFamily={NUM_FONT}
          fontSize={10.5}
          fontWeight={600}
          fill={t.prevTagText}
        >
          {prevClose.toFixed(2)}
        </text>
      </svg>

      {/* Legend. */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 9,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            fontFamily: UI_FONT,
            fontSize: 13,
            color: t.chartAxisText,
          }}
        >
          <span style={{ color: t.text, fontWeight: 700, letterSpacing: 0.4 }}>
            {symbol}
          </span>
          <span>1m</span>
          <span
            style={{
              fontFamily: NUM_FONT,
              color: up ? t.candleUp : t.candleDown,
            }}
          >
            {last.toFixed(2)} {change >= 0 ? "+" : "−"}
            {Math.abs(change).toFixed(2)} ({changePct >= 0 ? "+" : "−"}
            {Math.abs(changePct).toFixed(2)}%)
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Badge border={t.badgeLowBorder} colour={t.candleDown}>
            L {fmtPrice(low)}
          </Badge>
          <Badge border="transparent" colour={t.chartAxisText}>
            C {fmtPrice(last)}
          </Badge>
          <Badge border={t.badgeHighBorder} colour={t.chartAxisText}>
            H {fmtPrice(high)}
          </Badge>
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 10.5,
            color: t.chartAxisText,
            opacity: 0.8,
          }}
        >
          Vol
        </div>
      </div>
    </div>
  );
};

const Badge: React.FC<{
  border: string;
  colour: string;
  children: React.ReactNode;
}> = ({ border, colour, children }) => (
  <span
    style={{
      fontFamily: NUM_FONT,
      fontSize: 10,
      color: colour,
      border: `1px solid ${border}`,
      borderRadius: 2,
      padding: "1px 5px",
    }}
  >
    {children}
  </span>
);
