import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, HEIGHT_4K, WIDTH_4K} from './core/constants';
import {V1Slab} from './versions/V1Slab';
import {V2Cylinder} from './versions/V2Cylinder';
import {V3WideDisc} from './versions/V3WideDisc';
import {V4GlassBeam} from './versions/V4GlassBeam';
import {V5Ringed} from './versions/V5Ringed';

/**
 * Every composition is authored natively at 4K/30.
 * The 1080p deliverable is the same composition rendered with `--scale=0.5`.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-Slab-4K"
        component={V1Slab}
        durationInFrames={DURATION.slab}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
      />
      <Composition
        id="V2-Cylinder-4K"
        component={V2Cylinder}
        durationInFrames={DURATION.cylinder}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
      />
      <Composition
        id="V3-WideDisc-4K"
        component={V3WideDisc}
        durationInFrames={DURATION.wideDisc}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
      />
      <Composition
        id="V4-GlassBeam-4K"
        component={V4GlassBeam}
        durationInFrames={DURATION.glassBeam}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
      />
      <Composition
        id="V5-Ringed-4K"
        component={V5Ringed}
        durationInFrames={DURATION.ringed}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
      />
    </>
  );
};
