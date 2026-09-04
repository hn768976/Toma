import React from "react";
import { Easing, interpolate } from "remotion";
import { rgba, type Rgb } from "../lib/color";
import { COLORS, PANEL } from "../lib/design";
import { RING_STARTS, ringProgress } from "../lib/timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

const CORNERS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

/** Bracket marks at the panel corners — HUD framing rather than a window chrome. */
export const CornerBrackets: React.FC<{ color: Rgb; px: (v: number) => number }> = ({
  color,
  px,
}) => (
  <>
    {CORNERS.map(([cx, cy], i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: cx ? undefined : px(-16),
          right: cx ? px(-16) : undefined,
          top: cy ? undefined : px(-16),
          bottom: cy ? px(-16) : undefined,
          width: px(74),
          height: px(74),
          borderTop: cy ? undefined : `${px(4)}px solid ${rgba(color, 0.9)}`,
          borderBottom: cy ? `${px(4)}px solid ${rgba(color, 0.9)}` : undefined,
          borderLeft: cx ? undefined : `${px(4)}px solid ${rgba(color, 0.9)}`,
          borderRight: cx ? `${px(4)}px solid ${rgba(color, 0.9)}` : undefined,
        }}
      />
    ))}
  </>
);

/** Measurement ticks along the panel edges. */
export const TickRow: React.FC<{
  color: Rgb;
  px: (v: number) => number;
  count: number;
  bottom?: boolean;
}> = ({ color, px, count, bottom }) => (
  <div
    style={{
      position: "absolute",
      left: px(PANEL.padding),
      right: px(PANEL.padding),
      [bottom ? "bottom" : "top"]: px(16),
      height: px(20),
      display: "flex",
      justifyContent: "space-between",
      alignItems: bottom ? "flex-end" : "flex-start",
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{
          width: px(2),
          height: px(i % 5 === 0 ? 18 : 8),
          background: rgba(color, i % 5 === 0 ? 0.55 : 0.28),
        }}
      />
    ))}
  </div>
);

/** A faint line sweeping down the panel. */
export const ScanLine: React.FC<{ frame: number; color: Rgb; px: (v: number) => number }> = ({
  frame,
  color,
  px,
}) => {
  const travel = PANEL.height + 200;
  const y = ((frame * 2.6) % travel) - 100;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: px(y),
        height: px(46),
        background: `linear-gradient(to bottom, ${rgba(color, 0)} 0%, ${rgba(
          color,
          0.05,
        )} 60%, ${rgba(color, 0.12)} 84%, ${rgba(color, 0)} 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};

/** Confirmation ticks that appear at the panel corners once access is granted. */
export const ConfirmTicks: React.FC<{
  frame: number;
  color: Rgb;
  px: (v: number) => number;
}> = ({ frame, color, px }) => (
  <>
    {CORNERS.map(([cx, cy], i) => {
      const start = 284 + i * 7;
      const appear = interpolate(frame, [start, start + 12], [0, 1], { easing: easeOut, ...clamp });
      if (appear <= 0) return null;
      const size = 46;
      return (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={px(size)}
          height={px(size)}
          style={{
            position: "absolute",
            left: cx ? undefined : px(30),
            right: cx ? px(30) : undefined,
            top: cy ? undefined : px(30),
            bottom: cy ? px(30) : undefined,
            opacity: appear,
            transform: `scale(${0.6 + appear * 0.4})`,
            filter: `drop-shadow(0 0 ${px(16)}px ${rgba(color, 0.6)})`,
          }}
        >
          <path
            d="M3.5 12.5 L9.5 18.5 L20.5 5.5"
            fill="none"
            stroke={rgba(color, 0.95)}
            strokeWidth={3}
            strokeLinecap="square"
            strokeDasharray={26}
            strokeDashoffset={26 * (1 - appear)}
          />
        </svg>
      );
    })}
  </>
);

/** Soft pulses radiating out of the panel on the granted outcome. */
export const PulseRings: React.FC<{ frame: number; color: Rgb; px: (v: number) => number }> = ({
  frame,
  color,
  px,
}) => (
  <>
    {RING_STARTS.map((start) => {
      const p = ringProgress(frame, start);
      if (p <= 0 || p >= 1) return null;
      return (
        <div
          key={start}
          style={{
            position: "absolute",
            inset: 0,
            border: `${px(3)}px solid ${rgba(color, 0.5 * (1 - p))}`,
            borderRadius: px(PANEL.radius),
            transform: `scale(${1 + p * 0.13})`,
            boxShadow: `0 0 ${px(60 * (1 - p))}px ${rgba(color, 0.25 * (1 - p))}`,
          }}
        />
      );
    })}
  </>
);

export const HUD_COLOR = COLORS.hud;
