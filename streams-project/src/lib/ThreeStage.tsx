import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Post, PostParams } from "./post";

// A look is built once (deterministically) and then posed purely from the
// frame number. The Post pipeline renders it.
export type ThreeLook = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  post: PostParams;
  msaa?: number;
  update: (frame: number, size: { w: number; h: number }) => void;
  dispose?: () => void;
};

const Driver: React.FC<{
  create: (gl: THREE.WebGLRenderer) => ThreeLook;
  frameRef: React.MutableRefObject<number>;
}> = ({ create, frameRef }) => {
  const gl = useThree((s) => s.gl);
  const look = useMemo(() => create(gl), [create, gl]);
  const post = useMemo(() => new Post(gl, look.post, look.msaa ?? 4), [gl, look]);
  useEffect(
    () => () => {
      post.dispose();
      look.dispose?.();
    },
    [post, look],
  );
  // Priority 1 → R3F hands rendering to us. We ignore R3F's clock and pose the
  // scene from the Remotion frame only.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const f = frameRef.current;
    look.update(f, { w: size.x, h: size.y });
    post.render(look.scene, look.camera, f);
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ create: (gl: THREE.WebGLRenderer) => ThreeLook }> = ({
  create,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Remotion's --scale sets devicePixelRatio; render the canvas at exactly the
  // output resolution (R3F would otherwise clamp dpr to >= 1).
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ background: "#000" }}
    >
      <Driver create={create} frameRef={frameRef} />
    </ThreeCanvas>
  );
};
