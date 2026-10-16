import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { LOOP_FRAMES } from "../loop";

// Hosts a hand-built three.js scene inside @remotion/three's <ThreeCanvas>.
// R3F only supplies the WebGL2 context and the "advance once per Remotion
// frame" call. A priority-1 useFrame callback takes over rendering; it reads
// nothing from R3F's clock, only the Remotion frame (folded into the loop).

export type SceneController = {
  render: (loopFrame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (renderer: THREE.WebGLRenderer) => SceneController;

const Driver: React.FC<{ factory: SceneFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const { delayRender, continueRender } = useDelayRender();
  const ctrl = useMemo(() => {
    // Textures and environment maps are generated synchronously in the
    // factory; hold the render until they are built and the programs compile.
    const handle = delayRender("Building three.js scene");
    const c = factory(gl);
    continueRender(handle);
    return c;
  }, [gl, factory, delayRender, continueRender]);
  useEffect(() => () => ctrl.dispose(), [ctrl]);
  useFrame(() => {
    ctrl.render(((frameRef.current % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES);
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ factory: SceneFactory }> = ({ factory }) => {
  const { width, height } = useVideoConfig();
  // Render at the output resolution: Remotion's --scale sets devicePixelRatio,
  // so a 3840×2160 composition at scale 1/3 draws a 1280×720 buffer.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
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
        stencil: false,
        depth: true,
      }}
      style={{ backgroundColor: "black" }}
    >
      <Driver factory={factory} />
    </ThreeCanvas>
  );
};
