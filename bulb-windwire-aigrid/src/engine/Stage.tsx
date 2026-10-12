import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import type { WebGLRenderer } from "three";

/** A look builds its static content once, then draws any frame on demand. */
export type LookInstance = {
  /** Draw `frame`. Must depend on nothing but `frame` and the build-time layout. */
  render: (frame: number) => void;
  dispose: () => void;
};
export type LookFactory = (gl: WebGLRenderer) => LookInstance;

const Driver: React.FC<{ create: LookFactory; onFirst: () => void }> = ({ create, onFirst }) => {
  const { gl } = useThree();
  const frame = useCurrentFrame();
  const inst = useRef<LookInstance | null>(null);
  const first = useRef(true);

  // Render synchronously in a layout effect: it runs in the same commit as
  // @remotion/three's own frame handshake, before Remotion takes the
  // screenshot. R3F's own (empty) scene render draws nothing because
  // autoClear is off and the default scene is empty.
  useLayoutEffect(() => {
    if (!inst.current) {
      gl.autoClear = false;
      inst.current = create(gl);
    }
    inst.current.render(frame);
    if (first.current) {
      first.current = false;
      onFirst();
    }
  }, [frame, gl, create, onFirst]);

  useLayoutEffect(
    () => () => {
      inst.current?.dispose();
      inst.current = null;
    },
    [],
  );
  return null;
};

/**
 * Hosts a look inside @remotion/three's ThreeCanvas. `prepare` (fonts, canvas
 * textures) is awaited behind delayRender before the canvas is mounted.
 */
export const Stage: React.FC<{ create: LookFactory; prepare?: () => Promise<void> }> = ({ create, prepare }) => {
  const { width, height } = useVideoConfig();
  const [ready, setReady] = useState(!prepare);
  const [firstHandle] = useState(() => delayRender("Waiting for first WebGL frame"));
  const [prepHandle] = useState(() => (prepare ? delayRender("Preparing look assets") : null));
  useLayoutEffect(() => {
    if (!prepare || prepHandle === null) return;
    prepare().then(
      () => {
        setReady(true);
        continueRender(prepHandle);
      },
      (e) => {
        throw e;
      },
    );
  }, [prepare, prepHandle]);
  const onFirst = useRef(() => continueRender(firstHandle)).current;

  // dpr = devicePixelRatio so that `--scale` sets the real drawing-buffer size
  // (R3F would otherwise clamp to >= 1 and render 4K for a 720p preview).
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {ready ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false, powerPreference: "high-performance" }}
        >
          <Driver create={create} onFirst={onFirst} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
