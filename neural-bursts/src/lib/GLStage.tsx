import React, { useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PostPipeline, PostSettings } from "./post";

export type StageContext = {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  /** Multiplier that turns "pixels at 1080p" into pixels at render size. */
  px: number;
};

export type StageFrame = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  post: PostSettings;
};

export type Stage = {
  /** Pure function of time: must not depend on previously rendered frames. */
  update: (time: number, frame: number) => StageFrame;
  dispose: () => void;
};

export type StageFactory = (ctx: StageContext) => Stage;

/**
 * Hosts an imperative Three.js scene inside a Remotion composition.
 * The renderer is created once; every frame we call `update(time)` and
 * render synchronously, so output is deterministic per frame index.
 */
const syncPixel = new Uint8Array(4);

export const GLStage: React.FC<{ factory: StageFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<{
    stage: Stage;
    post: PostPipeline;
    renderer: THREE.WebGLRenderer;
  } | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL stage"));
  const continued = useRef(false);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.autoClear = false;
      const stage = factory({ renderer, width, height, px: height / 1080 });
      const post = new PostPipeline(renderer, width, height);
      stageRef.current = { stage, post, renderer };
    } catch (err) {
      cancelRender(err);
    }
    return () => {
      stageRef.current?.stage.dispose();
      stageRef.current?.post.dispose();
      stageRef.current?.renderer.dispose();
      stageRef.current = null;
    };
  }, [factory, width, height]);

  useLayoutEffect(() => {
    const s = stageRef.current;
    if (!s) return;
    const { scene, camera, post } = s.stage.update(frame / fps, frame);
    s.post.render(scene, camera, post);
    // Make sure the GPU has finished before Remotion screenshots the frame:
    // reading a pixel back forces a full pipeline flush (stronger than finish()).
    const gl = s.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncPixel);
    if (!continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [frame, fps, handle, factory, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
