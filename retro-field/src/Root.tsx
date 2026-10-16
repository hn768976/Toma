import React from "react";
import { Composition, getInputProps } from "remotion";
import { COMP_HEIGHT, COMP_WIDTH, FPS, LOOP_FRAMES } from "./lib/loop";
import { RetroMountains } from "./looks/retro/RetroMountains";
import { FIBRE_VERSIONS, GLASS_VERSIONS, RETRO_VERSIONS, SMOKE_VERSIONS } from "./versions";
import { ParticleSmoke } from "./looks/smoke/ParticleSmoke";
import { GlassSpiral } from "./looks/glass/GlassSpiral";
import { FibreTunnel } from "./looks/fibre/FibreTunnel";

// `--props='{"loopCheck":true}'` makes every composition 601 frames so frame
// 600 can be rendered and compared with frame 0.
const loopCheck = Boolean((getInputProps() as { loopCheck?: boolean }).loopCheck);
const duration = loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {RETRO_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={RetroMountains}
          durationInFrames={duration}
          fps={FPS}
          width={COMP_WIDTH}
          height={COMP_HEIGHT}
          defaultProps={{ version: v }}
        />
      ))}
      {GLASS_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={GlassSpiral}
          durationInFrames={duration}
          fps={FPS}
          width={COMP_WIDTH}
          height={COMP_HEIGHT}
          defaultProps={{ version: v }}
        />
      ))}
      {SMOKE_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={ParticleSmoke}
          durationInFrames={duration}
          fps={FPS}
          width={COMP_WIDTH}
          height={COMP_HEIGHT}
          defaultProps={{ version: v }}
        />
      ))}
      {FIBRE_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={FibreTunnel}
          durationInFrames={duration}
          fps={FPS}
          width={COMP_WIDTH}
          height={COMP_HEIGHT}
          defaultProps={{ version: v }}
        />
      ))}
    </>
  );
};
