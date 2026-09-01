import React from 'react';
import { Composition } from 'remotion';
import { FPS, WIDTH, HEIGHT, SECTION } from './theme';
import { LibDemo, SECTIONS } from './LibDemo';
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

const common = { width: WIDTH, height: HEIGHT, fps: FPS } as const;

/**
 * One composition per extracted component, plus `LibDemo` which plays them in
 * sequence. A component that cannot be shown in isolation is not properly
 * parameterised — every one of these renders standalone.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LibDemo"
      component={LibDemo}
      durationInFrames={SECTION * SECTIONS}
      {...common}
    />
    <Composition id="NeonStroke" component={NeonStrokeDemo} durationInFrames={SECTION} {...common} />
    <Composition id="MidpointDisplacement" component={MidpointDemo} durationInFrames={SECTION} {...common} />
    <Composition id="RandomHelpers" component={RandomDemo} durationInFrames={SECTION} {...common} />
    <Composition id="Effects" component={EffectsDemo} durationInFrames={SECTION} {...common} />
    <Composition id="ThreeBufferDOF" component={DofDemo} durationInFrames={SECTION} {...common} />
    <Composition id="Strokes" component={StrokesDemo} durationInFrames={SECTION} {...common} />
    <Composition id="Shapes" component={ShapesDemo} durationInFrames={SECTION} {...common} />
    <Composition id="TrendingWalk" component={TrendingWalkDemo} durationInFrames={SECTION} {...common} />
    <Composition id="ParticleFromMask" component={ParticleMaskDemo} durationInFrames={SECTION} {...common} />
    <Composition id="DotMap" component={DotMapDemo} durationInFrames={SECTION} {...common} />
  </>
);
