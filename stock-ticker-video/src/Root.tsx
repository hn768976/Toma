import "./index.css";
import "./load-fonts";
import React from "react";
import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./ticker/constants";
import { TickerChart } from "./ticker/TickerChart";
import {
  V1_DECLINE_DARK,
  V2_RALLY_DARK,
  V3_DECLINE_LIGHT,
} from "./ticker/themes";

/**
 * One build, three variants. All compositions are defined at 4K; render a
 * 1080p preview with --scale=0.5 and the full size with --scale=1.
 */
export const RemotionRoot: React.FC = () => {
  const shared = {
    durationInFrames: DURATION_IN_FRAMES,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    component: TickerChart,
  } as const;

  return (
    <>
      <Composition
        {...shared}
        id="V1-TickerDeclineDark"
        defaultProps={{ variant: V1_DECLINE_DARK }}
      />
      <Composition
        {...shared}
        id="V2-TickerRallyDark"
        defaultProps={{ variant: V2_RALLY_DARK }}
      />
      <Composition
        {...shared}
        id="V3-TickerDeclineLight"
        defaultProps={{ variant: V3_DECLINE_LIGHT }}
      />
    </>
  );
};
