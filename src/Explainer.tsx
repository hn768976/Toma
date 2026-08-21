import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {COLORS} from './lib/theme';
import {SCENES} from './lib/timeline';
import {Scene1Cut} from './scenes/Scene1Cut';
import {Scene2Route} from './scenes/Scene2Route';
import {Scene3Reassembly} from './scenes/Scene3Reassembly';
import {NarrationOverlay} from './components/NarrationOverlay';

export type ExplainerProps = {
  /** Burn the voiceover script into the frame as a timing guide. */
  showNarration: boolean;
};

/**
 * Hard cuts between scenes, no crossfades: each Sequence owns a contiguous,
 * non-overlapping frame range, so a scene is either on or off. There is no
 * frame on which two scenes are both mounted.
 */
export const Explainer: React.FC<ExplainerProps> = ({showNarration}) => (
  <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
    <Sequence
      from={SCENES.cut.from}
      durationInFrames={SCENES.cut.duration}
      name="1 — The Cut"
    >
      <Scene1Cut />
    </Sequence>

    <Sequence
      from={SCENES.route.from}
      durationInFrames={SCENES.route.duration}
      name="2 — The Route"
    >
      <Scene2Route />
    </Sequence>

    <Sequence
      from={SCENES.reassembly.from}
      durationInFrames={SCENES.reassembly.duration}
      name="3 — The Reassembly"
    >
      <Scene3Reassembly />
    </Sequence>

    {showNarration ? <NarrationOverlay /> : null}
  </AbsoluteFill>
);
