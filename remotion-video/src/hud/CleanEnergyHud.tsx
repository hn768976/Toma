import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Atmosphere, Sweep } from "./Atmosphere";
import { Camera, DESIGN_HEIGHT, DESIGN_WIDTH, REFERENCE_CAMERA } from "./Camera";
import { ThemeProvider } from "./context";
import { LayoutConsole } from "./LayoutConsole";
import { BLUE_THEME, GREEN_THEME } from "./theme";

export const cleanEnergyHudSchema = z.object({
  /**
   * `reference` is the green console framed like the source clip;
   * `mirrored` is the same console flipped left-to-right, in dark blue.
   */
  variant: z.enum(["reference", "mirrored"]),
  /** Seconds of fade up from black at the head of the take. */
  fadeInSeconds: z.number().min(0).max(4),
  /**
   * Camera overrides, for matching the source's perspective against rendered
   * stills. Leave at the measured defaults for delivery.
   */
  tilt: z.number().min(0).max(85),
  roll: z.number().min(-60).max(60),
  zoom: z.number().min(0.2).max(2),
  perspective: z.number().min(400).max(8000),
});

export type CleanEnergyHudProps = z.infer<typeof cleanEnergyHudSchema>;

export const cleanEnergyHudDefaults: CleanEnergyHudProps = {
  variant: "reference",
  fadeInSeconds: 1.3,
  tilt: REFERENCE_CAMERA.tilt,
  roll: REFERENCE_CAMERA.roll,
  zoom: REFERENCE_CAMERA.zoom,
  perspective: REFERENCE_CAMERA.perspective,
};

export const CleanEnergyHud: React.FC<CleanEnergyHudProps> = ({
  variant,
  fadeInSeconds,
  tilt,
  roll,
  zoom,
  perspective,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const mirrored = variant === "mirrored";
  const theme = mirrored ? BLUE_THEME : GREEN_THEME;
  const scale = width / DESIGN_WIDTH;

  const fadeIn = interpolate(frame, [0, Math.max(1, fadeInSeconds * fps)], [0, 1], {
    extrapolateRight: "clamp",
  });

  // A mirror of the shot, not just of the layout: the roll flips with it, so
  // the two versions are true reflections of one another.
  const camera = {
    ...REFERENCE_CAMERA,
    tilt,
    roll: mirrored ? -roll : roll,
    zoom,
    perspective,
  };

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{ backgroundColor: theme.void, overflow: "hidden" }}>
        <AbsoluteFill style={{ opacity: fadeIn }}>
          <Camera camera={camera}>
            <LayoutConsole mirrored={mirrored} />
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
            <Sweep width={DESIGN_WIDTH} height={DESIGN_HEIGHT} periodInFrames={mirrored ? 190 : 230} />
            <Atmosphere
              width={DESIGN_WIDTH}
              height={DESIGN_HEIGHT}
              grainOpacity={mirrored ? 0.08 : 0.1}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
