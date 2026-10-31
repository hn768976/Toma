import React from "react";
import { Composition } from "remotion";
import {
  DURATION_FRAMES,
  FPS,
  HEIGHT,
  STRIPES_V1,
  STRIPES_V2,
  WATERMELON_V1,
  WATERMELON_V2,
  WIDTH,
  type SceneConfig,
} from "./pool/config";
import { PoolScene } from "./pool/PoolScene";

const Scene: React.FC<{ config: SceneConfig }> = ({ config }) => <PoolScene config={config} />;

const COMPS: { id: string; config: SceneConfig }[] = [
  { id: "Comp1-StripedFloat-V1", config: STRIPES_V1 },
  { id: "Comp1-StripedFloat-V2", config: STRIPES_V2 },
  { id: "Comp2-WatermelonFloat-V1", config: WATERMELON_V1 },
  { id: "Comp2-WatermelonFloat-V2", config: WATERMELON_V2 },
];

/** All compositions are authored at 4K UHD (3840x2160), 30 fps, 10 s. */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {COMPS.map(({ id, config }) => (
        <Composition
          key={id}
          id={id}
          component={Scene}
          durationInFrames={DURATION_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ config }}
        />
      ))}
    </>
  );
};
