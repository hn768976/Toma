import React from 'react';
import {Composition} from 'remotion';
import {BeautyMolecule, BeautyMoleculeProps} from './BeautyMolecule';
import {BACKGROUNDS, COLOURS, FPS, HEIGHT, LOOP_FRAMES, WIDTH, compositionId} from './data';

// One composition per BACKGROUND x COLOUR row (src/data.ts).
// Pass --props='{"loopCheck":true}' to get 601 frames for the loop check
// (frame 600 must equal frame 0 pixel for pixel).
export const RemotionRoot: React.FC = () => (
  <>
    {BACKGROUNDS.flatMap((b) =>
      COLOURS.map((c) => (
        <Composition
          key={compositionId(b, c)}
          id={compositionId(b, c)}
          component={BeautyMolecule}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{background: b.id, colour: c.id} as BeautyMoleculeProps}
          calculateMetadata={({props}) => ({
            durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
          })}
        />
      )),
    )}
  </>
);
