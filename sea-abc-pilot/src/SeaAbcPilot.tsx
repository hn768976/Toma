import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { WideShot } from './scenes/WideShot';
import { LetterCloseUp } from './scenes/LetterCloseUp';
import { Finale } from './scenes/Finale';
import { Soundtrack } from './Soundtrack';
import './fonts';

/**
 * Sea ABC pilot — 450 frames @ 30fps (120 BPM, one beat = 15 frames).
 * Each scene converts its local Sequence frame back to the global frame number
 * so the keyframes in the code match the shot list.
 */
export const SeaAbcPilot: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#2B6F8F' }}>
      <Sequence name="Wide: clam, pop-out, swim, point"  durationInFrames={150}>
        <WideShot />
      </Sequence>
      <Sequence name="Close-up: A B C D" from={150} durationInFrames={195}>
        <LetterCloseUp />
      </Sequence>
      <Sequence name="Wide: cheer" from={345} durationInFrames={105}>
        <Finale />
      </Sequence>
      <Sequence name="Audio" layout="none">
        <Soundtrack />
      </Sequence>
    </AbsoluteFill>
  );
};
