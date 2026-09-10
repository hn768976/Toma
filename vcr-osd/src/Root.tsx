import React from "react";
import {Composition} from "remotion";
import {COMMANDS} from "./commands";
import {VCROSD} from "./VCROSD";

/** 20 seconds at 30fps. The loop seam sits between frame 599 and frame 0. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 600;

export const RemotionRoot: React.FC = () => (
  <>
    {COMMANDS.map((command) => (
      <Composition
        key={command.id}
        id={command.id}
        component={VCROSD}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={DURATION}
        defaultProps={{
          label: command.label,
          glyph: command.glyph,
          seed: command.seed,
        }}
      />
    ))}
  </>
);
