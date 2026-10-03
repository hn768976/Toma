import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { FibreOptic } from "./fibre/FibreOptic";
import { DataBlockCity } from "./city/DataBlockCity";
import { GrowingFibres } from "./strands/GrowingFibres";

type FibreProps = { palette: string; loopCheck?: boolean; noWrap?: boolean };
type CityProps = { palette: string; loopCheck?: boolean; noWrap?: boolean };

const FPS = 30;
const W = 3840;
const H = 2160;

// Loop check: pass --props='{"loopCheck":true}' to make a 600-frame loop
// 601 frames long, so frame 600 can be rendered and compared with frame 0.
const loopMeta =
  <T extends { loopCheck?: boolean }>(frames: number): CalculateMetadataFunction<T> =>
  ({ props }) => ({ durationInFrames: props.loopCheck ? frames + 1 : frames });

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FibreOptic-Blue"
        component={FibreOptic}
        durationInFrames={600}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "Blue", loopCheck: false, noWrap: false }}
        calculateMetadata={loopMeta<FibreProps>(600)}
      />
      <Composition
        id="FibreOptic-Multicolour"
        component={FibreOptic}
        durationInFrames={600}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "Multicolour", loopCheck: false, noWrap: false }}
        calculateMetadata={loopMeta<FibreProps>(600)}
      />
      <Composition
        id="DataBlockCity"
        component={DataBlockCity}
        durationInFrames={600}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "BluePink", loopCheck: false, noWrap: false }}
        calculateMetadata={loopMeta<CityProps>(600)}
      />
      <Composition
        id="GrowingFibres-BluePink"
        component={GrowingFibres}
        durationInFrames={450}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "BluePink" }}
      />
      <Composition
        id="GrowingFibres-GreenGold"
        component={GrowingFibres}
        durationInFrames={450}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ palette: "GreenGold" }}
      />
    </>
  );
};
