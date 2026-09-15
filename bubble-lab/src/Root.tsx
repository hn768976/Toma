import React from 'react';
import { Composition } from 'remotion';

import { BubbleComposition } from './Composition';
import { VERSIONS } from './versions';

/**
 * Every version is registered twice: a 4K master (3840x2160) and a 1080p
 * proxy. The masters are the deliverable compositions; the 1080p entries make
 * scrubbing in the studio usable.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((config) => (
      <React.Fragment key={config.id}>
        <Composition
          id={config.id}
          component={BubbleComposition}
          durationInFrames={config.durationInFrames}
          fps={30}
          width={3840}
          height={2160}
          defaultProps={{ config }}
        />
        <Composition
          id={`${config.id}-1080p`}
          component={BubbleComposition}
          durationInFrames={config.durationInFrames}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ config }}
        />
      </React.Fragment>
    ))}
  </>
);
