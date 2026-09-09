import React from "react";
import { interpolate } from "remotion";
import type { Layout } from "../layout";
import type { Accent } from "../topics";
import { FONT_STACK } from "../fonts";
import { reveal } from "../reveal";
import { TIMING } from "../timing";

export const Badge: React.FC<{
  text: string;
  accent: Accent;
  layout: Layout;
  frame: number;
}> = ({ text, accent, layout, frame }) => {
  const { u, badge } = layout;
  const p = reveal(frame, TIMING.badge.from, TIMING.badge.to);
  // "Very slightly" — a scale you notice as settling, not as a zoom.
  const scale = interpolate(p, [0, 1], [0.94, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: u(badge.centreY),
        left: 0,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        transform: `translateY(-50%) scale(${scale})`,
        opacity: p,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: u(badge.height),
          padding: `0 ${u(badge.padX)}px`,
          borderRadius: u(badge.height / 2),
          background: accent.badgeBg,
          color: accent.badgeText,
          fontFamily: FONT_STACK,
          fontSize: u(badge.fontSize),
          fontWeight: 500,
          letterSpacing: `${badge.tracking}em`,
          // Trailing tracking on the last glyph would push the text
          // off-centre inside the pill.
          textIndent: `${badge.tracking}em`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};
