import {Composition} from 'remotion';
import {TerminalAlert} from './TerminalAlert';
import {DURATION, FPS, HEIGHT, WIDTH} from './lib/constants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AccessDenied"
        component={TerminalAlert}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'denied' as const}}
      />
      <Composition
        id="AccessGranted"
        component={TerminalAlert}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'granted' as const}}
      />
    </>
  );
};
