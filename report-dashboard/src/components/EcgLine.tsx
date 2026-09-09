import React from "react";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import { buildEcgPath } from "../geometry";
import { reveal } from "../reveal";
import { TIMING } from "../timing";

/**
 * A heartbeat trace running the full width along the bottom, scrolling right
 * to left. Extra periods are drawn either side of the frame and the whole path
 * is translated within one period, so the scroll is seamless and needs no
 * wrap-around bookkeeping.
 */
export const EcgLine: React.FC<{
  theme: Theme;
  layout: Layout;
  frame: number;
}> = ({ theme, layout, frame }) => {
  const { u, ecg, width } = layout;

  const opacity = reveal(frame, TIMING.ecgFade.from, TIMING.ecgFade.to);
  if (opacity <= 0) return null;

  const period = u(ecg.period);
  const beats = Math.ceil(width / period) + 2;
  const path = buildEcgPath(beats, period, u(ecg.centreY), u(ecg.amplitude));

  // Modulo one period: the trace is identical every period, so this is a
  // continuous scroll that never accumulates drift.
  const shift = ((frame * u(TIMING.ecgSpeed)) % period) + period;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
      }}
    >
      <path
        d={path}
        fill="none"
        stroke={theme.ecg}
        strokeWidth={u(ecg.stroke)}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${-shift} 0)`}
      />
    </svg>
  );
};
