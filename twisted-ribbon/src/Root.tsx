import { Composition } from 'remotion';
import { TwistedRibbon } from './TwistedRibbon';
import {
  COMP_HEIGHT,
  COMP_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from './ribbon/params';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TwistedRibbonLight"
        component={TwistedRibbon}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ version: 'light' as const }}
      />
      <Composition
        id="TwistedRibbonDark"
        component={TwistedRibbon}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{ version: 'dark' as const }}
      />
    </>
  );
};
