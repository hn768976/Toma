import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import {
  CONTENT_STEP,
  CONTENT_STEPS,
  DURATION_IN_FRAMES,
  TEX_ROWS,
} from "../constants";
import { Palette } from "./palette";
import { Layout, PlaneSpec, TowerSpec } from "./layout";
import { drawTowerCanvas } from "./towerTexture";
import { createTowerMaterial, dofRadius } from "./towerMaterial";
import { contactGlowTexture } from "./sprites";

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

type Common = {
  palette: Palette;
  frame: number;
  camX: number;
  camZ: number;
};

const TowerPlane: React.FC<Common & { plane: PlaneSpec }> = ({
  plane,
  palette,
  frame,
  camX,
  camZ,
}) => {
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());

  // Content is regenerated once per content step, not once per frame, and the
  // step is a pure function of the frame — safe with Remotion's out-of-order
  // multithreaded rendering.
  const step = Math.floor(frame / CONTENT_STEP) % CONTENT_STEPS;

  const texture = useMemo(() => {
    const { canvas } = drawTowerCanvas(plane, palette, step);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(8, maxAnisotropy);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [plane, palette, step, maxAnisotropy]);

  useEffect(() => () => texture.dispose(), [texture]);

  const solid = useMemo(() => createTowerMaterial(), []);
  const reflection = useMemo(() => createTowerMaterial(), []);
  useEffect(
    () => () => {
      solid.material.dispose();
      reflection.material.dispose();
    },
    [solid, reflection],
  );

  const repeatY = plane.visibleRows / TEX_ROWS;
  // An integer number of texture cycles over the loop, so the fall distance is
  // an exact multiple of TEX_ROWS cells and frame 360 matches frame 0. Wrapped
  // into [0, 1) — the texture repeats, so it samples identically either way,
  // and small offsets keep float precision high at 4K.
  const offsetY = (plane.phase + (frame / DURATION_IN_FRAMES) * plane.fallCycles) % 1;

  const distance = Math.hypot(camX - plane.x, camZ - plane.z);
  const radius = dofRadius(distance);

  const apply = (
    u: ReturnType<typeof createTowerMaterial>["uniforms"],
    extraBlur: number,
    mirror: number,
  ) => {
    u.map.value = texture;
    u.uvRepeat.value.set(1, repeatY);
    u.uvOffset.value.set(0, offsetY);
    // Blur radius is in world units on the tower face; convert to texture UV,
    // separately per axis, so the disc stays circular on a non-square plane.
    const r = radius + extraBlur;
    u.blurUv.value.set(r / plane.width, (r / plane.height) * repeatY);
    u.fogColor.value.set(palette.fog);
    u.fogDensity.value = palette.fogDensity;
    u.mirror.value = mirror;
  };

  apply(solid.uniforms, 0, 0);
  solid.uniforms.opacity.value = 1;
  solid.uniforms.tint.value.setRGB(1, 1, 1);
  solid.uniforms.verticalFade.value = 0;
  solid.uniforms.topFade.value = 1;

  apply(reflection.uniforms, 0.035, 1);
  reflection.uniforms.opacity.value = palette.reflectOpacity;
  reflection.uniforms.tint.value.set(palette.reflectTint);
  reflection.uniforms.verticalFade.value = 1;
  reflection.uniforms.topFade.value = 0;

  return (
    <group position={[plane.x, 0, plane.z]} rotation={[0, plane.yaw, 0]}>
      <mesh
        geometry={UNIT_PLANE}
        material={solid.material}
        position={[0, plane.height / 2, 0]}
        scale={[plane.width, plane.height, 1]}
        renderOrder={20}
      />
      <mesh
        geometry={UNIT_PLANE}
        material={reflection.material}
        position={[0, -plane.height / 2, 0]}
        scale={[plane.width, plane.height, 1]}
        renderOrder={4}
      />
    </group>
  );
};

/** Small additive band where a tower lands on the floor. */
const ContactGlow: React.FC<Common & { tower: TowerSpec }> = ({
  tower,
  palette,
  camX,
  camZ,
}) => {
  const map = useMemo(() => contactGlowTexture(palette), [palette]);
  const yaw = Math.atan2(camX - tower.x, camZ - tower.z);
  const w = tower.span * 2.3;
  return (
    <mesh
      geometry={UNIT_PLANE}
      position={[tower.x, 0.28, tower.z]}
      rotation={[0, yaw, 0]}
      scale={[w, w * 0.34, 1]}
      renderOrder={12}
    >
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.16}
      />
    </mesh>
  );
};

export const Towers: React.FC<Common & { layout: Layout }> = ({ layout, ...common }) => (
  <group>
    {layout.planes.map((plane) => (
      <TowerPlane key={plane.id} plane={plane} {...common} />
    ))}
    {layout.towers.map((tower) => (
      <ContactGlow key={tower.id} tower={tower} {...common} />
    ))}
  </group>
);
