import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { ThreeWebGPUCanvas } from '@remotion/three/webgpu';
import { PALETTE, type NeonKey } from './lib/palette';
import { Stage } from './three/Stage';
import { CAMERA, FAR } from './three/Stage';
import { useBackend, type Backend } from './three/backend';
import { useNeonFont } from './lib/useNeonFont';

export type SceneProps = {
  word: string;
  variant: NeonKey;
  /** 'auto' probes WebGPU first and falls back to WebGL2 then WebGL. */
  backend: Backend | 'auto';
  postprocessing: boolean;
};

export const Scene: React.FC<SceneProps> = ({ word, variant, backend, postprocessing }) => {
  const { width, height } = useVideoConfig();
  const resolved = useBackend(backend);
  const fontReady = useNeonFont();

  // The 4K comp is a straight 2x of 1080p, so effect radii are scaled to match.
  const resolutionScale = width / 1920;

  const cameraProps = {
    fov: CAMERA.fov,
    near: 0.1,
    far: FAR,
  };

  // Mount the canvas only once both the backend and the font are settled.
  if (resolved === null || !fontReady) {
    return <AbsoluteFill style={{ backgroundColor: PALETTE.bg }} />;
  }

  const stage = (
    <Stage
      word={word}
      variant={variant}
      resolutionScale={resolutionScale}
      postprocessing={postprocessing}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
      {resolved === 'webgpu' ? (
        <ThreeWebGPUCanvas
          width={width}
          height={height}
          shadows
          camera={cameraProps}
          style={{ width, height }}
        >
          {stage}
        </ThreeWebGPUCanvas>
      ) : (
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          camera={cameraProps}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            // Forces the WebGL1 path when WebGL2 is unavailable.
            ...(resolved === 'webgl' ? { forceWebGL: true } : {}),
          }}
          style={{ width, height }}
        >
          {stage}
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
