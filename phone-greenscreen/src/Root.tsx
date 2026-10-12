import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, MODEL_CHECK, VERSIONS, WIDTH } from "./data";
import { PhoneComposition } from "./PhoneComposition";

// Set LOOP_CHECK=1 in the environment (read at bundle time) to render the loop
// compositions one frame longer (601), so frame 600 can be compared with frame 0.
const LOOP_EXTRA = process.env.REMOTION_LOOP_CHECK === "1" ? 1 : 0;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {[...VERSIONS, MODEL_CHECK].map((row) => (
        <Composition
          key={row.id}
          id={row.id}
          component={PhoneComposition}
          durationInFrames={row.durationInFrames + (row.loop ? LOOP_EXTRA : 0)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row }}
        />
      ))}
    </>
  );
};
