import React, { useCallback } from "react";
import type * as THREE from "three";
import { CameraMove } from "./config";
import { Stage } from "./engine/Stage";
import { LOOK } from "./look";
import { createWorld } from "./scene/world";

/**
 * The whole film. Version 1 and Version 2 are this same component; the only
 * thing that differs is the camera move handed in from Root.tsx.
 */
export const Film: React.FC<{
  readonly camera: CameraMove;
  /** optional: show these frames instead of the running frame (look-dev stills) */
  readonly stills?: readonly number[];
}> = ({ camera, stills }) => {
  const build = useCallback(
    (gl: THREE.WebGLRenderer) => createWorld(gl, camera),
    [camera],
  );
  const frameMap = useCallback(
    (f: number) => (stills ? stills[Math.min(f, stills.length - 1)] : f),
    [stills],
  );
  return <Stage createWorld={build} look={LOOK} frameMap={frameMap} />;
};
