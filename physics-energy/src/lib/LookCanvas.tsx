import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useRemotionEnvironment } from "remotion";
import { loadFonts } from "./fonts";
import { HEIGHT, WIDTH } from "./loop";

export interface Look {
  render(frame: number): void;
  dispose(): void;
}
export interface LookOptions {
  /** debug view used for the physics check (bar magnets: straight top-down) */
  topDown?: boolean;
}
export type LookFactory = (gl: THREE.WebGLRenderer, width: number, height: number, opts: LookOptions) => Look;

/**
 * Hosts a look inside @remotion/three's <ThreeCanvas>. The look is plain
 * imperative three.js: R3F's useFrame is used only as the render hook (priority
 * 1 replaces R3F's own render call). The frame number comes from
 * useCurrentFrame() and nothing else; no R3F clock, no carried state.
 */
const Driver: React.FC<{ factory: LookFactory; opts: LookOptions }> = ({ factory, opts }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { gl, invalidate } = useThree();
  const lookRef = useRef<{ look: Look; w: number; h: number } | null>(null);
  const size = useRef(new THREE.Vector2());

  useFrame(() => {
    gl.getDrawingBufferSize(size.current);
    const w = size.current.x, h = size.current.y;
    if (!lookRef.current || lookRef.current.w !== w || lookRef.current.h !== h) {
      lookRef.current?.look.dispose();
      // Surface shader compile errors instead of rendering black.
      gl.debug.onShaderError = (ctx, program, vs, fs) => {
        const log = (sh: WebGLShader) => ctx.getShaderInfoLog(sh);
        throw new Error(`Shader error FS: ${log(fs)} VS: ${log(vs)}`.replace(/\n/g, " | "));
      };
      lookRef.current = { look: factory(gl, w, h, opts), w, h };
    }

    lookRef.current.look.render(frameRef.current);
  }, 1);

  useEffect(() => {
    invalidate();
  }, [frame, invalidate]);

  useEffect(
    () => () => {
      lookRef.current?.look.dispose();
      lookRef.current = null;
    },
    [],
  );
  return null;
};

export const LookCanvas: React.FC<{ factory: LookFactory; opts?: LookOptions }> = ({ factory, opts = {} }) => {
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);
  // Release the font handle only after <ThreeCanvas> has mounted and registered
  // its own delayRender, so no frame can be captured in between.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, continueRender, handle]);

  // Rendering: draw at the device scale Remotion sets from --scale (so a 720p
  // preview renders 1280x720 natively and a 4K render 3840x2160).
  // Studio: half resolution to stay interactive.
  const dpr = isRendering ? window.devicePixelRatio : 0.5;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {ready ? (
        <ThreeCanvas
          width={WIDTH}
          height={HEIGHT}
          dpr={dpr}
          flat
          linear
          frameloop="demand"
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Driver factory={factory} opts={opts} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
