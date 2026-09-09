import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Grain} from '../shared/Grain';
import {GridPlane} from './GridPlane';
import {TRACK_LENGTH} from './track';
import {Waveform} from './Waveform';

const BACKGROUND = '#02040a';
const WAVE_COLOR = '#ff2a5a';

/** Camera home position. Low and close to the plane. */
const CAM_HOME: [number, number, number] = [0, 1.55, 0];
/**
 * Where it points. Pitched down about 7 degrees, which puts the vanishing point
 * above the frame centre and lets the plane fill the frame — the grid then runs
 * out into black on the distance fade rather than stopping at a visible horizon.
 * Yawed so that vanishing point sits right of centre and the waveform crosses
 * the frame diagonally.
 */
const CAM_TARGET: [number, number, number] = [5.09, -1.45, 10.44];

const CameraRig: React.FC<{
  position: THREE.Vector3;
  target: THREE.Vector3;
}> = ({position, target}) => {
  const camera = useThree((s) => s.camera);

  useLayoutEffect(() => {
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  });

  return null;
};

const Scene: React.FC<{frame: number; durationInFrames: number}> = ({
  frame,
  durationInFrames,
}) => {
  const color = useMemo(() => new THREE.Color(WAVE_COLOR), []);

  // A float well under 1% of the frame, completing exactly one cycle over the
  // composition so the camera returns to where it started.
  const turn = (frame / durationInFrames) * Math.PI * 2;
  const position = useMemo(
    () =>
      new THREE.Vector3(
        CAM_HOME[0] + Math.sin(turn) * 0.013,
        CAM_HOME[1] + Math.sin(turn + 1.4) * 0.009,
        CAM_HOME[2],
      ),
    [turn],
  );
  const target = useMemo(
    () =>
      new THREE.Vector3(
        CAM_TARGET[0] + Math.sin(turn + 0.7) * 0.02,
        CAM_TARGET[1],
        CAM_TARGET[2],
      ),
    [turn],
  );

  // Exactly one waveform period over the composition: that is the loop.
  const scroll = (frame / durationInFrames) * TRACK_LENGTH;

  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <CameraRig position={position} target={target} />

      {/* Below the plane first, then the transparent grid over it, so the
          reflection reads as light sitting inside the surface. */}
      <Waveform
        scroll={scroll}
        cameraPosition={position}
        color={color}
        y={-0.02}
        thickness={0.11}
        heightScale={2.1}
        gain={0.2}
        soft
        renderOrder={0}
        fadeStart={5}
        fadeEnd={20}
      />

      <GridPlane
        cameraPosition={[position.x, position.y, position.z]}
        renderOrder={1}
      />

      {/* Soft halo, then the core on top of it. */}
      <Waveform
        scroll={scroll}
        cameraPosition={position}
        color={color}
        y={0.014}
        thickness={0.08}
        heightScale={2.4}
        gain={0.5}
        soft
        renderOrder={2}
        fadeStart={8}
        fadeEnd={28}
      />
      <Waveform
        scroll={scroll}
        cameraPosition={position}
        color={color}
        y={0.03}
        thickness={0.022}
        heightScale={1.0}
        gain={1.0}
        renderOrder={3}
        fadeStart={9}
        fadeEnd={30}
      />
    </>
  );
};

/**
 * V2 — waveform on a grid plane.
 *
 * A real 3D scene, not a faked one: the grid is a plane in perspective and the
 * waveform lies on it, so the two share one vanishing point and the waveform
 * foreshortens as it recedes. Faking this in 2D falls apart the moment the
 * waveform has to sit convincingly *on* the surface.
 */
export const V2WaveformGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  return (
    <AbsoluteFill style={{backgroundColor: BACKGROUND}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{fov: 38, near: 0.05, far: 400}}
        gl={{antialias: true}}
        style={{position: 'absolute', inset: 0}}
      >
        <Scene frame={frame} durationInFrames={durationInFrames} />
      </ThreeCanvas>

      <Grain opacity={0.035} blend="screen" />
    </AbsoluteFill>
  );
};
