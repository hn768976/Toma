import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {Bloom, DepthOfField, EffectComposer, Vignette} from '@react-three/postprocessing';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {cameraPose} from './cameraPath';
import {CONFIG} from './config';
import {Contours} from './Contours';
import {Dots} from './Dots';
import {Pins} from './Pins';
import {makeHeightField} from './terrain';
import type {Theme} from './theme';

/**
 * Writes the camera pose for the current frame. Everything derives from
 * useCurrentFrame() — no useFrame deltas, no clocks — so every render of a
 * given frame produces the identical camera.
 */
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  useLayoutEffect(() => {
    const c = CONFIG.camera;
    camera.fov = c.fov;
    camera.near = c.near;
    camera.far = c.far;
    camera.updateProjectionMatrix();

    const pose = cameraPose(frame / durationInFrames);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
  }, [camera, frame, durationInFrames]);

  return null;
};

/**
 * The horizon glow: a big gradient plane that rides along far ahead of the
 * camera, past where the contour lines have fully faded. The gradient peaks
 * at eye level (where the horizon sits) and falls off to the deep plum.
 */
const HazeBackdrop: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, theme.bgDeep);
    grad.addColorStop(0.34, theme.bgHaze);
    grad.addColorStop(0.55, theme.bgHaze);
    grad.addColorStop(0.75, theme.bgDeep);
    grad.addColorStop(1, theme.bgDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [theme]);

  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(460, 250);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    m.frustumCulled = false;
    return m;
  }, [texture]);

  useLayoutEffect(() => {
    const pose = cameraPose(frame / durationInFrames);
    const [x, y, z] = pose.position;
    // Slightly above eye level: the glow band hugs the visual horizon.
    mesh.position.set(x, y, z + 218);
  }, [mesh, frame, durationInFrames]);

  return <primitive object={mesh} />;
};

export const Scene: React.FC<{theme: Theme}> = ({theme}) => {
  const heightField = useMemo(() => makeHeightField(), []);
  const {dof, bloom, vignette, camera} = CONFIG;

  return (
    <>
      <color attach="background" args={[theme.bgDeep]} />
      <CameraRig />
      <HazeBackdrop theme={theme} />
      <Contours theme={theme} heightField={heightField} />
      <Dots theme={theme} heightField={heightField} />
      <Pins theme={theme} heightField={heightField} />
      <EffectComposer multisampling={0}>
        <DepthOfField
          focusDistance={dof.focusWorld / camera.far}
          focalLength={dof.focalLength}
          bokehScale={dof.bokehScale}
          height={dof.height}
        />
        <Bloom
          intensity={bloom.intensity}
          luminanceThreshold={bloom.luminanceThreshold}
          luminanceSmoothing={bloom.luminanceSmoothing}
          mipmapBlur={bloom.mipmapBlur}
          radius={bloom.radius}
        />
        <Vignette offset={vignette.offset} darkness={vignette.darkness} />
      </EffectComposer>
    </>
  );
};
