import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import { Vector2, type WebGLRenderer } from "three";
import { loadFonts } from "./fonts";

/**
 * A look is an imperative three.js pipeline. `render(frame)` must derive every
 * value from `frame` alone: no clocks, no carried state, no Math.random().
 */
export type Stage = { render: (frame: number) => void; dispose: () => void };
export type StageFactory = (gl: WebGLRenderer, width: number, height: number) => Stage;

type Sync = {
  rendered: number;
  init: number | null;
  pending: { frame: number; handle: number } | null;
};

const Driver: React.FC<{ factory: StageFactory; frame: number; sync: Sync }> = ({
  factory,
  frame,
  sync,
}) => {
  const gl = useThree((s) => s.gl);
  const stageRef = useRef<{ stage: Stage; w: number; h: number } | null>(null);

  useEffect(
    () => () => {
      stageRef.current?.stage.dispose();
      stageRef.current = null;
    },
    [],
  );

  // Render synchronously in the same commit as <ThreeCanvas/>'s own frame
  // advance; release our delayRender handles only after the draw.
  useLayoutEffect(() => {
    gl.autoClear = false;
    const size = gl.getDrawingBufferSize(new Vector2());
    let s = stageRef.current;
    if (!s || s.w !== size.x || s.h !== size.y) {
      s?.stage.dispose();
      s = { stage: factory(gl, size.x, size.y), w: size.x, h: size.y };
      stageRef.current = s;
    }
    s.stage.render(frame);
    gl.getContext().finish();
    sync.rendered = frame;
    if (sync.init !== null) {
      continueRender(sync.init);
      sync.init = null;
    }
    if (sync.pending && sync.pending.frame === frame) {
      continueRender(sync.pending.handle);
      sync.pending = null;
    }
  }, [gl, factory, frame, sync]);

  return null;
};

export const GLStage: React.FC<{ factory: StageFactory; label: string }> = ({ factory, label }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  const [initHandle] = useState(() =>
    delayRender(`GL stage init: ${label}`, { timeoutInMilliseconds: 180000 }),
  );
  const [fontsReady, setFontsReady] = useState(false);
  const sync = useMemo<Sync>(() => ({ rendered: -1, init: initHandle, pending: null }), [initHandle]);

  useEffect(() => {
    // Fonts are a one-time load gate (text textures are built once, after it).
    loadFonts().then(() => setFontsReady(true));
  }, []);

  useLayoutEffect(() => {
    if (sync.init !== null || sync.rendered === frame) return;
    const handle = delayRender(`GL frame ${frame}: ${label}`, { timeoutInMilliseconds: 180000 });
    sync.pending = { frame, handle };
    return () => {
      if (sync.pending && sync.pending.handle === handle) {
        continueRender(handle);
        sync.pending = null;
      }
    };
  }, [frame, sync, label]);

  // Rendering: one drawing-buffer pixel per output pixel (scale flag sets the
  // device pixel ratio). Studio: half resolution keeps scrubbing responsive.
  const dpr =
    typeof window === "undefined"
      ? 1
      : isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 0.5);

  if (!fontsReady) return null;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <Driver factory={factory} frame={frame} sync={sync} />
    </ThreeCanvas>
  );
};
