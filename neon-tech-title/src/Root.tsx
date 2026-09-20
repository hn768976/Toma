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
  theme: z.enum(['standard', 'dark']),
  hubScale: z.number(),
});

const base = {
  fps: FPS,
  durationInFrames: DURATION_IN_FRAMES,
  schema,
  component: Scene,
} as const;

/** Processor size. v3/v4 sit the hub a little smaller under the word. */
const HUB_STANDARD = 1.55;
const HUB_SMALL = 1.3;

const common = { backend: 'auto' as const, postprocessing: true };

const V1 = { ...common, word: 'INNOVATION', variant: 'blue' as const, theme: 'standard' as const, hubScale: HUB_STANDARD };
const V2 = { ...common, word: 'TECHNOLOGY', variant: 'red' as const, theme: 'standard' as const, hubScale: HUB_STANDARD };
/** v3 / v4: same scene, deeper grade, smaller hub. */
const V3 = { ...common, word: 'INNOVATION', variant: 'blue' as const, theme: 'dark' as const, hubScale: HUB_SMALL };
const V4 = { ...common, word: 'TECHNOLOGY', variant: 'red' as const, theme: 'dark' as const, hubScale: HUB_SMALL };

export const RemotionRoot: React.FC = () => (
  <>
    {/* ---- delivery: 1080p ---- */}
    <Composition {...base} id="InnovationBlue1080" width={WIDTH_1080} height={HEIGHT_1080} defaultProps={V1} />
    <Composition {...base} id="TechnologyRed1080" width={WIDTH_1080} height={HEIGHT_1080} defaultProps={V2} />
    <Composition {...base} id="InnovationBlueDark1080" width={WIDTH_1080} height={HEIGHT_1080} defaultProps={V3} />
    <Composition {...base} id="TechnologyRedDark1080" width={WIDTH_1080} height={HEIGHT_1080} defaultProps={V4} />

    {/* ---- mastering: 4K ---- */}
    <Composition {...base} id="InnovationBlue4K" width={WIDTH_4K} height={HEIGHT_4K} defaultProps={V1} />
    <Composition {...base} id="TechnologyRed4K" width={WIDTH_4K} height={HEIGHT_4K} defaultProps={V2} />
    <Composition {...base} id="InnovationBlueDark4K" width={WIDTH_4K} height={HEIGHT_4K} defaultProps={V3} />
    <Composition {...base} id="TechnologyRedDark4K" width={WIDTH_4K} height={HEIGHT_4K} defaultProps={V4} />
  </>
);
