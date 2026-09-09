import React from 'react';
import {Composition} from 'remotion';
import {
  FPS,
  LOOP_FRAMES,
  MASTER_HEIGHT,
  MASTER_WIDTH,
  V1_CYAN_COPPER,
  V2_TEAL_MAGENTA,
  V3_VIOLET_GOLD,
  type SceneConfig,
} from './config';
import {DataFlowScene} from './scene/DataFlowScene';

const versions: SceneConfig[] = [V1_CYAN_COPPER, V2_TEAL_MAGENTA, V3_VIOLET_GOLD];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Masters — 3840x2160. These are what you render for delivery. */}
      {versions.map((config) => (
        <Composition
          key={config.id}
          id={config.id}
          component={DataFlowScene}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={MASTER_WIDTH}
          height={MASTER_HEIGHT}
          defaultProps={{config}}
        />
      ))}
      {/*
        1080p previews. Every size in the scene — line widths, glyph sizes,
        DOF blur radii, chromatic aberration — is authored in master pixels and
        scaled by height/2160, so these are pixel-equivalent to the 4K master
        downscaled, and roughly four times cheaper to render.
      */}
      {versions.map((config) => (
        <Composition
          key={`${config.id}-1080`}
          id={`${config.id}-1080`}
          component={DataFlowScene}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={MASTER_WIDTH / 2}
          height={MASTER_HEIGHT / 2}
          defaultProps={{config}}
        />
      ))}
      {/*
        Same scene, one frame longer, so `--frame=600` can be rendered and
        diffed against frame 0 to prove the loop is seamless.
      */}
      <Composition
        id="loop-check"
        component={DataFlowScene}
        durationInFrames={LOOP_FRAMES + 1}
        fps={FPS}
        width={MASTER_WIDTH}
        height={MASTER_HEIGHT}
        defaultProps={{config: V1_CYAN_COPPER}}
      />
    </>
  );
};
