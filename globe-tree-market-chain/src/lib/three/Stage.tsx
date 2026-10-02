import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { PostFX, PostSettings } from "./PostFX";

// A "world" is built once (imperatively) and then posed purely from the
// frame number. update() must not read anything but its arguments.
export type World = {
  root: THREE.Object3D;
  update: (frame: number, camera: THREE.PerspectiveCamera) => PostSettings;
  grainSeed: (frame: number) => number;
  syncRes?: (w: number, h: number) => void;
  overlay?: boolean;
  dispose?: () => void;
};

const Driver: React.FC<{ world: World }> = ({ world }) => {
  const frame = useCurrentFrame();
  const { gl, scene, camera } = useThree();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const fx = useMemo(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    world.syncRes?.(v.x, v.y);
    return new PostFX(v.x, v.y);
  }, [gl, world]);

  useLayoutEffect(() => {
    scene.add(world.root);
    return () => {
      scene.remove(world.root);
    };
  }, [scene, world]);

  useLayoutEffect(() => () => fx.dispose(), [fx]);

  useFrame(() => {
    const f = frameRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    const settings = world.update(f, cam);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    fx.render(gl, scene, cam, settings, world.grainSeed(f), world.overlay ?? false);
  }, 1);

  return null;
};

export const Stage: React.FC<{ world: World | null; background: string }> = ({ world, background }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      style={{ background }}
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: 0.1, far: 500, position: [0, 0, 10] }}
    >
      {world ? <Driver world={world} /> : null}
    </ThreeCanvas>
  );
};
