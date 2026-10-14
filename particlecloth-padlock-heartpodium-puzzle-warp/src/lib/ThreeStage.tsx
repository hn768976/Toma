import React, { useEffect, useMemo, useRef, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { loopFrame, renderDpr } from "./loop";

/**
 * An imperatively-built three.js world. `update(frame)` must set *every*
 * animated value from the frame number alone; `render()` draws it.
 */
export interface World {
  update: (frame: number) => void;
  render: (renderer: THREE.WebGLRenderer, loopFrame: number) => void;
  dispose: () => void;
}

export type WorldFactory = (renderer: THREE.WebGLRenderer, width: number, height: number) => World;

const Inner: React.FC<{ factory: WorldFactory; frameRef: React.MutableRefObject<number>; onReady: () => void }> = ({
  factory,
  frameRef,
  onReady,
}) => {
  const gl = useThree((s) => s.gl);
  const world = useMemo(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    return factory(gl, size.x, size.y);
  }, [gl, factory]);
  useEffect(() => {
    onReady();
    return () => world.dispose();
  }, [world, onReady]);
  // Priority 1 takes over R3F's render. This is only a "draw now" hook:
  // the R3F clock/delta are never read; everything comes from the Remotion frame.
  useFrame(() => {
    const f = frameRef.current;
    world.update(f);
    world.render(gl, loopFrame(f));
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ factory: WorldFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const frameRef = useRef(frame);
  frameRef.current = frame; // set during render, before ThreeCanvas advances
  const [handle] = useState(() => delayRender("Building world (geometry + textures)"));
  const ready = useMemo(() => {
    let done = false;
    return () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
  }, [handle]);
  const dpr = useMemo(() => renderDpr(), []);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
      >
        <Inner factory={factory} frameRef={frameRef} onReady={ready} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
