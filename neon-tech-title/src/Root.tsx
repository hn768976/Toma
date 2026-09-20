import React from 'react';
import { Composition } from 'remotion';
import { z } from 'zod';
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT_1080,
  HEIGHT_4K,
  WIDTH_1080,
  WIDTH_4K,
} from './config';
import { Scene } from './Scene';

const schema = z.object({
  word: z.string(),
  variant: z.enum(['blue', 'red']),
  backend: z.enum(['auto', 'webgpu', 'webgl2', 'webgl']),
  postprocessing: z.boolean(),
});

const base = {
  fps: FPS,
  durationInFrames: DURATION_IN_FRAMES,
  schema,
  component: Scene,
} as const;

const V1 = { word: 'INNOVATION', variant: 'blue' as const, backend: 'auto' as const, postprocessing: true };
const V2 = { word: 'TECHNOLOGY', variant: 'red' as const, backend: 'auto' as const, postprocessing: true };

export const RemotionRoot: React.FC = () => (
  <>
    {/* ---- delivery: 1080p ---- */}
    <Composition
      {...base}
      id="InnovationBlue1080"
      width={WIDTH_1080}
      height={HEIGHT_1080}
      defaultProps={V1}
    />
    <Composition
      {...base}
      id="TechnologyRed1080"
      width={WIDTH_1080}
      height={HEIGHT_1080}
      defaultProps={V2}
    />

    {/* ---- mastering: 4K ---- */}
    <Composition
      {...base}
      id="InnovationBlue4K"
      width={WIDTH_4K}
      height={HEIGHT_4K}
      defaultProps={V1}
    />
    <Composition
      {...base}
      id="TechnologyRed4K"
      width={WIDTH_4K}
      height={HEIGHT_4K}
      defaultProps={V2}
    />
  </>
);
