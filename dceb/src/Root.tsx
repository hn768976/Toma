import React from "react";
import { Composition } from "remotion";
import { CardRain } from "./looks/CardRain";
import { CoinGrowth } from "./looks/CoinGrowth";
import { DiamondRelief } from "./looks/DiamondRelief";
import { NetworkEarth } from "./looks/NetworkEarth";
import { WireframeBulb } from "./looks/WireframeBulb";
import { cardRain, coinGrowth, diamondRelief, FPS, HEIGHT, LOOP_FRAMES, networkEarth, STORY_FRAMES, WIDTH, wireframeBulb } from "./versions";

// The verify loop renders frame 600 to prove the loops close; it sets
// LOOP_CHECK=1 in the environment of the bundler to get 601-frame loops.
const loopFrames = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {diamondRelief.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={DiamondRelief}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={v.props}
      />
    ))}
    {cardRain.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={CardRain}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={v.props}
      />
    ))}
    {networkEarth.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={NetworkEarth}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={v.props}
      />
    ))}
    {wireframeBulb.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={WireframeBulb}
        durationInFrames={loopFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={v.props}
      />
    ))}
    {coinGrowth.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={CoinGrowth}
        durationInFrames={STORY_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={v.props}
      />
    ))}
  </>
);
