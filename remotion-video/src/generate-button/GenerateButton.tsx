import React from "react";
import {
  BODY_HEIGHT,
  BODY_RADIUS,
  BODY_WIDTH,
  HAIRLINE_HEIGHT,
  HAIRLINE_RADIUS,
  HAIRLINE_STROKE,
  HAIRLINE_WIDTH,
  LABEL_FONT_FAMILY,
  LABEL_FONT_SIZE,
  RING_HEIGHT,
  RING_RADIUS,
  RING_STROKE,
  RING_WIDTH,
} from "./constants";
import type { Theme } from "./theme";

/** Centres a fixed-size box on the group's origin. */
const centred = (w: number, h: number): React.CSSProperties => ({
  position: "absolute",
  left: -w / 2,
  top: -h / 2,
  width: w,
  height: h,
  boxSizing: "border-box",
});

export const GenerateButton: React.FC<{
  label: string;
  theme: Theme;
  /** Camera pull-back, 1 at the opening hero size. */
  scale: number;
  /** 0..1, extra brightness while the click lands. */
  flash: number;
  /** 0..1, the momentary press-in. */
  press: number;
}> = ({ label, theme, scale, flash, press }) => {
  const glow = 1 + flash * 0.3;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        transform: `scale(${scale})`,
      }}
    >
      {/* Halo bleeding out past the ring. */}
      <div
        style={{
          ...centred(RING_WIDTH * 1.55, RING_HEIGHT * 1.95),
          background: `radial-gradient(ellipse at 50% 50%, ${theme.ringGlow} 0%, transparent 62%)`,
          opacity: 0.2 * glow,
          mixBlendMode: theme.glowBlend,
        }}
      />

      {/* Outer ring. */}
      <div
        style={{
          ...centred(RING_WIDTH, RING_HEIGHT),
          border: `${RING_STROKE}px solid ${theme.ringColor}`,
          borderRadius: RING_RADIUS,
          boxShadow: `0 0 ${15 * glow}px ${theme.ringGlow}, inset 0 0 ${
            13 * glow
          }px ${theme.ringGlow}`,
        }}
      />

      {/* Body. */}
      <div
        style={{
          ...centred(BODY_WIDTH, BODY_HEIGHT),
          borderRadius: BODY_RADIUS,
          transform: `scale(${1 - press * 0.018})`,
          background: `radial-gradient(ellipse 62% 150% at 50% 46%, ${theme.bodyCore} 0%, ${theme.bodyMid} 46%, ${theme.bodyEdge} 100%)`,
          boxShadow: `0 ${10}px ${34}px ${theme.bodyShadow}, 0 0 ${
            28 * glow
          }px ${theme.ringGlow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Inset hairline. */}
        <div
          style={{
            position: "absolute",
            left: (BODY_WIDTH - HAIRLINE_WIDTH) / 2,
            top: (BODY_HEIGHT - HAIRLINE_HEIGHT) / 2,
            width: HAIRLINE_WIDTH,
            height: HAIRLINE_HEIGHT,
            boxSizing: "border-box",
            border: `${HAIRLINE_STROKE}px solid ${theme.hairline}`,
            borderRadius: HAIRLINE_RADIUS,
          }}
        />
        <span
          style={{
            position: "relative",
            fontFamily: LABEL_FONT_FAMILY,
            fontSize: LABEL_FONT_SIZE,
            lineHeight: 1,
            color: theme.label,
            textShadow: `0 3px 7px ${theme.labelShadow}`,
            whiteSpace: "nowrap",
            // Optical centring: the glyphs' visual mass sits slightly high.
            transform: "translateY(-0.03em)",
          }}
        >
          {label}
        </span>
      </div>

      {/* Flash on the click. */}
      {flash > 0.001 ? (
        <div
          style={{
            ...centred(BODY_WIDTH, BODY_HEIGHT),
            borderRadius: BODY_RADIUS,
            background: "#ffffff",
            opacity: flash * 0.07,
            mixBlendMode: theme.glowBlend,
          }}
        />
      ) : null}
    </div>
  );
};
