import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import "./fonts";
import { CodePanel } from "./code/CodePanel";
import { grainOffset, grainTile } from "./grain";
import { computeLayout } from "./layout";
import { Orb } from "./orb/Orb";
import { OrbLabel } from "./orb/OrbLabel";
import { Sidebar } from "./Sidebar";
import { EDITOR_BG, ORB_CYAN, type OrbPalette } from "./theme";

export type AIChatScreenProps = {
  palette: OrbPalette;
};

export const aiChatScreenDefaultProps: AIChatScreenProps = {
  palette: ORB_CYAN,
};

// ~3 degrees around Y. Enough that the screen reads as photographed
// rather than as a flat screenshot; small enough that the code stays
// crisp. The scale compensates for the corners the rotation pulls in.
const TILT_DEGREES = 3;
const TILT_SCALE = 1.028;

export const AIChatScreen: React.FC<AIChatScreenProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layout = useMemo(() => computeLayout(width, height), [width, height]);

  const grain = grainTile();
  const offset = grainOffset(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070a" }}>
      <AbsoluteFill style={{ perspective: width * 1.2 }}>
        <AbsoluteFill
          style={{
            backgroundColor: EDITOR_BG,
            transform: `rotateY(-${TILT_DEGREES}deg) scale(${TILT_SCALE})`,
            transformOrigin: "50% 50%",
            overflow: "hidden",
          }}
        >
          {/* Faint screen glow — the panel lifts slightly toward the
              upper left, the way a lit display does. */}
          <AbsoluteFill
            style={{
              background:
                "radial-gradient(120% 90% at 22% 18%, rgba(94,132,198,0.075) 0%, rgba(94,132,198,0) 62%)",
            }}
          />

          <Sidebar layout={layout} />
          <CodePanel layout={layout} caretColor={palette.from} />

          <Orb
            palette={palette}
            centerX={layout.orbCenterX}
            centerY={layout.orbCenterY}
            radius={layout.orbRadius}
          />
          <OrbLabel layout={layout} glow={palette.glow} />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Vignette, then grain, both outside the tilt so they stay square
          to the frame like a lens and a film stock would. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(115% 105% at 46% 44%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)",
        }}
      />
      {grain ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${grain})`,
            backgroundRepeat: "repeat",
            backgroundPosition: `${offset.x}px ${offset.y}px`,
            // Composited straight, not with `overlay`: overlay collapses
            // to almost nothing on a near-black base, so it looks like
            // grain while dithering nothing. Straight compositing of
            // black/white noise pushes each pixel a couple of levels
            // either way, which is what actually breaks up contouring in
            // the dark background before the encode can bake it in.
            opacity: 0.02,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
