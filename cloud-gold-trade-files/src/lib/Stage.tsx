import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, getRemotionEnvironment, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";

export type LookContext<P> = {
  gl: THREE.WebGLRenderer;
  /** drawing-buffer size in device pixels */
  width: number;
  height: number;
  props: P;
};
export type Look = {
  /** Draw this frame. Must depend on `frame` only (no clocks, no carried state). */
  render: (frame: number) => void;
  dispose?: () => void;
};
export type LookFactory<P> = (ctx: LookContext<P>) => Promise<Look>;

function Driver<P>({ factory, props }: { factory: LookFactory<P>; props: P }) {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Building three.js scene (assets, geometry, shaders)"));
  const look = useRef<Look | null>(null);

  useEffect(() => {
    let alive = true;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    factory({ gl, width: size.x, height: size.y, props })
      .then((l) => {
        if (!alive) return;
        look.current = l;
        l.render(frameRef.current);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
      look.current?.dispose?.();
      look.current = null;
    };
    // Built once per tab; frames are then drawn in any order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Priority 1 = we take over R3F's render. The frame number comes from
  // useCurrentFrame(); R3F's clock is never read.
  useFrame(() => {
    look.current?.render(frameRef.current);
  }, 1);
  return null;
}

export function Stage<P>({ factory, props }: { factory: LookFactory<P>; props: P }) {
  const { width, height } = useVideoConfig();
  const dpr = useMemo(() => {
    const env = getRemotionEnvironment();
    const base = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    // Studio preview: draw at <=720p so scrubbing stays interactive.
    const target = env.isRendering ? base : Math.min(base, 1280 / width);
    // three.js floors width*dpr; nudge so 3840*(1/3) lands on exactly 1280.
    const px = Math.round(width * target);
    return (px + 0.25) / width;
  }, [width]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, stencil: false, powerPreference: "high-performance" }}
      >
        <Driver factory={factory} props={props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
