import {Composition} from 'remotion';
import {AiChatHero} from './AiChatHero';
import {CONFIG} from './config';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AiChatHero"
      component={AiChatHero}
      durationInFrames={CONFIG.durationInFrames}
      fps={CONFIG.fps}
      width={CONFIG.width}
      height={CONFIG.height}
      defaultProps={{variant: 'blue' as const}}
    />
  );
};
