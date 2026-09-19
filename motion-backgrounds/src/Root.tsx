import React from "react";
import { Composition } from "remotion";
import { ShaderStage } from "./ShaderStage";
import { LOOKS } from "./compositions/looks";

export const FPS = 30;

/** Master resolution. 1080p deliverables come from rendering at --scale=0.5. */
export const MASTER_WIDTH = 3840;
export const MASTER_HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {LOOKS.map((look) => (
        <Composition
          key={look.id}
          id={look.id}
          component={ShaderStage}
          durationInFrames={look.durationInFrames}
          fps={FPS}
          width={MASTER_WIDTH}
          height={MASTER_HEIGHT}
          defaultProps={{
            fragment: look.fragment,
            uniforms: look.uniforms,
          }}
        />
      ))}
    </>
  );
};
