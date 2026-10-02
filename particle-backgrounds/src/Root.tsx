import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./lib/timing";
import { CyberNetwork, DataCity, ParticleSphere, ParticleWaves } from "./looks/GLLooks";
import { PulseRings } from "./looks/PulseRings";
import { Version, VERSIONS } from "./versions";

type Props = { version: Version; loopCheck: boolean };

// loopCheck=true makes the composition 601 frames so frame 600 can be
// rendered and compared with frame 0 (see README "Loop check").
const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

const LookSwitch: React.FC<Props> = ({ version }) => {
  switch (version.look) {
    case "pulseRings":
      return <PulseRings colors={version.colors} />;
    case "particleSphere":
      return <ParticleSphere colors={version.colors} />;
    case "particleWaves":
      return <ParticleWaves colors={version.colors} />;
    case "dataCity":
      return <DataCity colors={version.colors} />;
    case "cyberNetwork":
      return <CyberNetwork colors={version.colors} />;
    default:
      return null;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookSwitch}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: v, loopCheck: false }}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
