import React from 'react';
import { Composition } from 'remotion';
import { BrushStrokeReveal, BRUSH_STROKE_FRAMES } from './clips/BrushStrokeReveal';
import { CirclesHighlights, CIRCLES_HIGHLIGHTS_FRAMES } from './clips/CirclesHighlights';
import { Countdown, COUNTDOWN_FRAMES } from './clips/Countdown';
import { DoodleArrows, DOODLE_ARROWS_FRAMES } from './clips/DoodleArrows';
import { LikeSubscribe, LIKE_SUBSCRIBE_FRAMES } from './clips/LikeSubscribe';
import { ScribbleWipe, SCRIBBLE_WIPE_FRAMES } from './clips/ScribbleWipe';
import { SpeechBubbles, SPEECH_BUBBLES_FRAMES } from './clips/SpeechBubbles';
import { StarsSparkles, STARS_SPARKLES_FRAMES } from './clips/StarsSparkles';
import { TitleFrame, TITLE_FRAME_FRAMES } from './clips/TitleFrame';
import { UnderlinesStrikes, UNDERLINES_STRIKES_FRAMES } from './clips/UnderlinesStrikes';
import { FPS, H, W } from './lib/config';

// Remotion composition ids may not contain "_", so GS_DoodleArrows is
// registered as GS-DoodleArrows (render output keeps the underscore name).
const clips: [string, React.FC, number][] = [
  ['GS-DoodleArrows', DoodleArrows, DOODLE_ARROWS_FRAMES],
  ['GS-CirclesHighlights', CirclesHighlights, CIRCLES_HIGHLIGHTS_FRAMES],
  ['GS-UnderlinesStrikes', UnderlinesStrikes, UNDERLINES_STRIKES_FRAMES],
  ['GS-StarsSparkles', StarsSparkles, STARS_SPARKLES_FRAMES],
  ['GS-SpeechBubbles', SpeechBubbles, SPEECH_BUBBLES_FRAMES],
  ['GS-ScribbleWipe', ScribbleWipe, SCRIBBLE_WIPE_FRAMES],
  ['GS-BrushStrokeReveal', BrushStrokeReveal, BRUSH_STROKE_FRAMES],
  ['GS-TitleFrame', TitleFrame, TITLE_FRAME_FRAMES],
  ['GS-LikeSubscribe', LikeSubscribe, LIKE_SUBSCRIBE_FRAMES],
  ['GS-Countdown', Countdown, COUNTDOWN_FRAMES],
];

export const RemotionRoot: React.FC = () => (
  <>
    {clips.map(([id, component, frames]) => (
      <Composition key={id} id={id} component={component} durationInFrames={frames} fps={FPS} width={W} height={H} />
    ))}
  </>
);
