import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Post, PostParams } from "./post";

export type LookHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // Pure function of the frame: set every animated value, return post params.
  update: (frame: number) => PostParams;
};

export type LookFactory = (ctx: {
  renderer: THREE.WebGLRenderer;
  aspect: number;
  pixelHeight: number;
}) => LookHandle;

const Runner: React.FC<{ create: LookFactory; frame: number; pw: number; ph: number }> = ({
  create,
  frame,
  pw,
  ph,
}) => {
  const gl = useThree((s) => s.gl);
  // The current Remotion frame, read inside the render callback below.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const state = useMemo(() => {
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    const handle = create({ renderer: gl, aspect: pw / ph, pixelHeight: ph });
    return { handle, post: null as Post | null };
  }, [gl, create, pw, ph]);

  // Priority 1 takes over R3F's render. R3F's clock/delta are never read:
  // every value comes from the Remotion frame number.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    if (!state.post || state.post.width !== size.x || state.post.height !== size.y) {
      state.post?.dispose();
      state.post = new Post(gl, size.x, size.y);
    }
    const f = frameRef.current;
    const params = state.handle.update(f);
    state.post.render(state.handle.scene, state.handle.camera, params);
  }, 1);

  return null;
};

export const GLStage: React.FC<{ create: LookFactory }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const devDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  // three floors width*dpr; nudge so 3840 × 0.3333… gives exactly 1280.
  const pw = Math.round(width * devDpr);
  const ph = Math.round(height * devDpr);
  const dpr = (pw + 0.25) / width;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      style={{ position: "absolute", left: 0, top: 0 }}
      gl={{
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
    >
      <Runner create={create} frame={frame} pw={pw} ph={ph} />
    </ThreeCanvas>
  );
};
