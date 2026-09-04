import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useU } from "../layout";
import { MONO } from "../load-fonts";
import type { Theme } from "../theme";

/** The three marks at the right end of every title bar, drawn as paths. */
const TitleMarks: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => (
  <svg
    width={size * 3.6}
    height={size}
    viewBox="0 0 36 10"
    style={{ display: "block", flexShrink: 0 }}
  >
    <g stroke={color} strokeWidth={1.1} fill="none">
      <rect x={0.6} y={0.6} width={8.8} height={8.8} />
      <path d="M2.8 5 h4.4" />
      <rect x={13.6} y={0.6} width={8.8} height={8.8} />
      <rect x={15.8} y={2.8} width={4.4} height={4.4} />
      <rect x={26.6} y={0.6} width={8.8} height={8.8} />
      <path d="M28.8 2.8 l4.4 4.4 M33.2 2.8 l-4.4 4.4" />
    </g>
  </svg>
);

export const Window: React.FC<{
  theme: Theme;
  title: string;
  /** Right-hand identifier in the title bar, e.g. "ID 77 199 62". */
  meta?: string;
  appearAt: number;
  style?: React.CSSProperties;
  /** Title bars on the filler windows sit a notch below the code panel. */
  accent?: boolean;
  children: React.ReactNode;
}> = ({ theme, title, meta, appearAt, style, accent = false, children }) => {
  const frame = useCurrentFrame();
  const u = useU();

  const enter = interpolate(frame, [appearAt, appearAt + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const barH = u(0.0175);
  const fs = u(0.0079);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        border: `${u(0.001)}px solid ${accent ? theme.frameBright : theme.frame}`,
        background: `linear-gradient(${theme.windowBg}, ${theme.windowBg}), ${theme.bgDeep}`,
        opacity: enter,
        transform: `translateY(${(1 - enter) * u(0.008)}px)`,
        ...style,
      }}
    >
      <div
        style={{
          height: barH,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: u(0.008),
          padding: `0 ${u(0.005)}px`,
          background: theme.titleBarBg,
          borderBottom: `${u(0.0007)}px solid ${theme.frame}`,
          fontFamily: MONO,
          fontSize: fs,
          letterSpacing: fs * 0.09,
          color: accent ? theme.bright : theme.body,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontWeight: 700 }}>{title}</span>
        {meta ? (
          <span style={{ color: theme.bodyDim, marginLeft: "auto" }}>
            {meta}
          </span>
        ) : null}
        <TitleMarks
          color={theme.body}
          size={barH * 0.5}
        />
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};
