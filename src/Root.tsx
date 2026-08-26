import React from 'react';
import {Composition} from 'remotion';
import {WorkflowDiagram} from './WorkflowDiagram';
import {DURATION, FPS} from './timeline';
import {HEIGHT, WIDTH} from './geometry';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WorkflowMeal"
        component={WorkflowDiagram}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'meal' as const}}
      />
      <Composition
        id="WorkflowContent"
        component={WorkflowDiagram}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'content' as const}}
      />
    </>
  );
};
