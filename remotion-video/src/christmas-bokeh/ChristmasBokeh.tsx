import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { BokehField } from "./BokehField";
import { GrainVignette } from "./GrainVignette";
import { SnowLayer } from "./SnowLayer";
import { SparkLayer } from "./SparkLayer";
import { THEME, type ThemeVariant } from "./theme";

export const christmasBokehSchema = z.object({
  variant: z.enum(["classic"]),
});

export type ChristmasBokehProps = z.infer<typeof christmasBokehSchema>;

export const christmasBokehDefaults: ChristmasBokehProps = {
  variant: "classic",
};

/**
 * Christmas bokeh: a field of out-of-focus discs in red, gold and cream
 * with sparse green, six-pointed snowflakes falling in front of it, and a
 * scatter of twinkling sparks between the two. 240 frames at 30fps, and
 * every drift path, fall cycle, rotation and twinkle period closes exactly
 * on frame 240, so it loops seamlessly.
 *
 * Nothing here reads a clock. Every value is a pure function of
 * useCurrentFrame() and a seeded random(), which is what lets Remotion
 * render the frames out of order across workers and still get an identical
 * result every time.
 */
export const ChristmasBokeh: React.FC<ChristmasBokehProps> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const theme = THEME[variant as ThemeVariant] ?? THEME.classic;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <BokehField width={width} height={height} theme={theme} />
      <SparkLayer width={width} height={height} theme={theme} />
      <SnowLayer width={width} height={height} theme={theme} />
      <GrainVignette width={width} height={height} theme={theme} />
    </AbsoluteFill>
  );
};
