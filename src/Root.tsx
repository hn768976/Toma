import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS } from "./NeonStreaks/config";
import { NeonStreaks } from "./NeonStreaks/NeonStreaks";
import { TitleOverlay, titleOverlaySchema } from "./NeonStreaks/TitleOverlay";

/**
 * All four compositions share one renderer. The effect is described in world
 * units and normalised coordinates, so the same streak table fills a 16:9 or a
 * 9:16 frame without any per-format tuning.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NeonStreaks"
        component={NeonStreaks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ transparent: false }}
      />

      <Composition
        id="NeonStreaksVertical"
        component={NeonStreaks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ transparent: false }}
      />

      {/* Keyable alpha pass: no background fill, no black vignette. */}
      <Composition
        id="NeonStreaksAlpha"
        component={NeonStreaks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ transparent: true }}
      />

      <Composition
        id="TitleOverlay"
        component={TitleOverlay}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        schema={titleOverlaySchema}
        defaultProps={{
          title: "Neon Streaks",
          subtitle: "Procedural motion graphics",
          accent: "#7FC4FF",
          startFrame: 18,
          holdFrames: 300,
        }}
      />
    </>
  );
};
