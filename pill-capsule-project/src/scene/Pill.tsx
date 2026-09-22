import { useMemo } from "react";
import * as THREE from "three";
import { GEOM } from "../lib/pill-geometry";
import { PillMaterial, matteMaterial } from "../lib/pill-material";

export type Colourway = {
  /** Capsule cap, or the whole tablet. */
  cap: string;
  /** Capsule body. Ignored for tablets. */
  body: string;
};

export type HeroPillProps = {
  shape: "capsule" | "tablet";
  colourway: Colourway;
  /** Tablets only: cut the score groove. */
  scored?: boolean;
  /** Render as a flat white silhouette for the luma matte pass. */
  matte: boolean;
  roughness?: number;
  clearcoat?: number;
};

/**
 * One pill, at pill-unit scale, axis +Y, centred on the origin. The caller
 * owns position, rotation and scale.
 *
 * The capsule is two meshes with two materials — which is how a real capsule
 * is made, and what makes the two-tone colouring a data row rather than a
 * texture.
 */
export const HeroPill: React.FC<HeroPillProps> = ({
  shape,
  colourway,
  scored = false,
  matte,
  roughness = 0.3,
  clearcoat = 0.6,
}) => {
  const capMat = useMemo(
    () => new PillMaterial({ color: colourway.cap, roughness, clearcoat }),
    [colourway.cap, roughness, clearcoat],
  );
  const bodyMat = useMemo(
    () =>
      new PillMaterial({
        color: colourway.body,
        roughness,
        clearcoat,
        // A white body needs more wrap than a saturated cap: it is the one
        // that reads as dead grey if the terminator cuts hard.
        wrap: 0.4,
      }),
    [colourway.body, roughness, clearcoat],
  );

  if (shape === "tablet") {
    return (
      <mesh
        geometry={scored ? GEOM.tabletScored : GEOM.tabletPlain}
        material={matte ? matteMaterial : capMat}
        castShadow
        receiveShadow
      />
    );
  }

  return (
    <group>
      <mesh
        geometry={GEOM.capsuleBody}
        material={matte ? matteMaterial : bodyMat}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={GEOM.capsuleCap}
        material={matte ? matteMaterial : capMat}
        castShadow
        receiveShadow
      />
    </group>
  );
};

/** Shared scratch objects; reused so per-frame matrix work allocates nothing. */
export const scratch = {
  matrix: new THREE.Matrix4(),
  quat: new THREE.Quaternion(),
  spin: new THREE.Quaternion(),
  pos: new THREE.Vector3(),
  scale: new THREE.Vector3(),
};
