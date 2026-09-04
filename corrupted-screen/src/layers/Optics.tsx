import React from "react";
import { Theme, withAlpha } from "../lib/theme";
import { wobble } from "../lib/timing";

/**
 * Screen space optics: light raking across the glass, and the dark cast that
 * keeps most of the frame near black so the corruption can punch through.
 * These sit outside the screen plane - they are on the lens, not on the screen.
 */

type Props = {
  theme: Theme;
  width: number;
  height: number;
  frame: number;
  level: number;
};

export const Optics: React.FC<Props> = ({ theme, width, height, frame, level }) => {
  const breathe = 0.9 + 0.1 * wobble(frame, 2);
  const flareStrength = (0.85 + level * 0.35) * breathe;

  return (
    <>
      {/* Bright soft flare raking across the top edge, tilted with the glass. */}
      <div
        style={{
          position: "absolute",
          left: -width * 0.1,
          top: height * 0.03,
          width: width * 1.2,
          height: Math.max(2, height * 0.0028),
          transform: "rotate(2.6deg)",
          background: `linear-gradient(to right, rgba(255,255,255,0) 0%, ${withAlpha(
            theme.flare,
            0.5,
          )} 26%, ${withAlpha(theme.flare, 0.95)} 66%, rgba(255,255,255,0.9) 82%, rgba(255,255,255,0) 100%)`,
          filter: `blur(${(width * 0.0009).toFixed(2)}px)`,
          opacity: flareStrength,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -width * 0.1,
          top: -height * 0.14,
          width: width * 1.2,
          height: height * 0.34,
          transform: "rotate(2.6deg)",
          background: `radial-gradient(ellipse 46% 60% at 74% 62%, ${withAlpha(
            theme.flare,
            0.42,
          )} 0%, ${withAlpha(theme.flare, 0.13)} 40%, rgba(0,0,0,0) 74%)`,
          opacity: flareStrength,
          mixBlendMode: "screen",
        }}
      />
      {/* Dimmer rake down the left edge. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to right, ${withAlpha(theme.flare, 0.11)} 0%, ${withAlpha(
            theme.flare,
            0.03,
          )} 9%, rgba(0,0,0,0) 24%)`,
          opacity: 0.85 * breathe,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * 0.012,
          top: -height * 0.05,
          width: Math.max(2, width * 0.0011),
          height: height * 1.2,
          transform: "rotate(1.2deg)",
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${withAlpha(
            theme.accents[1],
            0.5,
          )} 30%, ${withAlpha(theme.accents[1], 0.22)} 74%, rgba(0,0,0,0) 100%)`,
          filter: `blur(${(width * 0.0004).toFixed(2)}px)`,
          opacity: 0.55,
          mixBlendMode: "screen",
        }}
      />
      {/* Vignette and overall dark cast. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 76% 78% at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.5) 76%, rgba(0,0,0,0.9) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
