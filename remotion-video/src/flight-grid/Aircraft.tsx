import { useMemo } from "react";
import * as THREE from "three";
import { buildAirlinerGeometry } from "./airliner";

// Module-level singletons: the airliner mesh is identical in every
// composition and every layer, and rebuilding it per frame would dominate
// the render time of an otherwise trivial scene.
let sharedGeometry: THREE.BufferGeometry | null = null;

const getGeometry = () => {
  if (!sharedGeometry) sharedGeometry = buildAirlinerGeometry();
  return sharedGeometry;
};

export type AircraftProps = {
  matrix: THREE.Matrix4;
  scale: number;
  opacity?: number;
  renderOrder?: number;
};

export const Aircraft: React.FC<AircraftProps> = ({
  matrix,
  scale,
  opacity = 1,
  renderOrder = 10,
}) => {
  const geometry = getGeometry();

  const material = useMemo(
    () =>
      // Unlit and double-sided: the references show the aircraft as a flat
      // white silhouette, and double-siding means the merged geometry never
      // has to have consistent winding.
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  material.opacity = opacity;

  // Passed as plain tuples, not Vector3/Quaternion instances. react-three-
  // fiber diffs object-valued props by reference, so a memoised vector
  // mutated in place is treated as unchanged and never re-applied — the
  // aircraft would stay pinned to wherever it was on the first frame while
  // the camera flew away from it. Tuples are compared element-wise, so
  // every frame's transform lands.
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  matrix.decompose(position, quaternion, new THREE.Vector3());

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position.x, position.y, position.z]}
      quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
      scale={scale}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  );
};
