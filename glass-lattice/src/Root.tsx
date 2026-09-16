import React from 'react';
import {Composition} from 'remotion';
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT_1080P,
  HEIGHT_4K,
  WIDTH_1080P,
  WIDTH_4K,
} from './constants';
import {GlassLattice} from './GlassLattice';
import {glassLatticeSchema, type GlassLatticeProps} from './theme';

const BLUE: GlassLatticeProps = {palette: 'blue', mirrored: false};
const VIOLET: GlassLatticeProps = {palette: 'violet', mirrored: true};

const shared = {
  component: GlassLattice,
  schema: glassLatticeSchema,
  durationInFrames: DURATION_IN_FRAMES,
  fps: FPS,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Mastering resolution. */}
      <Composition
        {...shared}
        id="GlassLattice-Blue-4K"
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={BLUE}
      />
      <Composition
        {...shared}
        id="GlassLattice-VioletMirror-4K"
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={VIOLET}
      />

      {/* Delivery resolution — identical framing, the scene is resolution independent. */}
      <Composition
        {...shared}
        id="GlassLattice-Blue-1080p"
        width={WIDTH_1080P}
        height={HEIGHT_1080P}
        defaultProps={BLUE}
      />
      <Composition
        {...shared}
        id="GlassLattice-VioletMirror-1080p"
        width={WIDTH_1080P}
        height={HEIGHT_1080P}
        defaultProps={VIOLET}
      />

      {/* Fast iteration only — same 16:9 framing, a fraction of the pixels. */}
      <Composition
        {...shared}
        id="GlassLattice-Preview"
        width={640}
        height={360}
        defaultProps={BLUE}
      />
    </>
  );
};
