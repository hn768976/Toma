import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { CardboardBoxes } from "./boxes/CardboardBoxes";
import { AIEye } from "./eye/AIEye";
import { setNoWrap } from "./lib/loop";
import { ParticleRain } from "./rain/ParticleRain";
import { USMap } from "./usmap/USMap";
import { AI_EYE_VERSIONS, BOXES_VERSIONS, RAIN_VERSIONS, US_MAP_VERSIONS } from "./versions";

const W = 3840;
const H = 2160;
const FPS = 30;

// Verification props (not needed for normal renders):
//   loopCheck: true -> loop compositions get 601 frames so frame 600 can be compared to 0
//   noWrap: true    -> motion uses the raw frame instead of frame % 600 (tests periodicity)
type CheckProps = { loopCheck?: boolean; noWrap?: boolean };

const loopMeta =
  <P extends CheckProps>(frames: number): CalculateMetadataFunction<P> =>
  ({ props }) => ({ durationInFrames: props.loopCheck ? frames + 1 : frames });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withChecks = <P extends CheckProps>(C: React.FC<any>) => {
  const Wrapped: React.FC<P> = (props) => {
    setNoWrap(!!props.noWrap);
    return <C {...props} />;
  };
  return Wrapped;
};

const USMapC = withChecks(USMap);
const BoxesC = withChecks(CardboardBoxes);
const RainC = withChecks(ParticleRain);
const EyeC = withChecks(AIEye);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {US_MAP_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={USMapC} durationInFrames={450} fps={FPS} width={W} height={H}
          defaultProps={{ palette: v.palette }} />
      ))}
      {BOXES_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={BoxesC} durationInFrames={600} fps={FPS} width={W} height={H}
          defaultProps={{ palette: v.palette, loopCheck: false, noWrap: false }} calculateMetadata={loopMeta(600)} />
      ))}
      {RAIN_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={RainC} durationInFrames={600} fps={FPS} width={W} height={H}
          defaultProps={{ palette: v.palette, loopCheck: false, noWrap: false }} calculateMetadata={loopMeta(600)} />
      ))}
      {AI_EYE_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={EyeC} durationInFrames={600} fps={FPS} width={W} height={H}
          defaultProps={{ palette: v.palette, loopCheck: false, noWrap: false }} calculateMetadata={loopMeta(600)} />
      ))}
    </>
  );
};
