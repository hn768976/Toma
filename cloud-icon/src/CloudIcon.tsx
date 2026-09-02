import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CircuitBackdrop } from "./components/CircuitBackdrop";
import { CloudParticles } from "./components/CloudParticles";
import { PostFx } from "./components/PostFx";
import { SegmentRing } from "./components/SegmentRing";
import { StarField } from "./components/StarField";
import { CLOUD, CLOUD_CENTER_Y, HEIGHT, WIDTH } from "./config";
import { withAlpha } from "./lib/postFx";
import { getTheme, type Variant } from "./theme";

export type CloudIconProps = {
  variant: Variant;
};

/**
 * A cloud glyph built from particles, held inside a broken segment ring, over
 * a circuit-trace backdrop. 480 frames at 30fps: backdrop, ring, assembly,
 * then a long idle. Deliberately not a loop — frame 0 and frame 480 differ.
 *
 * Every layer is a canvas painted from `useCurrentFrame()` alone, so any frame
 * can be rendered on its own and out of order and come out identical.
 */
export const CloudIcon: React.FC<CloudIconProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const theme = getTheme(variant);

  const washOpacity = interpolate(frame, [0, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.backgroundDeep }}>
      {/* Broad soft radial wash behind everything, centred on the cloud. */}
      <AbsoluteFill
        style={{
          zIndex: 1,
          opacity: washOpacity,
          background: `radial-gradient(${WIDTH * 0.42}px ${
            HEIGHT * 0.62
          }px at ${CLOUD.centerX}px ${CLOUD_CENTER_Y}px, ${withAlpha(
            theme.backgroundWash,
            0.95,
          )} 0%, ${withAlpha(theme.backgroundWash, 0.42)} 42%, ${withAlpha(
            theme.backgroundWash,
            0,
          )} 100%)`,
        }}
      />
      <CircuitBackdrop frame={frame} theme={theme} />
      <StarField frame={frame} theme={theme} />
      <SegmentRing frame={frame} theme={theme} />
      <CloudParticles frame={frame} theme={theme} />
      <PostFx frame={frame} theme={theme} />
    </AbsoluteFill>
  );
};
