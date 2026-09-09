import React from 'react';
import { Composition } from 'remotion';
import { DotArcs } from './DotArcs';
import { DURATION, FPS } from './layout';
import { PALETTES } from './palettes';

const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-DotArcsBlueMagenta"
        component={DotArcs}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTES.v1 }}
      />
      <Composition
        id="V2-DotArcsGold"
        component={DotArcs}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTES.v2 }}
      />
      <Composition
        id="V3-DotArcsMono"
        component={DotArcs}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: PALETTES.v3 }}
      />
    </>
  );
};
