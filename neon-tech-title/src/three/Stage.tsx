import React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import { PALETTE } from '../lib/palette';
import type { NeonKey } from '../lib/palette';
import { Board } from './Board';
import { Processor } from './Processor';
import { Traces } from './Traces';
import { Sparks } from './Sparks';
import { NeonText } from './NeonText';

/**
 * Camera rig. The reference is a locked-off shot -- diffing a text-free corner
 * across the clip showed no measurable parallax -- so the camera is static and
 * only the scene moves.
 */
export const CAMERA = {
  azimuth: THREE.MathUtils.degToRad(38),
  elevation: THREE.MathUtils.degToRad(30),
  distance: 19.0,
  fov: 33,
  /** Look-at point sits above the processor so it lands below frame centre. */
  target: [0, 2.9, 0] as [number, number, number],
};

export const FAR = 120;

export const cameraPosition = (): [number, number, number] => {
  const { azimuth, elevation, distance, target } = CAMERA;
  return [
    target[0] + distance * Math.sin(azimuth) * Math.cos(elevation),
    target[1] + distance * Math.sin(elevation),
    target[2] + distance * Math.cos(azimuth) * Math.cos(elevation),
  ];
};

const Rig: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  camera.position.set(...cameraPosition());
  camera.lookAt(...CAMERA.target);
  camera.updateProjectionMatrix();

  // The reference is a flat, clean CG render rather than a filmic grade.
  // Linear output keeps the sampled board and neon values predictable.
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;

  return null;
};

type Props = {
  word: string;
  variant: NeonKey;
  /** Scales effect radii so 4K matches 1080p visually. */
  resolutionScale: number;
  postprocessing: boolean;
};

export const Stage: React.FC<Props> = ({ word, variant, resolutionScale, postprocessing }) => {
  return (
    <>
      <Rig />
      <color attach="background" args={['#35485f']} />
      {/* Haze hides the far edge of the board and lifts the distance, the way
          the reference fades out toward the top of frame. */}
      <fogExp2 attach="fog" args={['#35485f', 0.0138]} />

      <ambientLight intensity={0.1} color="#8fa4c8" />
      <hemisphereLight args={['#a8bcdc', '#070a0f', 0.45]} />
      <directionalLight
        position={[-13, 16, 10]}
        intensity={4.3}
        color="#eef3ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={55}
        shadow-bias={-0.0007}
      />
      <directionalLight position={[15, 8, -12]} intensity={0.3} color="#7f9bd6" />
      <directionalLight position={[4, 6, 16]} intensity={0.2} color="#a8bce0" />

      <Board />
      <Traces />
      <group scale={1.55}>
        <Processor />
      </group>
      <Sparks />
      <NeonText word={word} variant={variant} />

      {postprocessing ? (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          {/* focusDistance and focalLength are normalised against the camera
              far plane, so they track CAMERA.distance and FAR rather than
              being magic numbers. */}
          <DepthOfField
            focusDistance={CAMERA.distance / FAR}
            focalLength={0.022}
            bokehScale={2.4 * resolutionScale}
          />
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.76}
            luminanceSmoothing={0.3}
            kernelSize={KernelSize.LARGE}
            mipmapBlur
          />
        </EffectComposer>
      ) : null}
    </>
  );
};
