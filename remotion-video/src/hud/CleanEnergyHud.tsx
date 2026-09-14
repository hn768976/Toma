import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Atmosphere, Sweep } from "./Atmosphere";
import {
  ALT_MOVE,
  Camera,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  REFERENCE_MOVE,
} from "./Camera";
import { ThemeProvider } from "./context";
import { LayoutAlternate } from "./LayoutAlternate";
import { LayoutReference } from "./LayoutReference";
import { BLUE_THEME, GREEN_THEME } from "./theme";

export const cleanEnergyHudSchema = z.object({
  /**
   * `reference` is the green console that mirrors the source clip;
   * `alternate` is the dark-blue re-layout.
   */
  variant: z.enum(["reference", "alternate"]),
  /** Seconds of fade up from black at the head of the take. */
  fadeInSeconds: z.number().min(0).max(4),
});

export type CleanEnergyHudProps = z.infer<typeof cleanEnergyHudSchema>;

export const cleanEnergyHudDefaults: CleanEnergyHudProps = {
  variant: "reference",
  fadeInSeconds: 1.3,
};

export const CleanEnergyHud: React.FC<CleanEnergyHudProps> = ({
  variant,
  fadeInSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isReference = variant === "reference";
  const theme = isReference ? GREEN_THEME : BLUE_THEME;
  const scale = width / DESIGN_WIDTH;

  const fadeIn = interpolate(frame, [0, Math.max(1, fadeInSeconds * fps)], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{ backgroundColor: theme.void, overflow: "hidden" }}>
        <AbsoluteFill style={{ opacity: fadeIn }}>
          <Camera move={isReference ? REFERENCE_MOVE : ALT_MOVE}>
            {isReference ? <LayoutReference /> : <LayoutAlternate />}
          </Camera>
          {/* The finish layer lives in design space and is scaled to match. */}
          <div
            style={{
              position: "absolute",
              width: DESIGN_WIDTH,
              height: DESIGN_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <Sweep
              width={DESIGN_WIDTH}
              height={DESIGN_HEIGHT}
              periodInFrames={isReference ? 230 : 190}
            />
            <Atmosphere
              width={DESIGN_WIDTH}
              height={DESIGN_HEIGHT}
              grainOpacity={isReference ? 0.1 : 0.08}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
