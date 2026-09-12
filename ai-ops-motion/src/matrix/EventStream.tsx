import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, MATRIX, MONO_FONT } from "../shared/theme";
import { Bar, formatInt, MicroLabel, Panel, Readout, pad2 } from "../shared/ui";
import { rand } from "../shared/rand";
import { EVENT_MESSAGES, LAYOUT } from "./data";

/** Frames between two log lines. */
const PUSH_EVERY = 24;
const ROW_H = 25;
const VISIBLE = 10;

export const EventStream: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = LAYOUT.eventStream;

  // Start with the viewport already full, so the panel reads as a log that
  // was running before the shot began rather than one filling from empty.
  const progress = frame / PUSH_EVERY + VISIBLE;
  const newest = Math.floor(progress);
  const withinRow = progress - newest;
  // Rows rest for most of the interval and then snap up, the way a real log
  // tail behaves — a constant glide leaves rows clipped at the viewport edges.
  const shift = Math.max(0, Math.min(1, (withinRow - 0.78) / 0.22));
  const slide = shift * shift * (3 - 2 * shift);
  const processed = 4_812_000 + frame * 183 + Math.floor(frame / 7) * 41;

  return (
    <Panel
      x={x}
      y={y}
      width={w}
      height={h}
      title="REAL-TIME DIAGNOSTICS / EVENT STREAM"
      accent={ACCENT.cyan}
      delay={22}
    >
      <div
        style={{
          position: "absolute",
          left: 18,
          top: 50,
          width: w - 36,
          height: VISIBLE * ROW_H,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: VISIBLE + 2 }, (_, k) => {
          // k = 0 is the oldest row still on screen, VISIBLE + 1 the incoming one.
          const idx = newest - (VISIBLE + 1) + k;
          if (idx < 0) return null;
          const msg = EVENT_MESSAGES[idx % EVENT_MESSAGES.length];
          const top = (k - 1 - slide) * ROW_H;
          // Fade the row leaving the top and the one arriving at the bottom.
          const edge = Math.min(1, (top + ROW_H) / ROW_H, (VISIBLE * ROW_H - top) / ROW_H);
          const seconds = 60 * 14 + idx * 3 + Math.floor(rand(`sec${idx}`) * 3);
          const latency = 40 + Math.floor(rand(`lat${idx}`) * 210);
          const appear = interpolate(frame, [28, 46], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: 0,
                top,
                width: "100%",
                height: ROW_H,
                display: "flex",
                alignItems: "center",
                opacity: Math.max(0, edge) * appear,
              }}
            >
              <span
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 8.5,
                  color: MATRIX.textFaint,
                  width: 74,
                }}
              >
                {pad2(2 + Math.floor(seconds / 3600))}:{pad2((seconds / 60) % 60)}:
                {pad2(seconds % 60)}
              </span>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  background: msg.color,
                  boxShadow: `0 0 6px ${alpha(msg.color, 0.8)}`,
                  marginRight: 12,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 9.5,
                  color: MATRIX.textDim,
                  flex: 1,
                }}
              >
                {msg.text}
              </span>
              <Readout size={8.5} color={MATRIX.textFaint}>
                {latency}ms
              </Readout>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <MicroLabel>Events processed</MicroLabel>
          <Readout size={11} color={ACCENT.cyan} weight={700}>
            {formatInt(processed)}
          </Readout>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MicroLabel>Error budget</MicroLabel>
          <Bar width={150} value={91} color={ACCENT.green} />
        </div>
      </div>
    </Panel>
  );
};
