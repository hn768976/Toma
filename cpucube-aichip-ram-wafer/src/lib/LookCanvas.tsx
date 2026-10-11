import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { loadFonts } from "./fonts";
import { LOOP } from "./loop";
import { PostPipeline, PostSettings } from "./post";

const NO_WRAP = process.env.REMOTION_NO_WRAP === "1";

export interface LookInstance {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  post: PostSettings;
  /** Set every object for this frame. Must depend on `frame` only. */
  update: (frame: number) => void;
  dispose?: () => void;
}

export type LookFactory<P> = (params: P, renderer: THREE.WebGLRenderer) => LookInstance;

const Inner = <P,>({ factory, params }: { factory: LookFactory<P>; params: P }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const look = useMemo(() => factory(params, gl), [factory, params, gl]);
  const post = useMemo(() => new PostPipeline(), []);
  useEffect(() => () => {
    look.dispose?.();
    post.dispose();
  }, [look, post]);
  // priority 1: we take over rendering. The callback ignores R3F's clock and
  // reads only the Remotion frame number.
  useFrame(() => {
    // Normally time is wrapped to the loop. REMOTION_NO_WRAP=1 (loop check only)
    // evaluates frame 600 directly, so the check proves every motion closes.
    const f = NO_WRAP ? frameRef.current : ((frameRef.current % LOOP) + LOOP) % LOOP;
    look.update(f);
    look.camera.updateMatrixWorld();
    post.render(gl, look.scene, look.camera, look.post, f);
  }, 1);
  return null;
};

export const LookCanvas = <P,>({ factory, params }: { factory: LookFactory<P>; params: P }) => {
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadFonts().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [continueRender, handle]);
  // Render at the output scale (window.devicePixelRatio is Remotion's --scale
  // while rendering). The studio preview is capped to keep it interactive.
  const dpr =
    typeof window === "undefined"
      ? 1
      : getRemotionEnvironment().isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {ready ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", alpha: false }}
          camera={{ position: [0, 0, 5] }}
        >
          <Inner factory={factory} params={params} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
