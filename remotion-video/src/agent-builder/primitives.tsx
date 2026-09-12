import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_MONO, type Theme } from "./theme";

/** Small uppercase mono label -- the UI's connective tissue. */
export const Mono: React.FC<{
  children: React.ReactNode;
  color?: string;
  size?: number;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ children, color, size = 11, weight = 400, style }) => (
  <span
    style={{
      fontFamily: FONT_MONO,
      fontSize: size,
      fontWeight: weight,
      letterSpacing: size * 0.14,
      color,
      ...style,
    }}
  >
    {children}
  </span>
);

/** A bordered surface. `delay` drives its rise-and-fade entrance. */
export const Panel: React.FC<{
  theme: Theme;
  delay?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ theme, delay = 0, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: 26,
  });

  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 6,
        opacity: t,
        transform: `translateY(${(1 - t) * 18}px)`,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Header strip used at the top of each panel. */
export const PanelHeader: React.FC<{
  theme: Theme;
  left: string;
  right?: React.ReactNode;
}> = ({ theme, left, right }) => (
  <div
    style={{
      height: 34,
      padding: "0 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${theme.border}`,
      flexShrink: 0,
    }}
  >
    <Mono color={theme.textFaint}>{left}</Mono>
    {right}
  </div>
);

/** Faint engineering grid, used behind the workflow canvas. */
export const GridBackdrop: React.FC<{ theme: Theme; size?: number }> = ({
  theme,
  size = 28,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: `linear-gradient(${theme.grid} 1px, transparent 1px), linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
      backgroundSize: `${size}px ${size}px`,
      pointerEvents: "none",
    }}
  />
);

/** Blinking status dot. */
export const StatusDot: React.FC<{ theme: Theme; on?: boolean }> = ({
  theme,
  on = true,
}) => {
  const frame = useCurrentFrame();
  const pulse = on
    ? interpolate(Math.sin((frame / 30) * Math.PI * 2), [-1, 1], [0.35, 1])
    : 0.3;
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: on ? theme.accent : theme.textFaint,
        opacity: pulse,
        boxShadow: on ? `0 0 8px ${theme.accentGlow}` : "none",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
};

/** Text caret that blinks while `active`. */
export const Caret: React.FC<{
  theme: Theme;
  active: boolean;
  height: number;
}> = ({ theme, active, height }) => {
  const frame = useCurrentFrame();
  const visible = active || Math.floor(frame / 15) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height,
        background: theme.text,
        opacity: visible ? 0.9 : 0,
        transform: "translateY(3px)",
        marginLeft: 1,
      }}
    />
  );
};
