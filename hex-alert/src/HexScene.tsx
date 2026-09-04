import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { AlertLayer } from "./AlertLayer";
import { HexField } from "./HexField";
import { Glitch, Grain, Scanlines, Vignette, glitchAt } from "./Overlays";
import { hash } from "./random";
import type { Theme } from "./themes";
import { useLayout } from "./useLayout";

export type HexSceneProps = {
  theme: Theme;
  showAlerts: boolean;
};

export const HexScene: React.FC<HexSceneProps> = ({ theme, showAlerts }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();

  // Everything below is a pure function of the frame and repeats exactly over
  // durationInFrames — no state, no randomness at render time.
  const glitch = showAlerts ? glitchAt(frame) : 0;
  const jolt =
    glitch === 0
      ? 0
      : ((hash(frame, 0x77) % 2 === 0 ? 1 : -1) *
          (hash(frame, 0x79) % 3 === 0 ? 2 : 1) *
          layout.charW *
          glitch) /
        1.5;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${jolt}px)` }}>
        <HexField frame={frame} layout={layout} theme={theme} />
        {showAlerts ? <AlertLayer frame={frame} layout={layout} /> : null}
      </AbsoluteFill>
      <Vignette theme={theme} />
      <Scanlines layout={layout} />
      <Grain frame={frame} />
      {showAlerts ? (
        <Glitch frame={frame} layout={layout} theme={theme} />
      ) : null}
    </AbsoluteFill>
  );
};
