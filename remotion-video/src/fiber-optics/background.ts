import * as THREE from "three/webgpu";
import { color, mix, screenUV, vec2 } from "three/tsl";
import type { Palette } from "./palette";

/**
 * Sky sphere the camera sits inside. The gradient is driven by screen position
 * rather than geometry UVs, so the glow stays anchored behind the cable cluster
 * no matter how the camera moves.
 */
export const buildBackdrop = (palette: Palette): THREE.Mesh => {
  const material = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false,
  });

  // Offset towards the upper left, where the reference's glow sits.
  const centred = screenUV.sub(vec2(0.42, 0.56)).mul(vec2(1.0, 0.62));
  const falloff = centred.length().mul(1.55).smoothstep(0.0, 1.0);

  material.colorNode = mix(
    color(palette.backgroundGlow),
    color(palette.background),
    falloff,
  );

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
};
