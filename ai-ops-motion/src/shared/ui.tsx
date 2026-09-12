import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, DISPLAY_FONT, MATRIX, MONO_FONT } from "./theme";
import { smoothPath, type Pt } from "./paths";

/** Panels rise into place one after another over the opening beat. */
export const usePanelEntry = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, delay, config: { damping: 200, mass: 0.7 } });
  return { opacity: s, lift: interpolate(s, [0, 1], [18, 0]) };
};

export const Panel: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  accent: string;
  delay?: number;
  dot?: boolean;
  children?: React.ReactNode;
  padding?: number;
}> = ({
  x,
  y,
  width,
  height,
  title,
  accent,
  delay = 0,
  dot = true,
  children,
  padding = 18,
}) => {
  const { opacity, lift } = usePanelEntry(delay);
  const frame = useCurrentFrame();
  const pulse = 0.55 + 0.45 * Math.sin((frame / 30) * Math.PI * 1.4 + x * 0.01);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: `translateY(${lift}px)`,
        background: MATRIX.panel,
        border: `1px solid ${MATRIX.border}`,
        borderRadius: 6,
        boxShadow: `inset 0 1px 0 ${alpha("#7fb6ff", 0.05)}`,
      }}
    >
      {/* Corner rule — the accent bar that identifies each panel. */}
      <div
        style={{
          position: "absolute",
          left: -1,
          top: -1,
          width: Math.min(width * 0.42, 150),
          height: 2,
          background: `linear-gradient(90deg, ${accent}, ${alpha(accent, 0)})`,
          boxShadow: `0 0 8px ${alpha(accent, 0.8)}`,
        }}
      />
      {title ? (
        <div
          style={{
            position: "absolute",
            left: padding,
            top: padding - 2,
            fontFamily: DISPLAY_FONT,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2.4,
            color: MATRIX.text,
          }}
        >
          {title}
        </div>
      ) : null}
      {dot ? (
        <div
          style={{
            position: "absolute",
            right: padding,
            top: padding + 1,
            width: 6,
            height: 6,
            borderRadius: 3,
            background: accent,
            opacity: pulse,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
      ) : null}
      {children}
    </div>
  );
};

/** Small all-caps key used above values and along panel footers. */
export const MicroLabel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      fontFamily: DISPLAY_FONT,
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: 1.6,
      color: MATRIX.textFaint,
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Bar: React.FC<{
  width: number;
  value: number;
  color: string;
  height?: number;
  track?: string;
  glow?: boolean;
}> = ({ width, value, color, height = 3, track = "rgba(90,125,170,0.18)", glow = true }) => (
  <div
    style={{
      width,
      height,
      borderRadius: height / 2,
      background: track,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        height: "100%",
        borderRadius: height / 2,
        background: color,
        boxShadow: glow ? `0 0 7px ${alpha(color, 0.85)}` : undefined,
      }}
    />
  </div>
);

/**
 * Line chart over a series of values. `reveal` draws the stroke on during the
 * opening beat; after that the series itself carries the motion.
 */
export const Sparkline: React.FC<{
  values: number[];
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
  fill?: boolean;
  reveal?: number;
  min?: number;
  max?: number;
}> = ({
  values,
  width,
  height,
  color,
  strokeWidth = 1.6,
  fill = false,
  reveal = 1,
  min,
  max,
}) => {
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pad = strokeWidth + 1;
  const pts: Pt[] = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: pad + (1 - (v - lo) / span) * (height - pad * 2),
  }));
  const d = smoothPath(pts);
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}-${Math.round(width)}-${Math.round(height)}`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={alpha(color, 0.3)} />
              <stop offset="100%" stopColor={alpha(color, 0)} />
            </linearGradient>
          </defs>
          <path
            d={`${d} L ${width} ${height} L 0 ${height} Z`}
            fill={`url(#${gradientId})`}
            opacity={reveal}
          />
        </>
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - reveal}
      />
    </svg>
  );
};

/** Monospaced readout; `pad` keeps the glyph count fixed so it never jitters. */
export const Readout: React.FC<{
  children: React.ReactNode;
  size: number;
  color: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ children, size, color, weight = 500, style }) => (
  <span
    style={{
      fontFamily: MONO_FONT,
      fontSize: size,
      fontWeight: weight,
      color,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: 0.2,
      ...style,
    }}
  >
    {children}
  </span>
);

export const formatInt = (n: number): string =>
  Math.round(n).toLocaleString("en-US");

export const pad2 = (n: number): string => String(Math.floor(n)).padStart(2, "0");
