/**
 * The plinths, all built from the two parametric geometry builders.
 *
 * Look 3's two variants — a single fluted cylinder and a pair of classical
 * columns — are the same component with different numbers, which is the
 * point of generating the geometry rather than modelling it.
 */
import { useMemo } from "react";
import type * as THREE from "three";
import { discGeometry, flutedGeometry } from "./geometry";

type MaterialSlot = React.ReactElement;

export const FlutedCylinder: React.FC<{
  radius: number;
  height: number;
  flutes: number;
  fluteDepth: number;
  /** Above 1 the grooves narrow and the faces between them flatten — reeding rather than scalloping. */
  fluteSharpness?: number;
  /** The top plate overhangs the fluted shaft — it is what makes the flutes read. */
  capRadius: number;
  capHeight: number;
  position?: [number, number, number];
  material: MaterialSlot;
}> = ({
  radius,
  height,
  flutes,
  fluteDepth,
  fluteSharpness = 1,
  capRadius,
  capHeight,
  position = [0, 0, 0],
  material,
}) => {
  const shaft = useMemo(
    () => flutedGeometry({ radius, height, flutes, fluteDepth, fluteSharpness, radialSegments: 640 }),
    [radius, height, flutes, fluteDepth, fluteSharpness],
  );
  const cap = useMemo(
    () => discGeometry({ radius: capRadius, height: capHeight, bevel: 0.006 }),
    [capRadius, capHeight],
  );

  return (
    <group position={position}>
      <mesh geometry={shaft} castShadow receiveShadow>
        {material}
      </mesh>
      <mesh geometry={cap} position={[0, height, 0]} castShadow receiveShadow>
        {material}
      </mesh>
    </group>
  );
};

export const Column: React.FC<{
  /** Overall height including base and capital. */
  height: number;
  shaftRadius: number;
  plateRadius: number;
  baseHeight: number;
  capitalHeight: number;
  flutes: number;
  fluteDepth: number;
  taper: number;
  position: [number, number, number];
  material: MaterialSlot;
}> = ({
  height,
  shaftRadius,
  plateRadius,
  baseHeight,
  capitalHeight,
  flutes,
  fluteDepth,
  taper,
  position,
  material,
}) => {
  const shaftHeight = height - baseHeight - capitalHeight;
  const shaft = useMemo(
    () =>
      flutedGeometry({
        radius: shaftRadius,
        height: shaftHeight,
        flutes,
        fluteDepth,
        fluteSharpness: 1,
        taper,
        radialSegments: 384,
      }),
    [shaftRadius, shaftHeight, flutes, fluteDepth, taper],
  );
  const base = useMemo(
    () => discGeometry({ radius: plateRadius, height: baseHeight, bevel: 0.015 }),
    [plateRadius, baseHeight],
  );
  const capital = useMemo(
    () => discGeometry({ radius: plateRadius, height: capitalHeight, bevel: 0.015 }),
    [plateRadius, capitalHeight],
  );

  return (
    <group position={position}>
      <mesh geometry={base} castShadow receiveShadow>
        {material}
      </mesh>
      <mesh geometry={shaft} position={[0, baseHeight, 0]} castShadow receiveShadow>
        {material}
      </mesh>
      <mesh
        geometry={capital}
        position={[0, baseHeight + shaftHeight, 0]}
        castShadow
        receiveShadow
      >
        {material}
      </mesh>
    </group>
  );
};

export const Disc: React.FC<{
  radius: number;
  height: number;
  bevel: number;
  position?: [number, number, number];
  material: MaterialSlot;
  onGeometry?: (g: THREE.BufferGeometry) => void;
}> = ({ radius, height, bevel, position = [0, 0, 0], material }) => {
  const geo = useMemo(
    () => discGeometry({ radius, height, bevel }),
    [radius, height, bevel],
  );
  return (
    <mesh geometry={geo} position={position} castShadow receiveShadow>
      {material}
    </mesh>
  );
};
