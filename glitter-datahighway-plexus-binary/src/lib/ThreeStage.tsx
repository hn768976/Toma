// Wraps @remotion/three's <ThreeCanvas> and takes over rendering with a
// manual post pipeline. All state is derived from useCurrentFrame(): the
// frame is stored in a ref during render and read in the takeover callback,
// which R3F runs when Remotion advances it once per frame. The R3F clock is
// never read.
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostOptions, PostPipeline } from "./post";
import { loopFrame } from "./random";

export type SceneBuilder = (ctx: { width: number; height: number; maxAniso: number }) => {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Pose everything for a loop frame (0..599). Pure function of f. */
  update: (f: number) => void;
  post: PostOptions;
  dispose?: () => void;
};

const Runner: React.FC<{ build: SceneBuilder; frameRef: React.RefObject<number> }> = ({ build, frameRef }) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const width = Math.round(size.width * gl.getPixelRatio());
  const height = Math.round(size.height * gl.getPixelRatio());
  const built = useMemo(
    () => build({ width, height, maxAniso: gl.capabilities.getMaxAnisotropy() }),
    [build, width, height, gl],
  );
  const post = useMemo(() => new PostPipeline(width, height, built.post), [built, width, height]);
  useEffect(() => () => { post.dispose(); built.dispose?.(); }, [post, built]);

  // Priority 1 = render takeover. Ignores R3F's clock entirely.
  useFrame(() => {
    const f = loopFrame(frameRef.current);
    built.camera.aspect = width / height;
    built.camera.updateProjectionMatrix();
    built.update(f);
    post.render(gl, built.scene, built.camera, f);
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ build: SceneBuilder }> = ({ build }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Render at device pixels: --scale=1/3 renders a 1280x720 buffer, not 4K.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Runner build={build} frameRef={frameRef} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
