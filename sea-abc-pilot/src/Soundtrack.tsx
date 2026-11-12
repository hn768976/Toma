import React from 'react';
import { Audio } from '@remotion/media';
import { staticFile } from 'remotion';

/**
 * Audio lives in its own layer so the placeholder beat can be swapped for the
 * real song later: replace public/audio/beat_placeholder.wav (or change SRC).
 * Placeholder: soft click every 15 frames (120 BPM @ 30 fps), accent every 4 beats.
 */
export const SOUNDTRACK_SRC = 'audio/beat_placeholder.wav';

export const Soundtrack: React.FC = () => <Audio src={staticFile(SOUNDTRACK_SRC)} volume={0.8} />;
