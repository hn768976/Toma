import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Mono, StatusDot } from "../primitives";
import { FONT_SANS, type Theme } from "../theme";
import { buildProgress, statusLabel, T } from "../timeline";
import { DURATION_IN_FRAMES, FPS } from "../constants";
import { timecode } from "../timeline";

export const TopBar: React.FC<{
  theme: Theme;
  title: string;
  breadcrumb: string;
  height?: number;
}> = ({ theme, title, breadcrumb, height = 60 }) => {
  const frame = useCurrentFrame();
  const ready = frame >= T.ready;
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        height,
        flexShrink: 0,
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "0 34px",
        background: theme.panelAlt,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <span
        style={{
          fontFamily: FONT_SANS,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 2.6,
          color: theme.text,
        }}
      >
        {title}
      </span>
      <span style={{ width: 1, height: 18, background: theme.border }} />
      <Mono color={theme.textFaint} size={11}>
        {breadcrumb}
      </Mono>
      <div style={{ flex: 1 }} />
      <Pill theme={theme}>
        <Mono color={theme.textDim} size={10}>
          RUN NUM #001
        </Mono>
      </Pill>
      <Pill theme={theme} active={ready}>
        <StatusDot theme={theme} on={ready} />
        <Mono color={ready ? theme.accent : theme.textDim} size={10}>
          {ready ? "READY" : "AUTOBUILD"}
        </Mono>
      </Pill>
    </div>
  );
};

const Pill: React.FC<{
  theme: Theme;
  active?: boolean;
  children: React.ReactNode;
}> = ({ theme, active, children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 26,
      padding: "0 14px",
      borderRadius: 3,
      background: active ? theme.accentDim : theme.card,
      border: `1px solid ${active ? theme.borderStrong : theme.border}`,
    }}
  >
    {children}
  </div>
);

export const BottomBar: React.FC<{ theme: Theme; height?: number }> = ({
  theme,
  height = 44,
}) => {
  const frame = useCurrentFrame();
  const pct = buildProgress(frame);
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        height,
        flexShrink: 0,
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "0 28px",
        background: theme.panelAlt,
        borderTop: `1px solid ${theme.border}`,
      }}
    >
      <StatusDot theme={theme} />
      <Mono color={theme.textDim} size={10}>
        {statusLabel(frame)}
      </Mono>
      <div style={{ flex: 1 }} />
      <Mono color={theme.textFaint} size={10} style={{ width: 44 }}>
        {Math.round(pct)}%
      </Mono>
      <div
        style={{
          width: 520,
          height: 3,
          background: theme.bar,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: theme.accent,
            boxShadow: `0 0 10px ${theme.accentGlow}`,
          }}
        />
      </div>
      <Mono color={theme.textFaint} size={10}>
        BUILD PROGRESS
      </Mono>
      <div style={{ flex: 1 }} />
      <Mono color={theme.textFaint} size={10}>
        {timecode(frame, FPS, DURATION_IN_FRAMES)}
      </Mono>
    </div>
  );
};
