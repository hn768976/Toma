import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostPipeline, PostSettings } from "./pipeline";

/** Everything a look needs to draw one frame. */
export type FrameInfo = {
  /** Frame used for animation (already wrapped modulo the loop length for loops). */
  frame: number;
  /** Drawing-buffer size in device pixels. */
  width: number;
  height: number;
  /** Drawing-buffer height / 1080: multiply pixel sizes (points, lines) by this. */
  px: number;
};

export interface Look {
  /** Draw the HDR image. `pipe.beginHDR(gl)` has already bound + cleared the target. */
  render(gl: THREE.WebGLRenderer, pipe: PostPipeline, f: FrameInfo): void;
  dispose(): void;
}

type DriverProps = {
  create: () => Look;
  post: PostSettings;
  loopFrames?: number;
  msaa?: number;
  /** Debug: don't wrap the animation frame (proves the motion itself is periodic). */
  noWrap?: boolean;
};

const Driver: React.FC<DriverProps> = ({ create, post, loopFrames, msaa = 0, noWrap = false }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const look = useMemo(() => create(), [create]);
  const pipe = useMemo(() => new PostPipeline(1, 1, msaa), [msaa]);
  // The frame is the only input. It's latched in a layout effect, which runs
  // before <ThreeCanvas/>'s passive effect calls advance() for this frame.
  const frameRef = useRef(frame);
  useLayoutEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(
    () => () => {
      look.dispose();
      pipe.dispose();
    },
    [look, pipe],
  );

  // Priority 1 = we own rendering. The R3F clock/delta is never read: every
  // value comes from the Remotion frame.
  useFrame(() => {
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    pipe.setSize(buf.x, buf.y);
    const raw = frameRef.current;
    const wrapped = loopFrames ? ((raw % loopFrames) + loopFrames) % loopFrames : raw;
    const animFrame = noWrap ? raw : wrapped;
    const info: FrameInfo = { frame: animFrame, width: buf.x, height: buf.y, px: buf.y / 1080 };
    pipe.beginHDR(gl);
    look.render(gl, pipe, info);
    pipe.finish(gl, wrapped, post);
  }, 1);

  return null;
};

export const Stage: React.FC<DriverProps> = (props) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // When rendering, honour Remotion's --scale (it sets devicePixelRatio), so a
  // 3840×2160 composition at --scale=0.5 really draws 1920×1080 pixels.
  // In the Studio, preview at a 1080p buffer.
  const dpr = isRendering && typeof window !== "undefined" ? window.devicePixelRatio : 0.5;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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
          premultipliedAlpha: false,
        }}
        onCreated={({ gl }) => {
          gl.autoClear = false;
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        }}
      >
        <Driver {...props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
