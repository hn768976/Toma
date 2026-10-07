import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";

// A look renderer draws one complete frame (scene + post) given only the frame number.
export interface LookRenderer {
  setSize(w: number, h: number): void;
  render(frame: number): void;
  dispose(): void;
}

const Driver: React.FC<{ create: (gl: THREE.WebGLRenderer) => LookRenderer }> = ({ create }) => {
  const frame = useCurrentFrame();
  // Written during render so it is current before <ThreeCanvas> calls advance() in its effect.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const look = useMemo(() => create(gl), [gl, create]);
  useEffect(() => () => look.dispose(), [look]);
  const size = useMemo(() => new THREE.Vector2(), []);
  // Priority 1 takes over rendering from R3F. The callback ignores R3F's clock entirely:
  // the only input is the Remotion frame number.
  useFrame(() => {
    gl.getDrawingBufferSize(size);
    look.setSize(size.x, size.y);
    look.render(frameRef.current);
  }, 1);
  return null;
};

export const Stage: React.FC<{ create: (gl: THREE.WebGLRenderer) => LookRenderer }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // When rendering, the backing store follows Remotion's --scale (devicePixelRatio), so a
  // 3840x2160 composition rendered with --scale=1/3 draws a real 1280x720 frame.
  // In the Studio the preview is drawn at half size to keep it interactive.
  const dpr = isRendering ? window.devicePixelRatio : 0.5;
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
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          premultipliedAlpha: false,
        }}
        onCreated={({ gl }) => {
          gl.autoClear = false;
          THREE.ColorManagement.enabled = false;
        }}
      >
        <Driver create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
