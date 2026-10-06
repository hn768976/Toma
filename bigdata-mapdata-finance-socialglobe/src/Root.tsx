import { CalculateMetadataFunction, Composition } from "remotion";
import { LookProps } from "./lib/Stage";
import { DataWorldMap, DATAMAP_FRAMES } from "./looks/DataWorldMap";
import { FinanceInfographic, FINANCE_FRAMES } from "./looks/FinanceInfographic";
import { SocialGlobe, SOCIAL_FRAMES } from "./looks/SocialGlobe";
import { GlobalSecurityLock, LOCK_FRAMES } from "./looks/GlobalSecurityLock";
import { BigDataScreen, BIGDATA_FRAMES } from "./looks/BigDataScreen";

// All compositions: 3840x2160, 30fps. Input props:
//   frames  overrides the duration (used by the loop check: 601 / 901 frames)
//   grade   optional colourway grade, see README "Adding a colourway"
type Props = LookProps;
const withFrames =
  (base: number): CalculateMetadataFunction<Props> =>
  ({ props }) => ({ durationInFrames: props.frames ?? base });

const common = { fps: 30, width: 3840, height: 2160 } as const;

export const RemotionRoot = () => (
  <>
    <Composition
      id="BigDataScreen-Blue"
      component={BigDataScreen}
      durationInFrames={BIGDATA_FRAMES}
      defaultProps={{} as Props}
      calculateMetadata={withFrames(BIGDATA_FRAMES)}
      {...common}
    />
    <Composition
      id="DataWorldMap-BlueYellow"
      component={DataWorldMap}
      durationInFrames={DATAMAP_FRAMES}
      defaultProps={{} as Props}
      calculateMetadata={withFrames(DATAMAP_FRAMES)}
      {...common}
    />
    <Composition
      id="FinanceInfographic-Teal"
      component={FinanceInfographic}
      durationInFrames={FINANCE_FRAMES}
      defaultProps={{} as Props}
      calculateMetadata={withFrames(FINANCE_FRAMES)}
      {...common}
    />
    <Composition
      id="SocialGlobe-Blue"
      component={SocialGlobe}
      durationInFrames={SOCIAL_FRAMES}
      defaultProps={{} as Props}
      calculateMetadata={withFrames(SOCIAL_FRAMES)}
      {...common}
    />
    <Composition
      id="GlobalSecurityLock-Blue"
      component={GlobalSecurityLock}
      durationInFrames={LOCK_FRAMES}
      defaultProps={{} as Props}
      calculateMetadata={withFrames(LOCK_FRAMES)}
      {...common}
    />
  </>
);
