import React from "react";
import { Composition } from "remotion";
import { CubeNetwork } from "./cubes/CubeNetwork";
import {
  CUBE_ROWS,
  FIBRE_ROWS,
  FPS,
  GENERATE_ROWS,
  HEIGHT,
  LOOP_FRAMES,
  PADLOCK_ROWS,
  STORY_FRAMES,
  WIDTH,
} from "./data";
import { FibreRibbon } from "./fibre/FibreRibbon";
import { GenerateButton } from "./generate/GenerateButton";
import { PadlockField } from "./padlock/PadlockField";

// LOOP_CHECK=1 (env, read at bundle time) makes loops 601 frames long so
// frame 600 can be rendered and compared with frame 0.
const loopFrames = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {GENERATE_ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={GenerateButton}
        defaultProps={{ row }}
        durationInFrames={STORY_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {FIBRE_ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={FibreRibbon}
        defaultProps={{ row }}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {CUBE_ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={CubeNetwork}
        defaultProps={{ row }}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {PADLOCK_ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={PadlockField}
        defaultProps={{ row }}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {/* Development still: one padlock on its ring, for the model check. */}
    <Composition
      id="PadlockModelCheck"
      component={PadlockField}
      defaultProps={{ row: PADLOCK_ROWS[0], mode: "modelcheck" as const }}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
