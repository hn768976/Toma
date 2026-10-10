import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./common";
import { GLITTER, NEON_FRAME, SPOTLIGHT } from "./colorways";
import { NeonFrame } from "./looks/NeonFrame";
import { SpotlightDust } from "./looks/SpotlightDust";
import { GlitterFloor } from "./looks/GlitterFloor";

// REMOTION_LOOP_CHECK=1 renders 601 frames so frame 600 can be compared with frame 0.
const DURATION = process.env.REMOTION_LOOP_CHECK ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {NEON_FRAME.map((row) => (
      <Composition
        key={row.id}
        id={`NeonFrame-${row.id}`}
        component={NeonFrame}
        defaultProps={{ colorway: row }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {SPOTLIGHT.map((row) => (
      <Composition
        key={row.id}
        id={`SpotlightDust-${row.id}`}
        component={SpotlightDust}
        defaultProps={{ colorway: row }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {GLITTER.map((row) => (
      <Composition
        key={row.id}
        id={`GlitterFloor-${row.id}`}
        component={GlitterFloor}
        defaultProps={{ colorway: row }}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);
