/** Every component in sequence, one section each. */
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SECTION, THEME } from './theme';
import { NeonStrokeDemo } from './compositions/NeonStrokeDemo';
import { MidpointDemo } from './compositions/MidpointDemo';
import { RandomDemo } from './compositions/RandomDemo';
import { EffectsDemo } from './compositions/EffectsDemo';
import { DofDemo } from './compositions/DofDemo';
import { StrokesDemo } from './compositions/StrokesDemo';
import { ShapesDemo } from './compositions/ShapesDemo';
import { TrendingWalkDemo } from './compositions/TrendingWalkDemo';
import { ParticleMaskDemo } from './compositions/ParticleMaskDemo';
import { DotMapDemo } from './compositions/DotMapDemo';

const ORDER = [
  NeonStrokeDemo,
  StrokesDemo,
  MidpointDemo,
  RandomDemo,
  ShapesDemo,
  ParticleMaskDemo,
  TrendingWalkDemo,
  DofDemo,
  EffectsDemo,
  DotMapDemo,
] as const;

export const SECTIONS = ORDER.length;

export const LibDemo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
    {ORDER.map((Component, i) => (
      <Sequence key={i} from={i * SECTION} durationInFrames={SECTION}>
        <Component />
      </Sequence>
    ))}
  </AbsoluteFill>
);
