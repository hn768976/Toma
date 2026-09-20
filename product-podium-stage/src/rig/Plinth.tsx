/**
 * The plinth mesh.
 *
 * Geometry comes from plinthGeometry.ts, so radius, height, tier count and
 * bevel are data on the look row. The top face is always left completely
 * clear - no product, no placeholder, no logo. The moment something sits on
 * it, the clip becomes one person's product shot instead of a stage anyone
 * can license.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { PlinthSpec } from "../looks/types";
import { buildPlinthGeometry } from "./plinthGeometry";

export const Plinth: React.FC<{
  spec: PlinthSpec;
  color: string;
  roughness?: number;
  metalness?: number;
  /** Optional faint rim colour picked up from a nearby emissive source. */
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  clearcoat?: number;
}> = ({
  spec,
  color,
  roughness = 0.62,
  metalness = 0.05,
  emissive,
  emissiveIntensity = 0,
  envMapIntensity = 1,
  clearcoat = 0,
}) => {
  const geometry = useMemo(() => buildPlinthGeometry(spec), [spec]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={new THREE.Color(color)}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ? new THREE.Color(emissive) : new THREE.Color("#000000")}
        emissiveIntensity={emissiveIntensity}
        envMapIntensity={envMapIntensity}
        clearcoat={clearcoat}
        clearcoatRoughness={0.25}
      />
    </mesh>
  );
};
