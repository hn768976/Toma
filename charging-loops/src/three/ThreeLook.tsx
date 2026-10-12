import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostPipeline, PostSettings } from "./post";

// A look builds its own scene once, then poses it from the frame number.
export type LookInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // Pure function of the frame: sets every transform / uniform and returns
  // the post settings for that frame.
  update: (frame: number) => PostSettings;
  dispose?: () => void;
};
export type LookFactory = (gl: THREE.WebGLRenderer, aspect: number) => LookInstance;

const Renderer: React.FC<{ factory: LookFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { gl, size } = useThree();

  const look = useMemo(() => factory(gl, size.width / size.height), [factory, gl, size]);
  const post = useMemo(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    return new PostPipeline(v.x, v.y);
  }, [gl, size]);

  useEffect(
    () => () => {
      look.dispose?.();
      post.dispose();
    },
    [look, post],
  );

  // Priority 1 takes over rendering from R3F. The R3F clock/delta passed to
  // this callback is ignored: the frame comes from Remotion only.
  useFrame(() => {
    const f = frameRef.current;
    const settings = look.update(f);
    post.render(gl, look.scene, look.camera, f, settings);
  }, 1);
  return null;
};

export const ThreeLook: React.FC<{ factory: LookFactory }> = ({ factory }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        gl={{
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <Renderer factory={factory} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
