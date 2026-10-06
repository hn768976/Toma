import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import { cancelRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostFX, PostParams } from "./post";

// Uniforms shared by every material of a look; the Stage writes uRes before
// each render, the look writes uDof / uTime from the current frame.
export type Shared = {
  uRes: THREE.IUniform<THREE.Vector2>;
  uDof: THREE.IUniform<THREE.Vector3>;
  uTime: THREE.IUniform<number>;
};
export const makeShared = (): Shared => ({
  uRes: { value: new THREE.Vector2(1280, 720) },
  uDof: { value: new THREE.Vector3(10, 0, 0) },
  uTime: { value: 0 },
});

// Renders the R3F scene through PostFX. useFrame is used only as the render
// hook (priority 1 takes over R3F's own render); it never reads R3F's clock —
// every value comes from useCurrentFrame().
const PostRenderer: React.FC<{
  camera: THREE.Camera;
  post: PostParams;
  clear: THREE.Color;
  shared: Shared;
}> = ({ camera, post, clear, shared }) => {
  const frame = useCurrentFrame();
  const { gl, scene } = useThree();
  const fx = useMemo(() => {
    // Fail the render loudly on any shader compile/link error.
    gl.debug.onShaderError = (ctx, _prog, vs, fs) => {
      const log = [vs, fs].map((sh) => ctx.getShaderInfoLog(sh)).join("\n");
      cancelRender(new Error(`Shader error: ${log}`));
    };
    return new PostFX();
  }, [gl]);
  const state = useRef({ frame, post, clear });
  state.current = { frame, post, clear };
  useFrame(() => {
    const s = state.current;
    gl.getDrawingBufferSize(shared.uRes.value);
    fx.render(gl, scene, camera, s.frame, s.post, s.clear);
  }, 1);
  return null;
};

export const Stage: React.FC<{
  camera: THREE.PerspectiveCamera;
  post: PostParams;
  clear: string;
  shared: Shared;
  children: React.ReactNode;
}> = ({ camera, post, clear, shared, children }) => {
  const { width, height } = useVideoConfig();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const clearColor = useMemo(() => new THREE.Color(clear), [clear]);
  // Render at exactly the composition size times the render scale
  // (window.devicePixelRatio is the --scale factor while rendering).
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      style={{ backgroundColor: clear }}
    >
      <PostRenderer camera={camera} post={post} clear={clearColor} shared={shared} />
      {children}
    </ThreeCanvas>
  );
};
