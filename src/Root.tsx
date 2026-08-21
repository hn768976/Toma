import React from 'react';
import {Composition} from 'remotion';
import {Explainer} from './Explainer';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './lib/timeline';

const shared = {
  component: Explainer,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    {/* The deliverable. Fixed 1920x1080 -- nothing reflows. */}
    <Composition
      id="InternetMessage"
      {...shared}
      defaultProps={{showNarration: false}}
    />
    {/* Same film with the VO script burned in, for timing takes. */}
    <Composition
      id="InternetMessageVOGuide"
      {...shared}
      defaultProps={{showNarration: true}}
    />
  </>
);
