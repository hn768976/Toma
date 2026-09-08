/**
 * A thin wrapper around THREE.InstancedMesh.
 *
 * Every repeated element in the facility — floor tiles, rack chassis, unit
 * division lines, LEDs — goes through here. Hundreds of individual meshes
 * would slow the render down for no reason; this keeps the whole facility
 * at a few dozen draw calls.
 *
 * `write` is called once per instance per frame with a scratch Object3D and
 * Color, so the per-frame update allocates nothing.
 */

import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type InstanceWriter = (
  index: number,
  object: THREE.Object3D,
  color: THREE.Color,
) => void;

export const Instanced: React.FC<{
  count: number;
  write: InstanceWriter;
  colors?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  children: React.ReactNode;
}> = ({
  count,
  write,
  colors = true,
  castShadow = false,
  receiveShadow = false,
  renderOrder,
  children,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({ object: new THREE.Object3D(), color: new THREE.Color() }),
    [],
  );

  // No dependency array on purpose: the parent re-renders on every frame,
  // and every frame needs a fresh set of instance matrices.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || count === 0) return;
    const { object, color } = scratch;
    for (let i = 0; i < count; i++) {
      object.position.set(0, 0, 0);
      object.rotation.set(0, 0, 0);
      object.scale.set(1, 1, 1);
      color.setRGB(1, 1, 1);
      write(i, object, color);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
      if (colors) mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      // Geometry and material are supplied as children.
      args={[undefined as never, undefined as never, count]}
      frustumCulled={false}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      renderOrder={renderOrder}
    >
      {children}
    </instancedMesh>
  );
};

/** Hides an instance without disturbing the rest of the buffer. */
export const hide = (object: THREE.Object3D) => {
  object.scale.set(0, 0, 0);
};
