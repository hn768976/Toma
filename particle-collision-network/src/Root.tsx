import React from "react";
import { Composition } from "remotion";
import { ParticleCollision, ParticleCollisionProps } from "./ParticleCollision/ParticleCollision";
import { DURATION_FRAMES, FPS } from "./ParticleCollision/scene";

// Both compositions are authored natively in 4K UHD (3840x2160) at 30 fps.
// Duration = 799 frames = 26.633 s, identical to the reference clip.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-ParticleCollision-Original"
        component={ParticleCollision}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "original", renderScale: 1 } satisfies ParticleCollisionProps}
      />
      <Composition
        id="V2-ParticleCollision-AuroraPalette"
        component={ParticleCollision}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "aurora", renderScale: 1 } satisfies ParticleCollisionProps}
      />
    </>
  );
};
