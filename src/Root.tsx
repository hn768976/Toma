import React from 'react';
import {Composition} from 'remotion';
import {CodeFlythrough} from './CodeFlythrough';
import * as C from './CodeFlythrough/constants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CodeFlythrough"
        component={CodeFlythrough}
        durationInFrames={540}
        fps={60}
        width={3840}
        height={2160}
      />
      {/*
        Same shot, one frame longer, so that `npm run verify-loop` can render
        frame 0 and frame 540 and prove they are pixel-identical.
      */}
      <Composition
        id="CodeFlythroughLoopCheck"
        component={CodeFlythrough}
        durationInFrames={C.DURATION + 1}
        fps={C.FPS}
        width={C.WIDTH}
        height={C.HEIGHT}
      />
    </>
  );
};
