import {Composition} from 'remotion';
import {AiChatHero} from './AiChatHero';
import {CONFIG} from './config';

/**
 * Both variants render from the same component. Everything that separates them —
 * palette, badge glyph, and the motif beside the badge — arrives as data: a
 * THEMES entry plus these defaultProps.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AiChatHero"
        component={AiChatHero}
        durationInFrames={CONFIG.durationInFrames}
        fps={CONFIG.fps}
        width={CONFIG.width}
        height={CONFIG.height}
        defaultProps={{variant: 'blue' as const, badge: 'AI'}}
      />
      <Composition
        id="AiChatHeroDark"
        component={AiChatHero}
        durationInFrames={CONFIG.durationInFrames}
        fps={CONFIG.fps}
        width={CONFIG.width}
        height={CONFIG.height}
        defaultProps={{variant: 'dark' as const, badge: 'BOT'}}
      />
    </>
  );
};
