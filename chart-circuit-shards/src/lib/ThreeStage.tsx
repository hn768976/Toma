import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { PostPipeline, PostParams } from './post';
import { AssetNeeds, Assets, loadAssets } from './assets';

/** What every look provides: a scene, a camera and pure functions of the frame. */
export type LookInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Sets every animated property from `frame` alone. */
  update: (frame: number, aspect: number, viewHeightPx: number) => void;
  post: (frame: number) => PostParams;
};

export type LookFactory = (assets: Assets, gl: THREE.WebGLRenderer) => LookInstance;

const Runner: React.FC<{ factory: LookFactory; assets: Assets }> = ({ factory, assets }) => {
  const frame = useCurrentFrame();
  const { gl } = useThree();
  // The Remotion frame is the only clock. useFrame below is used purely as the
  // render hook (priority 1 = we own rendering); its clock/delta are ignored.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const look = useMemo(() => {
    // Any shader compile error aborts the render instead of producing black frames.
    gl.debug.onShaderError = (ctx, program) => {
      cancelRender(new Error('Shader compile error: ' + ctx.getProgramInfoLog(program)));
    };
    return factory(assets, gl);
  }, [factory, assets, gl]);
  const post = useMemo(() => new PostPipeline(gl), [gl]);
  const size = useMemo(() => new THREE.Vector2(), []);
  useEffect(() => () => post.dispose(), [post]);
  useFrame(() => {
    const f = frameRef.current;
    gl.getDrawingBufferSize(size);
    post.setSize(size.x, size.y);
    look.update(f, size.x / size.y, size.y);
    post.render(look.scene, look.camera, f, look.post(f));
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ factory: LookFactory; needs: AssetNeeds }> = ({ factory, needs }) => {
  const { width, height } = useVideoConfig();
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender('Loading HDRI / map data', { timeoutInMilliseconds: 120000 }));
  useEffect(() => {
    loadAssets(needs)
      .then((a) => setAssets(a))
      .catch((e) => cancelRender(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Release the asset handle only after <ThreeCanvas> has mounted and taken its
  // own handle, so there is never a moment with nothing pending.
  useEffect(() => {
    if (assets) continueRender(handle);
  }, [assets, handle]);

  const { isRendering } = getRemotionEnvironment();
  // When rendering, Remotion's --scale sets devicePixelRatio, so the WebGL
  // backing store is exactly the output size (1280x720 at --scale=1/3).
  // In the Studio, cap the preview so it stays interactive.
  const dpr = isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
        >
          <Runner factory={factory} assets={assets} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
