import { useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";

/** A look: builds its GPU resources once, then draws any frame on demand. */
export interface World {
  /** Draw frame `frame`. Must depend on `frame` and nothing else. */
  render(gl: THREE.WebGLRenderer, frame: number): void;
  dispose(): void;
}

const Driver: React.FC<{ world: World }> = ({ world }) => {
  // The only time source is Remotion's frame number. R3F's useFrame is used
  // purely as the "draw now" hook (priority 1 = we own the render); its clock
  // and delta arguments are ignored.
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useFrame(({ gl }) => world.render(gl, frameRef.current), 1);
  useEffect(() => () => world.dispose(), [world]);
  return null;
};

export const GLStage: React.FC<{ create: () => World; deps: unknown[] }> = ({
  create,
  deps,
}) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo(create, deps);
  // When rendering, draw at the real output size (composition size x --scale).
  // In the Studio, draw at 720p so the preview stays interactive.
  const dpr =
    isRendering && typeof window !== "undefined"
      ? window.devicePixelRatio
      : 1280 / width;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        linear
        flat
        gl={{
          antialias: false,
          alpha: false,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <Driver world={world} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
