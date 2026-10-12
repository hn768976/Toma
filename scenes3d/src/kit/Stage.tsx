import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { LookInstance, PostFX } from "./post";

export type LookFactory<P> = (params: P, gl: THREE.WebGLRenderer) => LookInstance;

const Driver = <P,>({ factory, params }: { factory: LookFactory<P>; params: P }) => {
  const frame = useCurrentFrame();
  // Read inside the render callback. Set during render, so it always holds
  // the frame Remotion is asking for before ThreeCanvas calls advance().
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const look = useMemo(() => factory(params, gl), [factory, params, gl]);
  const post = useMemo(() => new PostFX(gl), [gl]);
  useEffect(
    () => () => {
      look.dispose();
      post.dispose();
    },
    [look, post],
  );
  // Priority 1 replaces R3F's default render. The R3F clock is never read.
  useFrame(() => {
    post.render(look, frameRef.current);
  }, 1);
  return null;
};

/**
 * Hosts one look. `prepare` builds one-off assets (circuit textures) before
 * the canvas mounts; Remotion waits for it through delayRender.
 */
export const Stage = <P,>({
  factory,
  params,
  prepare,
}: {
  factory: LookFactory<P>;
  params: P;
  prepare?: () => Promise<void>;
}) => {
  const { width, height } = useVideoConfig();
  const [ready, setReady] = useState(!prepare);
  const [handle] = useState(() => (prepare ? delayRender("Building textures") : null));
  useEffect(() => {
    if (!prepare) return;
    let live = true;
    prepare().then(() => {
      if (!live) return;
      setReady(true);
      if (handle !== null) continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [prepare, handle]);
  // Render at the real output resolution (Remotion's --scale sets the dpr).
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {ready ? (
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
          }}
        >
          <Driver factory={factory} params={params} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
