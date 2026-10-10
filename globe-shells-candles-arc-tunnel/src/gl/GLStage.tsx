import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { PostChain, PostSettings } from "./post";
import { loopFrame } from "../lib/loop";

export type LookContext = {
  // Actual drawing-buffer size in pixels (3840x2160 at full scale,
  // 1280x720 with --scale=1/3).
  width: number;
  height: number;
  // Pixel scale relative to the 4K design size.
  px: number;
};

export type Look = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  post: PostSettings;
  bloomLevels?: number;
  // Set every uniform / transform from the loop frame (0..599) and nothing else.
  update: (f: number) => void;
  dispose: () => void;
};

export type LookFactory = (ctx: LookContext) => Look;

const Driver: React.FC<{ factory: LookFactory; frameRef: React.MutableRefObject<number> }> = ({
  factory,
  frameRef,
}) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const bw = Math.round(size.width * dpr);
  const bh = Math.round(size.height * dpr);

  const look = useMemo(
    () => factory({ width: bw, height: bh, px: bh / 2160 }),
    [factory, bw, bh],
  );
  const post = useMemo(
    () => new PostChain(gl, bw, bh, look.bloomLevels ?? 6),
    [gl, bw, bh, look],
  );
  useEffect(() => () => look.dispose(), [look]);
  useEffect(() => () => post.dispose(), [post]);

  // Priority 1 takes over R3F's own render; the R3F clock is never read.
  useFrame(() => {
    const f = loopFrame(frameRef.current);
    look.update(f);
    post.render(look.scene, look.camera, look.post, f);
    pending.current.forEach((h) => continueRender(h));
    pending.current = [];
  }, 1);

  const frame = useCurrentFrame();
  const pending = useRef<number[]>([]);
  useLayoutEffect(() => {
    pending.current.push(delayRender(`GL frame ${frame}`));
  }, [frame]);
  return null;
};

export const GLStage: React.FC<{ factory: LookFactory }> = ({ factory }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      linear
      flat
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <Driver factory={factory} frameRef={frameRef} />
    </ThreeCanvas>
  );
};
