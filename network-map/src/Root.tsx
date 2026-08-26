import {Composition} from 'remotion';
import {FPS, FRAME_HEIGHT, FRAME_WIDTH, LOOP_FRAMES} from './config';
import {NetworkMap} from './NetworkMap';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NetworkMapGlobal"
        component={NetworkMap}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        defaultProps={{variant: 'global' as const}}
      />
      <Composition
        id="NetworkMapEurope"
        component={NetworkMap}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        defaultProps={{variant: 'europe' as const}}
      />
    </>
  );
};
