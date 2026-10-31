import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Procedural studio reflections (no external HDRI asset needed).
 * Built synchronously during render (not in an effect) so that the very
 * first frame each render worker draws is already lit identically —
 * otherwise frame 0 / worker-start frames would flash darker.
 */
export const StudioEnvironment: React.FC<{ readonly intensity?: number }> = ({
  intensity = 1,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const tex = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    return tex;
  }, [gl]);
  scene.environment = env;
  scene.environmentIntensity = intensity;
  useEffect(
    () => () => {
      scene.environment = null;
      env.dispose();
    },
    [scene, env],
  );
  return null;
};
