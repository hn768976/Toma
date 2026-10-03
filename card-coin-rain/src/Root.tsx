import React from "react";
import { Composition } from "remotion";
import { CardRain, CardRainProps } from "./CardRain";
import { FPS, LOOP } from "./lib/loop";

const metadata = ({ props }: { props: CardRainProps }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="CardRain-Gold"
      component={CardRain}
      durationInFrames={LOOP}
      fps={FPS}
      width={3840}
      height={2160}
      defaultProps={{ look: "gold" } as CardRainProps}
      calculateMetadata={metadata}
    />
    <Composition
      id="CardRain-GoldPlain"
      component={CardRain}
      durationInFrames={LOOP}
      fps={FPS}
      width={3840}
      height={2160}
      defaultProps={{ look: "goldPlain" } as CardRainProps}
      calculateMetadata={metadata}
    />
    <Composition
      id="CardRain-RoseGold"
      component={CardRain}
      durationInFrames={LOOP}
      fps={FPS}
      width={3840}
      height={2160}
      defaultProps={{ look: "rose" } as CardRainProps}
      calculateMetadata={metadata}
    />
  </>
);
