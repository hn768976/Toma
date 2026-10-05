import React from 'react';
import {Composition} from 'remotion';
import {LogisticsMap, LogisticsMapProps} from './logistics/LogisticsMap';
import {DigitalWorldMap} from './digital/DigitalWorldMap';
import {CoinGrowth, CoinGrowthProps} from './coins/CoinGrowth';
import {COIN_VERSIONS} from './coins/versions';

const W = 3840;
const H = 2160;
const FPS = 30;

// Loop check: pass --props='{"loopCheck":true}' to make a looping composition
// 601 frames long so frame 600 can be compared with frame 0.
const loopLength = ({props}: {props: {loopCheck?: boolean}}) => ({durationInFrames: props.loopCheck ? 601 : 600});

export const RemotionRoot: React.FC = () => (
  <>
    {(['World', 'Asia', 'Routes'] as const).map((v) => (
      <Composition
        key={v}
        id={`LogisticsMap-${v}`}
        component={LogisticsMap}
        durationInFrames={600}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{version: v, loopCheck: false} satisfies LogisticsMapProps}
        calculateMetadata={loopLength}
      />
    ))}
    <Composition
      id="DigitalWorldMap-Cyan"
      component={DigitalWorldMap}
      durationInFrames={600}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{loopCheck: false}}
      calculateMetadata={loopLength}
    />
    {Object.keys(COIN_VERSIONS).map((v) => (
      <Composition
        key={v}
        id={COIN_VERSIONS[v].id}
        component={CoinGrowth}
        durationInFrames={450}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{version: v} satisfies CoinGrowthProps}
      />
    ))}
  </>
);
