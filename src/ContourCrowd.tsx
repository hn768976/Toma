import React from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {cameraPose} from './cameraPath';
import {CONFIG} from './config';
import {Scene} from './Scene';
import {THEMES, type VariantName} from './theme';

export type ContourCrowdProps = {
  variant: VariantName;
};

/**
 * Final 2D layer: fine animated film grain at ~4% alpha. The SVG turbulence
 * pattern is deterministic per seed; cycling the seed with the frame keeps
 * the grain alive without any wall-clock randomness.
 */
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = 1 + (frame % 24);
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280">` +
      `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter>` +
      `<rect width="280" height="280" filter="url(#g)"/></svg>`,
  );
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,${svg}")`,
        backgroundRepeat: 'repeat',
        opacity: CONFIG.grainAlpha,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
};

export const ContourCrowd: React.FC<ContourCrowdProps> = ({variant}) => {
  const theme = THEMES[variant];
  const {width, height} = useVideoConfig();
  const startPose = cameraPose(0);

  return (
    <AbsoluteFill style={{backgroundColor: theme.bgDeep}}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        flat
        gl={{antialias: false, stencil: false, alpha: false}}
        camera={{
          fov: CONFIG.camera.fov,
          near: CONFIG.camera.near,
          far: CONFIG.camera.far,
          position: startPose.position,
        }}
      >
        <Scene theme={theme} />
      </ThreeCanvas>
      <Grain />
    </AbsoluteFill>
  );
};
