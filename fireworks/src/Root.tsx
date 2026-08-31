import {Composition} from 'remotion';
import {Fireworks} from './Fireworks';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './variants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FireworksBlue"
        component={Fireworks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'blue' as const}}
      />
      <Composition
        id="FireworksBlack"
        component={Fireworks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'black' as const}}
      />
    </>
  );
};
