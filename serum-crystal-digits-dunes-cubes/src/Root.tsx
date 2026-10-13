import React from "react";
import { Composition } from "remotion";
import { CRYSTAL_BURST, CUBE_CLUSTER, DIGIT_SWIRL, FPS, H, RIBBED_DUNES, SERUM_CAPSULE, W } from "./data";
import { CrystalBurst } from "./looks/CrystalBurst";
import { CubeCluster } from "./looks/CubeCluster";
import { DigitSwirl } from "./looks/DigitSwirl";
import { RibbedDunes } from "./looks/RibbedDunes";
import { SerumCapsule } from "./looks/SerumCapsule";

// Loops are 600 frames. For the loop check the length can be overridden:
//   REMOTION_LOOP_FRAMES=601 npx remotion still <id> --frame=600
const LOOP_FRAMES = Number(process.env.REMOTION_LOOP_FRAMES ?? 600);

export const RemotionRoot: React.FC = () => (
  <>
    {SERUM_CAPSULE.map((row) => (
      <Composition key={row.id} id={row.id} component={SerumCapsule} durationInFrames={300}
        fps={FPS} width={W} height={H} defaultProps={row.props} />
    ))}
    {CRYSTAL_BURST.map((row) => (
      <Composition key={row.id} id={row.id} component={CrystalBurst} durationInFrames={LOOP_FRAMES}
        fps={FPS} width={W} height={H} defaultProps={row.props} />
    ))}
    {DIGIT_SWIRL.map((row) => (
      <Composition key={row.id} id={row.id} component={DigitSwirl} durationInFrames={LOOP_FRAMES}
        fps={FPS} width={W} height={H} defaultProps={row.props} />
    ))}
    {RIBBED_DUNES.map((row) => (
      <Composition key={row.id} id={row.id} component={RibbedDunes} durationInFrames={LOOP_FRAMES}
        fps={FPS} width={W} height={H} defaultProps={row.props} />
    ))}
    {CUBE_CLUSTER.map((row) => (
      <Composition key={row.id} id={row.id} component={CubeCluster} durationInFrames={LOOP_FRAMES}
        fps={FPS} width={W} height={H} defaultProps={row.props} />
    ))}
  </>
);
