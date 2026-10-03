import React from "react";
import { Composition } from "remotion";
import { FlutedGlass } from "./fluted/FlutedGlass";
import { FrostedFoil } from "./foil/FrostedFoil";
import { SunToAlphaCentauri } from "./space/SunToAlphaCentauri";
import { FLUTED_VERSIONS, FOIL_VERSIONS, SPACE_VERSIONS } from "./versions";

export const FPS = 30;
export const DURATION = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Loop check: render with --props='{"loopCheck":true}' to make a looping comp
// 601 frames long, then compare frames 0 and 600 pixel for pixel.
const loopMeta = ({ props }: { props: { loopCheck?: boolean } }) => ({
  durationInFrames: props.loopCheck ? DURATION + 1 : DURATION,
});

export const RemotionRoot: React.FC = () => (
  <>
    {FLUTED_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={FlutedGlass}
        defaultProps={v.props}
        durationInFrames={DURATION}
        calculateMetadata={loopMeta}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {SPACE_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={SunToAlphaCentauri}
        defaultProps={v.props}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    {FOIL_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={FrostedFoil}
        defaultProps={v.props}
        durationInFrames={DURATION}
        calculateMetadata={loopMeta}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);
