import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./lib/loop";
import { RateBoard } from "./looks/board/RateBoard";
import { BLUE, RED } from "./looks/board/data";
import { GlitchDotMap } from "./looks/map/GlitchDotMap";
import { LightStreaks } from "./looks/streaks/LightStreaks";
import { BLUE_MAGENTA, GOLD } from "./looks/streaks/palettes";

// Importing fonts.ts registers the font-loading delayRender before frame 0.
import "./lib/fonts";

/**
 * `extendForLoopCheck` makes a composition 601 frames long so frame 600 can be
 * rendered and compared with frame 0:
 *   npx remotion still GlitchDotMap-Mono out/f600.png --frame=600 --props='{"extendForLoopCheck":true}'
 */
export interface LoopProps {
  extendForLoopCheck?: boolean;
  [key: string]: unknown;
}

const BoardRed: React.FC = () => <RateBoard palette={RED} />;
const BoardBlue: React.FC = () => <RateBoard palette={BLUE} />;
const StreaksBlueMagenta: React.FC = () => <LightStreaks palette={BLUE_MAGENTA} />;
const StreaksGold: React.FC = () => <LightStreaks palette={GOLD} />;

const common = {
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: LOOP_FRAMES,
  defaultProps: {} as LoopProps,
  calculateMetadata: ({ props }: { props: LoopProps }) => ({
    durationInFrames: props.extendForLoopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
  }),
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="RateBoard-Red" component={BoardRed} {...common} />
    <Composition id="RateBoard-Blue" component={BoardBlue} {...common} />
    <Composition id="LightStreaks-BlueMagenta" component={StreaksBlueMagenta} {...common} />
    <Composition id="LightStreaks-Gold" component={StreaksGold} {...common} />
    <Composition id="GlitchDotMap-Mono" component={GlitchDotMap} {...common} />
  </>
);
