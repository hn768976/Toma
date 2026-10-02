import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo, useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostFX, PostParams } from "./post";

export type BuiltScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clear: THREE.Color;
  post: PostParams;
  // Sets every value in the scene from the frame number alone.
  update: (frame: number, info: { width: number; height: number; pxScale: number }) => void;
  // Grain/dither period so loop frames 0 and N match exactly.
  grainPeriod: number;
};

// Pixel density: during a render this is exactly Remotion's --scale (so a
// 3840×2160 composition at --scale=1/3 draws a 1280×720 buffer); in the
// Studio it's capped to keep scrubbing responsive.
const pickDpr = () => {
  const d = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return getRemotionEnvironment().isRendering ? d : Math.min(d, 0.4);
};

const Driver: React.FC<{ build: (gl: THREE.WebGLRenderer) => BuiltScene; frame: number }> = ({ build, frame }) => {
  const { gl } = useThree();
  const built = useMemo(() => build(gl), [build, gl]);
  const post = useMemo(() => new PostFX(gl), [gl]);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Priority 1 → we own the render. The callback ignores R3F's clock and
  // reads only the Remotion frame.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const f = frameRef.current;
    built.camera.aspect = size.x / size.y;
    built.update(f, { width: size.x, height: size.y, pxScale: size.y / 2160 });
    built.camera.updateProjectionMatrix();
    built.camera.updateMatrixWorld();
    post.render(built.scene, built.camera, ((f % built.grainPeriod) + built.grainPeriod) % built.grainPeriod, built.post, built.clear);
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ build: (gl: THREE.WebGLRenderer) => BuiltScene }> = ({ build }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = useMemo(pickDpr, []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        linear
        flat
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: 50, near: 0.1, far: 1000 }}
      >
        <Driver build={build} frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
