import React, { useMemo } from "react";
import { UI } from "../constants";
import { paradeColumn, speckle, traceLevel, type Channel, type Grade } from "../grade";

type Props = {
  width: number;
  height: number;
  grade: Grade;
  frame: number;
  title?: string;
  /** Fewer columns for small/heavily-defocused instances. */
  columns?: number;
};

const CHANNELS: Channel[] = ["r", "g", "b"];
const CHANNEL_COLOR: Record<Channel, string> = {
  r: UI.chanR,
  g: UI.chanG,
  b: UI.chanB,
};
const CHANNEL_SEED: Record<Channel, number> = { r: 3, g: 29, b: 61 };
const IRE_LABELS = [1023, 896, 768, 640, 512, 384, 256, 128, 0];

// RGB parade. Three waveform monitors side by side, one per channel.
//
// The trick to making a waveform read as live video is the split between
// a slow-moving envelope and a fast-boiling interior: the shape of the
// signal drifts over seconds, but the stipple inside it is re-randomised
// every single frame. Draw only the envelope and it looks like a graph;
// draw only noise and it looks like static.
export const ParadeScope: React.FC<Props> = ({
  width,
  height,
  grade,
  frame,
  title = "Parade",
  columns = 128,
}) => {
  const headerH = height * 0.105;
  const gutter = width * 0.072;
  const padY = height * 0.035;
  const plotTop = headerH + padY;
  const plotH = height - plotTop - padY * 1.6;
  const plotW = (width - gutter - width * 0.02) / 3;

  const art = useMemo(() => {
    return CHANNELS.map((ch, ci) => {
      const x0 = gutter + ci * plotW + ci * width * 0.006;
      const w = plotW - width * 0.006;
      const cols = Array.from({ length: columns }, (_, i) => {
        const u = i / (columns - 1);
        return { u, x: x0 + u * w, col: paradeColumn(ch, u, frame, grade) };
      });

      const yOf = (v: number) => plotTop + plotH - v * plotH;

      const envelope =
        cols.map((c) => `${c.x.toFixed(1)},${yOf(c.col.hi).toFixed(1)}`).join(" ") +
        " " +
        cols
          .slice()
          .reverse()
          .map((c) => `${c.x.toFixed(1)},${yOf(c.col.lo).toFixed(1)}`)
          .join(" ");

      const traces = Array.from({ length: 6 }, (_, line) =>
        cols
          .map(
            (c) =>
              `${c.x.toFixed(1)},${yOf(
                traceLevel(c.col, c.u, line, frame, CHANNEL_SEED[ch]),
              ).toFixed(1)}`,
          )
          .join(" "),
      );

      const topTrace = cols
        .map((c) => `${c.x.toFixed(1)},${yOf(c.col.hi).toFixed(1)}`)
        .join(" ");
      const midTrace = cols
        .map((c) => `${c.x.toFixed(1)},${yOf(c.col.mid).toFixed(1)}`)
        .join(" ");

      // Individual bright hits scattered through the body of the signal.
      const dots: { x: number; y: number; o: number }[] = [];
      for (let i = 0; i < columns; i += 1) {
        const c = cols[i];
        const n = c.col.density > 0.75 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const r = speckle(i * 4 + k, frame, CHANNEL_SEED[ch]);
          dots.push({
            x: c.x,
            y: yOf(c.col.lo + (c.col.hi - c.col.lo) * r),
            o: 0.25 + 0.6 * speckle(i * 4 + k + 1, frame + 7, CHANNEL_SEED[ch]),
          });
        }
      }

      return { ch, x0, w, envelope, traces, topTrace, midTrace, dots };
    });
  }, [columns, frame, grade, gutter, plotH, plotTop, plotW, width]);

  return (
    <div
      style={{
        width,
        height,
        background: UI.panel,
        border: `1px solid ${UI.edgeLine}`,
        borderRadius: height * 0.018,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: headerH,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${width * 0.016}px`,
          background: "linear-gradient(#1e2b39, #16202b)",
          borderBottom: `1px solid ${UI.edgeLine}`,
        }}
      >
        <span
          style={{
            fontSize: headerH * 0.52,
            color: UI.text,
            letterSpacing: headerH * 0.02,
          }}
        >
          {title}
          <span style={{ color: UI.textDim, marginLeft: headerH * 0.22 }}>⌄</span>
        </span>
        <span style={{ display: "flex", gap: headerH * 0.3 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: headerH * 0.3,
                height: headerH * 0.3,
                borderRadius: 2,
                background: i === 0 ? UI.cyan : UI.cyanDim,
                opacity: i === 0 ? 0.9 : 0.5,
              }}
            />
          ))}
        </span>
      </div>

      <svg
        width={width}
        height={height - headerH}
        viewBox={`0 ${headerH} ${width} ${height - headerH}`}
        style={{ display: "block", background: UI.panelLo }}
      >
        {/* Graticule */}
        {IRE_LABELS.map((label, i) => {
          const y = plotTop + (i / (IRE_LABELS.length - 1)) * plotH;
          return (
            <g key={label}>
              <line
                x1={gutter}
                x2={width - width * 0.014}
                y1={y}
                y2={y}
                stroke="rgba(150,185,215,0.11)"
                strokeWidth={1}
                strokeDasharray={i === 0 || i === IRE_LABELS.length - 1 ? "0" : "3 5"}
              />
              <text
                x={gutter - width * 0.008}
                y={y + height * 0.014}
                textAnchor="end"
                fontSize={height * 0.042}
                fill={UI.amber}
                opacity={0.92}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {art.map(({ ch, x0, w, envelope, traces, topTrace, midTrace, dots }) => {
          const color = CHANNEL_COLOR[ch];
          return (
            <g key={ch}>
              <rect
                x={x0}
                y={plotTop}
                width={w}
                height={plotH}
                fill="#060a0f"
                opacity={0.55}
              />
              <g style={{ mixBlendMode: "screen" }}>
                <polygon points={envelope} fill={color} opacity={0.17} />
                {/* Soft bloom under the crisp traces. */}
                <polyline
                  points={topTrace}
                  fill="none"
                  stroke={color}
                  strokeWidth={height * 0.016}
                  opacity={0.2}
                />
                {traces.map((pts, i) => (
                  <polyline
                    key={i}
                    points={pts}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.1}
                    opacity={0.42 + i * 0.05}
                  />
                ))}
                <polyline
                  points={midTrace}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  opacity={0.3}
                />
                <polyline
                  points={topTrace}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                  opacity={0.95}
                />
                {dots.map((d, i) => (
                  <rect
                    key={i}
                    x={d.x}
                    y={d.y}
                    width={1.4}
                    height={1.4}
                    fill="#ffffff"
                    opacity={d.o * 0.5}
                  />
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
