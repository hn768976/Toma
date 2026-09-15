import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useVideoConfig } from 'remotion';
import * as THREE from 'three';

import { BubbleScene } from './three/BubbleScene';
import { cameraDistance } from './lib/camera';
import type { VersionConfig } from './versions';

/**
 * Composition shell. The canvas is sized from the composition itself, so the
 * same component renders a 4K master and a 1080p deliverable with no changes —
 * `--scale` on the CLI is all that differs.
 */
export const BubbleComposition: React.FC<{ config: VersionConfig }> = ({ config }) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <ThreeCanvas
        width={width}
        height={height}
        orthographic={false}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: config.camera.fov, position: [0, 0, cameraDistance(config)], near: 0.1, far: 200 }}
        onCreated={({ gl }) => {
          // Everything downstream is authored in display space; letting three
          // apply its own transfer function on top would double-correct.
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <BubbleScene config={config} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
