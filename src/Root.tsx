import React from 'react';
import {Composition} from 'remotion';
import {CodeFlythrough} from './CodeFlythrough';
import * as C from './CodeFlythrough/constants';
import {VARIANT_LIST} from './CodeFlythrough/variant';

/**
 * Two cuts of the same shot, plus a one-frame-longer copy of each so that
 * `npm run verify-loop` can render frame 0 and frame N and prove they are
 * pixel-identical.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VARIANT_LIST.map((v) => (
        <React.Fragment key={v.id}>
          <Composition
            id={v.compositionId}
            component={CodeFlythrough}
            defaultProps={{variant: v.id}}
            durationInFrames={v.durationInFrames}
            fps={C.FPS}
            width={C.WIDTH}
            height={C.HEIGHT}
          />
          <Composition
            id={`${v.compositionId}LoopCheck`}
            component={CodeFlythrough}
            defaultProps={{variant: v.id}}
            durationInFrames={v.durationInFrames + 1}
            fps={C.FPS}
            width={C.WIDTH}
            height={C.HEIGHT}
          />
        </React.Fragment>
      ))}
    </>
  );
};
