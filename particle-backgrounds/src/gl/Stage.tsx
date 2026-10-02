import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Composer, PostSettings } from "./Composer";

export type FrameInfo = {
  frame: number;
  /** drawing-buffer size in device pixels */
  width: number;
  height: number;
};

export type Look = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  post: PostSettings;
  /** Set every uniform / camera value from the frame number alone. */
  update: (info: FrameInfo) => void;
  dispose?: () => void;
};

const LookRenderer: React.FC<{ create: (gl: THREE.WebGLRenderer) => Look }> = ({ create }) => {
  const frame = useCurrentFrame();
  // A ref only forwards this render's frame number into the r3f render callback;
  // nothing is carried from one frame to the next.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);

  const look = useMemo(() => create(gl), [create, gl]);
  const composer = useMemo(() => new Composer(gl, look.post), [gl, look]);
  useEffect(
    () => () => {
      composer.dispose();
      look.dispose?.();
    },
    [composer, look],
  );

  // Priority 1 = we own the render. Remotion calls advance() once per frame.
  useFrame(() => {
    const width = gl.domElement.width;
    const height = gl.domElement.height;
    const f = frameRef.current;
    look.camera.aspect = width / height;
    look.update({ frame: f, width, height });
    look.camera.updateProjectionMatrix();
    composer.render(look.scene, look.camera, f, width, height);
  }, 1);
  return null;
};

export const GLStage: React.FC<{ create: (gl: THREE.WebGLRenderer) => Look }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  // While rendering, Remotion's --scale sets devicePixelRatio, so the drawing
  // buffer is exactly the output size (1280x720 at --scale=1/3, 3840x2160 at 1).
  // In the Studio we cap it so live preview stays interactive.
  const dpr = useMemo(() => {
    const d = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    return getRemotionEnvironment().isRendering ? d : Math.min(d, 0.5);
  }, []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{
          antialias: false,
          alpha: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <LookRenderer create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
