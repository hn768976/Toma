/**
 * Lighting. Orthographic projection means there is no perspective falloff to
 * fight, so a hemisphere fill plus one shadow-casting key and one bounce
 * light is enough. Tone mapping is disabled on the canvas so the palette
 * lands exactly on the specified values.
 *
 * Theme intensities are authored as irradiance — 1.0 means "this surface
 * renders at its own albedo". three.js lights are physically scaled, so each
 * one is multiplied by PI on the way in.
 */

import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { Theme } from "./theme";

const W = Math.PI;

export const Lighting: React.FC<{ theme: Theme }> = ({ theme }) => {
  const key = useRef<THREE.DirectionalLight>(null);

  useLayoutEffect(() => {
    const light = key.current;
    if (!light) return;
    const camera = light.shadow.camera;
    camera.left = -9;
    camera.right = 9;
    camera.top = 9;
    camera.bottom = -9;
    camera.near = 1;
    camera.far = 34;
    camera.updateProjectionMatrix();
    light.shadow.bias = -0.0008;
    light.shadow.normalBias = 0.022;
    light.shadow.radius = 4;
    light.target.position.set(0, 0.9, 0);
    light.target.updateMatrixWorld();
  }, []);

  return (
    <>
      <ambientLight intensity={theme.ambient * W} />
      <hemisphereLight
        intensity={theme.hemi * W}
        color={theme.hemiSky}
        groundColor={theme.hemiGround}
      />
      <directionalLight
        ref={key}
        position={[5.5, 9, 8]}
        intensity={theme.key * W}
        color={theme.keyColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-7, 3.5, -5]}
        intensity={theme.fill * W}
        color={theme.fillColor}
      />
    </>
  );
};
