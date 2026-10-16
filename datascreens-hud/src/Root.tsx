import React from "react";
import { Composition } from "remotion";
import { ROWS } from "./compositions";
import { LOOP_FRAMES, FPS } from "./lib/loop";

// Set LOOP_CHECK=1 at bundle time to get 601-frame versions for the loop test
// (frame 600 must equal frame 0).
const DURATION = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={row.component as React.FC<Record<string, unknown>>}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={row.props as Record<string, unknown>}
      />
    ))}
  </>
);
