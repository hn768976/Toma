import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION } from "../constants";
import { MONO } from "../load-fonts";
import { TickerRow } from "./scene-data";

export const Tickers: React.FC<{ rows: TickerRow[]; color: string }> = ({ rows, color }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = H / 2160;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {rows.map((row, i) => {
        const travel = Math.abs(row.speed) * DURATION * u;
        // Rows are long enough to cover the frame for the whole clip,
        // so there is no wrap-around to time.
        const startX = row.speed > 0 ? -travel - 0.05 * W : -0.05 * W;
        const x = startX + row.speed * u * frame;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: row.y * H - (row.fontSize * u) / 2,
              transform: `translateX(${x.toFixed(3)}px)`,
              whiteSpace: "pre",
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: row.fontSize * u,
              lineHeight: 1,
              letterSpacing: 0.02 * row.fontSize * u,
              color,
              opacity: row.opacity,
              filter: row.blur > 0 ? `blur(${(row.blur * u).toFixed(2)}px)` : undefined,
            }}
          >
            {row.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
