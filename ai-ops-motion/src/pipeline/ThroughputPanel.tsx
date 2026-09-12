import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, PIPE } from "../shared/theme";
import { Readout } from "../shared/ui";
import { smoothPath, type Pt } from "../shared/paths";
import { formatInt } from "../shared/ui";
import { wander } from "../shared/rand";
import { PIPE_LAYOUT } from "./data";

const SAMPLES = 64;
const SCROLL = 0.06;

const trace = (seed: string, frame: number, amp: number, mid: number, w: number): Pt[] =>
  Array.from({ length: SAMPLES }, (_, i) => {
    const t = (i - frame * SCROLL) / 6.4;
    return { x: (i / (SAMPLES - 1)) * w, y: mid + wander(seed, t, -amp, amp, 2) };
  });

export const ThroughputPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = PIPE_LAYOUT.throughput;
  const entry = interpolate(frame, [8, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  const draw = interpolate(frame, [14, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chart = { left: 22, top: 52, w: w - 44, h: h - 72 };
  const primary = trace("ops", frame, chart.h * 0.4, chart.h * 0.46, chart.w);
  const secondary = trace("ops2", frame, chart.h * 0.2, chart.h * 0.4, chart.w);
  const ops = wander("opsval", frame / 50, 1040, 1320, 2);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: entry,
        transform: `translateY(${interpolate(entry, [0, 1], [14, 0])}px)`,
        background: PIPE.card,
        border: `1px solid ${PIPE.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 22,
          top: 20,
          fontFamily: DISPLAY_FONT,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: 2.6,
          color: PIPE.textDim,
        }}
      >
        SYSTEM THROUGHPUT
      </div>
      <div style={{ position: "absolute", right: 22, top: 19 }}>
        <Readout size={13} color={ACCENT.cyan} weight={700}>
          {formatInt(ops)} OPS/S
        </Readout>
      </div>

      <svg
        width={chart.w}
        height={chart.h}
        style={{ position: "absolute", left: chart.left, top: chart.top }}
      >
        <defs>
          <linearGradient id="throughput-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={alpha(ACCENT.cyan, 0.18)} />
            <stop offset="100%" stopColor={alpha(ACCENT.cyan, 0)} />
          </linearGradient>
          <clipPath id="throughput-clip">
            <rect x={0} y={0} width={chart.w * draw} height={chart.h} />
          </clipPath>
        </defs>
        <g clipPath="url(#throughput-clip)">
          <path
            d={`${smoothPath(primary)} L ${chart.w} ${chart.h} L 0 ${chart.h} Z`}
            fill="url(#throughput-fill)"
          />
          <path
            d={smoothPath(secondary)}
            fill="none"
            stroke={alpha(ACCENT.violet, 0.7)}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <path
            d={smoothPath(primary)}
            fill="none"
            stroke={ACCENT.cyan}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};
