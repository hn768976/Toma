import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { loopFrame } from "./rng";

export interface LookInstance {
  /** Draw the frame. Must depend on `frame` (0..599) and nothing else. */
  render(frame: number): void;
  dispose(): void;
}
export type LookFactory<P> = (renderer: THREE.WebGLRenderer, props: P) => LookInstance;

// Renders exactly once per Remotion frame. R3F's useFrame is used only as the
// render hook (priority 1 replaces R3F's default render); its clock and delta
// are ignored. The frame number comes from useCurrentFrame() via a ref.
const Driver = <P,>({ factory, props, frame }: { factory: LookFactory<P>; props: P; frame: number }) => {
  const { gl, invalidate } = useThree();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const inst = useMemo(() => factory(gl, props), [gl, factory, props]);
  useEffect(() => () => inst.dispose(), [inst]);
  useEffect(() => invalidate(), [frame, invalidate]);
  useFrame(() => {
    let err = "";
    gl.debug.onShaderError = (ctx, prog, vs, fs) => {
      err = [ctx.getShaderInfoLog(vs), ctx.getShaderInfoLog(fs), ctx.getProgramInfoLog(prog)].join(" | ");
    };
    inst.render(loopFrame(frameRef.current));
    // three.js only logs shader failures; make them fail the render instead
    if (err) throw new Error("Shader compile/link error: " + err);
  }, 1);
  return null;
};

export const Stage = <P,>({
  factory,
  props,
  ready,
}: {
  factory: LookFactory<P>;
  props: P;
  ready?: () => Promise<unknown>;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [ok, setOk] = useState(!ready);
  useLayoutEffect(() => {
    if (!ready) return;
    const handle = delayRender("Loading font / atlas / environment");
    ready()
      .then(() => {
        setOk(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [ready, delayRender, continueRender, cancelRender]);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {ok ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          frameloop="demand"
          linear
          flat
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Driver factory={factory} props={props} frame={frame} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
