import {Composition} from 'remotion';
import {CandleMacro} from './CandleMacro';
import {DURATION, FPS, HEIGHT, WIDTH} from './config';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CandleMacroBear"
        component={CandleMacro}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'bear' as const}}
      />
      <Composition
        id="CandleMacroBull"
        component={CandleMacro}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'bull' as const}}
      />
    </>
  );
};
