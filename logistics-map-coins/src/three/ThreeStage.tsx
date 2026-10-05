import React, {useMemo, useRef} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {PostPipeline} from './Post';

// A scene controller is plain imperative three.js. `render(frame)` must derive
// everything it draws from `frame` alone (no clocks, no carried state).
export interface SceneController {
  render(frame: number, pipeline: PostPipeline): void;
  dispose?(): void;
}

type Factory = (gl: THREE.WebGLRenderer, width: number, height: number) => SceneController;

const Driver: React.FC<{create: Factory; frame: number}> = ({create, frame}) => {
  const {gl} = useThree();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const state = useMemo(() => {
    const pipeline = new PostPipeline(gl);
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    pipeline.setSize(size.x, size.y);
    return {pipeline, controller: create(gl, size.x, size.y)};
  }, [gl, create]);
  // Priority 1 = we take over rendering. ThreeCanvas calls advance() once per
  // Remotion frame while rendering; the clock argument is ignored here.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    state.pipeline.setSize(size.x, size.y);
    state.controller.render(frameRef.current, state.pipeline);
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{create: Factory}> = ({create}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  // Render at the output resolution: R3F's default dpr clamp ([1,2]) would
  // otherwise draw at full 4K even for scaled-down previews.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false}}
    >
      <Driver create={create} frame={frame} />
    </ThreeCanvas>
  );
};
