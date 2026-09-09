import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { ReportDashboard } from "./ReportDashboard";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./timing";
import { CLIMATE, HEALTH } from "./topics";

/**
 * Compositions are defined at full 4K so they can be rendered at 3840x2160
 * later; render previews with --scale=0.5 for 1920x1080.
 *
 * Adding a topic: add an entry to topics.ts, then register it here. No
 * component changes — if a new subject needs one, the template has a gap.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-ReportHealthLight"
        component={ReportDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          topic: HEALTH,
          style: "light" as const,
          idPrefix: "v1",
        }}
      />
      <Composition
        id="V2-ReportHealthDark"
        component={ReportDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          topic: HEALTH,
          style: "dark" as const,
          idPrefix: "v2",
        }}
      />
      <Composition
        id="V3-ReportClimateLight"
        component={ReportDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          topic: CLIMATE,
          style: "light" as const,
          idPrefix: "v3",
        }}
      />
    </>
  );
};
