import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useU } from "../layout";
import { MONO } from "../load-fonts";
import type { Theme } from "../theme";

/**
 * The left margin: a vertical rule, the rotated "DATA 02" label, a
 * warning triangle and a stack of small control glyphs. Every glyph is
 * hand-drawn SVG — no icon set.
 */

const GlyphBox: React.FC<{
  theme: Theme;
  size: number;
  children: React.ReactNode;
}> = ({ theme, size, children }) => (
  <div
    style={{
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.022)",
      border: `${Math.max(1, size * 0.012)}px solid ${theme.frame}`,
    }}
  >
    {children}
  </div>
);

/** Concentric ring. */
const GlyphRing: React.FC<{ s: number; c: string; w: number }> = ({ s, c, w }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" fill="none" stroke={c} strokeWidth={w}>
    <circle cx="20" cy="20" r="15" />
    <circle cx="20" cy="20" r="7.5" />
  </svg>
);

/** Four-node cluster. */
const GlyphCluster: React.FC<{ s: number; c: string; w: number }> = ({ s, c, w }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" fill="none" stroke={c} strokeWidth={w}>
    <circle cx="20" cy="10" r="5.4" />
    <circle cx="12" cy="24" r="5.4" />
    <circle cx="28" cy="24" r="5.4" />
    <circle cx="20" cy="34" r="4" />
  </svg>
);

/** Hexagon. */
const GlyphHex: React.FC<{ s: number; c: string; w: number }> = ({ s, c, w }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" fill="none" stroke={c} strokeWidth={w}>
    <path d="M20 5 L33 12.5 L33 27.5 L20 35 L7 27.5 L7 12.5 Z" />
  </svg>
);

/** Half-filled dial. */
const GlyphDial: React.FC<{ s: number; c: string; w: number }> = ({ s, c, w }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" fill="none" stroke={c} strokeWidth={w}>
    <circle cx="20" cy="20" r="14" />
    <path d="M20 6 A14 14 0 0 1 20 34" fill={c} stroke="none" opacity={0.35} />
    <path d="M20 20 L20 8" />
  </svg>
);

export const MarginStrip: React.FC<{ theme: Theme; width: number }> = ({
  theme,
  width,
}) => {
  const frame = useCurrentFrame();
  const u = useU();

  const rule = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const label = interpolate(frame, [6, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glyphs = interpolate(frame, [14, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The small amber marker blinks slowly, on its own beat.
  const marker = 0.55 + 0.45 * Math.sin(frame / 13);

  const box = width * 0.62;
  const glyphSize = box * 0.62;
  const stroke = Math.max(1, u(0.0012));

  return (
    <div
      style={{
        position: "relative",
        width,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Vertical rule closing the strip off from the window field. */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: u(0.0013),
          height: `${rule * 100}%`,
          background: theme.frameBright,
          opacity: 0.85,
        }}
      />

      {/* DATA 02, rotated to read bottom-to-top. */}
      <div
        style={{
          marginTop: "6%",
          height: "34%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: label,
        }}
      >
        <span
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            whiteSpace: "nowrap",
            fontFamily: MONO,
            fontWeight: 400,
            fontSize: u(0.041),
            letterSpacing: u(0.004),
            color: theme.label,
          }}
        >
          DATA 02
        </span>
      </div>

      {/* Amber marker: the one warm thing in the margin. */}
      <div
        style={{
          marginTop: "4%",
          opacity: glyphs * marker,
        }}
      >
        <svg width={box * 0.42} height={box * 0.42} viewBox="0 0 20 20">
          <path d="M14 4 L14 16 L5 10 Z" fill={theme.warn} opacity={0.9} />
        </svg>
      </div>

      <div style={{ flex: 1 }} />

      {/* Warning triangle, then the control glyph stack. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: u(0.012),
          paddingBottom: "6%",
          opacity: glyphs,
        }}
      >
        <svg
          width={box * 1.05}
          height={box * 1.05}
          viewBox="0 0 44 40"
          fill="none"
          stroke={theme.warn}
          strokeWidth={1.4}
          opacity={0.72}
        >
          <path d="M22 4 L41 36 L3 36 Z" strokeLinejoin="round" />
          <path d="M22 15 L22 25" strokeLinecap="round" />
          <path d="M22 30 L22 30.6" strokeLinecap="round" />
        </svg>
        <GlyphBox theme={theme} size={box}>
          <GlyphRing s={glyphSize} c={theme.body} w={stroke * 1.6} />
        </GlyphBox>
        <GlyphBox theme={theme} size={box}>
          <GlyphCluster s={glyphSize} c={theme.body} w={stroke * 1.6} />
        </GlyphBox>
        <GlyphBox theme={theme} size={box}>
          <GlyphHex s={glyphSize} c={theme.body} w={stroke * 1.6} />
        </GlyphBox>
        <GlyphBox theme={theme} size={box}>
          <GlyphDial s={glyphSize} c={theme.bodyDim} w={stroke * 1.6} />
        </GlyphBox>
      </div>
    </div>
  );
};
