import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { LOOP } from "../constants";
import type { HudTheme } from "../theme";

// Base colour wash: a flat deep field with a soft off-centre bloom that
// breathes over the loop, plus a vignette pass on top of everything else
// (rendered separately via <Vignette/>) to keep the edges of the frame
// from competing with the HUD linework.
export const Backdrop: React.FC<{
  theme: HudTheme;
  /** bloom centre in design-space coordinates */
  glowX: number;
  glowY: number;
}> = ({ theme, glowX, glowY }) => {
  const frame = useCurrentFrame();
  // One full breathe per loop so frame 0 and frame LOOP match exactly.
  const breathe = Math.sin((frame / LOOP) * Math.PI * 2);
  const spread = interpolate(breathe, [-1, 1], [58, 70]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgBase }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${spread}% ${spread * 1.1}% at ${glowX}% ${glowY}%, ${theme.bgGlowInner} 0%, ${theme.bgGlowOuter} 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ theme: HudTheme }> = ({ theme }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 78% 82% at 50% 50%, transparent 38%, ${theme.vignette} 100%)`,
      pointerEvents: "none",
    }}
  />
);
