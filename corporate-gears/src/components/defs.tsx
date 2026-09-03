import React from "react";
import type { Theme } from "../theme";

/** A generously blurred drop shadow — the whole depth illusion in this scene. */
export const SoftShadow: React.FC<{
  id: string;
  dx: number;
  dy: number;
  blur: number;
  color: string;
  opacity: number;
}> = ({ id, dx, dy, blur, color, opacity }) => (
  <filter id={id} x="-70%" y="-70%" width="240%" height="240%">
    <feDropShadow
      dx={dx}
      dy={dy}
      stdDeviation={blur}
      floodColor={color}
      floodOpacity={opacity}
    />
  </filter>
);

export const Background: React.FC<{ theme: Theme; w: number; h: number }> = ({
  theme,
  w,
  h,
}) => (
  <>
    <defs>
      <linearGradient
        id="bgRamp"
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={h * 0.7}
        x2={w}
        y2={h * 0.25}
      >
        <stop offset="0%" stopColor={theme.gradient[0]} />
        <stop offset="50%" stopColor={theme.gradient[1]} />
        <stop offset="100%" stopColor={theme.gradient[2]} />
      </linearGradient>
      <radialGradient id="bgGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor={theme.glow} stopOpacity={theme.glowOpacity} />
        <stop offset="55%" stopColor={theme.glow} stopOpacity={theme.glowOpacity * 0.4} />
        <stop offset="100%" stopColor={theme.glow} stopOpacity={0} />
      </radialGradient>
    </defs>
    <rect x={0} y={0} width={w} height={h} fill="url(#bgRamp)" />
    <ellipse cx={w / 2} cy={h / 2} rx={w * 0.72} ry={h * 0.82} fill="url(#bgGlow)" />
  </>
);

/**
 * Fine monochrome grain. Broad gradients at this size band badly in H.264;
 * ~1.5% noise dithers the ramp so the banding never forms.
 */
export const Grain: React.FC<{ w: number; h: number; opacity?: number }> = ({
  w,
  h,
  opacity = 0.015,
}) => (
  <>
    <defs>
      <filter id="grainFilter" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.75"
          numOctaves={2}
          stitchTiles="stitch"
          result="noise"
        />
        <feColorMatrix in="noise" type="saturate" values="0" />
      </filter>
    </defs>
    <rect
      x={0}
      y={0}
      width={w}
      height={h}
      filter="url(#grainFilter)"
      opacity={opacity}
    />
  </>
);
