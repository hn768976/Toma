import React, { useEffect, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * A rig owns all GPU resources for one look and renders one complete frame
 * (scene, DoF, bloom, composite) from the frame number and nothing else.
 */
export interface Rig {
  render(frame: number): void;
  dispose(): void;
}
export type RigFactory = (gl: THREE.WebGLRenderer, width: number, height: number) => Rig;

const Runner: React.FC<{ factory: RigFactory }> = ({ factory }) => {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const rigRef = useRef<{ rig: Rig; w: number; h: number } | null>(null);

  useEffect(() => {
    invalidate();
  }, [frame, invalidate]);

  useEffect(
    () => () => {
      rigRef.current?.rig.dispose();
      rigRef.current = null;
    },
    [],
  );

  // Priority 1 takes over rendering from R3F. The callback uses only the
  // current Remotion frame: no clock, no delta, no state carried between frames.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    let cur = rigRef.current;
    if (!cur || cur.w !== size.x || cur.h !== size.y) {
      cur?.rig.dispose();
      cur = { rig: factory(gl, size.x, size.y), w: size.x, h: size.y };
      rigRef.current = cur;
    }
    cur.rig.render(frameRef.current);
  }, 1);

  return null;
};

export const ThreeStage: React.FC<{ factory: RigFactory }> = ({ factory }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      frameloop="demand"
      flat
      gl={{ antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      style={{ background: "#000" }}
    >
      <Runner factory={factory} />
    </ThreeCanvas>
  );
};
