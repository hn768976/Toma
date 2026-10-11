import React from "react";
import { Composition } from "remotion";
import { ROWS, Row } from "./versions";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./lib/loop";
import { LEDMap } from "./ledmap/LEDMap";
import { NeonGears } from "./gears/NeonGears";

const Scene: React.FC<{ row: Row }> = ({ row }) =>
  row.kind === "led" ? <LEDMap row={row} /> : <NeonGears row={row} />;

// LOOP_CHECK=1 (env, read at bundle time) adds one frame so frame 600 can be rendered and
// compared with frame 0.
const DURATION = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={Scene}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ row }}
      />
    ))}
  </>
);
