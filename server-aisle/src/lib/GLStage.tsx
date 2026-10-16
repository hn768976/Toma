import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NoToneMapping, SRGBColorSpace, WebGLRenderer } from "three";
import {
  cancelRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";

export type LookRuntime = {
  /** Draws `frame`. Must depend on nothing but `frame`. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type LookBuilder = (gl: WebGLRenderer) => Promise<LookRuntime> | LookRuntime;

const Runner: React.FC<{ build: LookBuilder }> = ({ build }) => {
  const { gl } = useThree();
  const frame = useCurrentFrame();
  const { delayRender, continueRender } = useDelayRender();
  const [runtime, setRuntime] = useState<LookRuntime | null>(null);
  const [handle] = useState(() => delayRender("Building scene, textures and fonts"));
  const released = useRef(false);

  // A priority > 0 subscriber stops R3F from auto-rendering its own (empty)
  // scene. It reads no clock: every frame is drawn below from `frame` only.
  useFrame(() => undefined, 1);

  useEffect(() => {
    let alive = true;
    let built: LookRuntime | null = null;
    gl.toneMapping = NoToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    Promise.resolve(build(gl))
      .then((rt) => {
        built = rt;
        if (alive) setRuntime(rt);
        else rt.dispose();
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
      built?.dispose();
    };
  }, [build, gl]);

  // Layout effect: runs before @remotion/three releases the frame, so the
  // canvas is drawn synchronously for exactly this frame.
  useLayoutEffect(() => {
    if (!runtime) return;
    runtime.render(frame);
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [runtime, frame, continueRender, handle]);

  return null;
};

export const GLStage: React.FC<{ build: LookBuilder }> = ({ build }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  // When rendering, the device pixel ratio equals Remotion's --scale, so the
  // drawing buffer is exactly the output size (1280x720 at 1/3, 6000x3375 at
  // 1.5625). In the Studio, preview at half size to stay interactive.
  const dpr = isRendering && typeof window !== "undefined" ? window.devicePixelRatio : 0.5;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ backgroundColor: "black" }}
    >
      <Runner build={build} />
    </ThreeCanvas>
  );
};
