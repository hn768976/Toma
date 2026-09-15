import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry32, range } from "./random";
import type { GlassSpec, LayoutSpec } from "./types";

/**
 * Hero molecule plus the scattered field behind it.
 *
 * Every instance is the *same* untouched BufferGeometry from the supplied GLB —
 * only position, rotation and scale differ. Nothing is welded, decimated or
 * rebuilt.
 *
 * Far instances drop `transmission` and fall back to a plain translucent
 * physical material. Real refraction costs an extra scene pass and none of it
 * survives the depth-of-field blur at that distance, so this is purely a render
 * budget decision, not a look one.
 */

type Instance = {
  position: [number, number, number];
  rotation: [number, number, number];
  spin: [number, number, number];
  scale: number;
  driftPhase: number;
  near: boolean;
};

const useInstances = (layout: LayoutSpec): Instance[] =>
  useMemo(() => {
    const rng = mulberry32(layout.seed);
    const out: Instance[] = [];

    for (let i = 0; i < layout.count; i++) {
      const z = range(rng, layout.depth[0], layout.depth[1]);
      // Push the cloud outwards with depth so it doesn't tunnel behind the hero.
      const widen = 1 + Math.abs(z) * 0.06;
      out.push({
        position: [
          range(rng, -layout.spread[0], layout.spread[0]) * widen,
          range(rng, -layout.spread[1], layout.spread[1]) * widen,
          z,
        ],
        rotation: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
        spin: [
          range(rng, layout.spin[0], layout.spin[1]) * (rng() < 0.5 ? -1 : 1),
          range(rng, layout.spin[0], layout.spin[1]) * (rng() < 0.5 ? -1 : 1),
          range(rng, layout.spin[0], layout.spin[1]) * 0.4,
        ],
        scale: range(rng, layout.scale[0], layout.scale[1]),
        driftPhase: rng() * Math.PI * 2,
        near: z > layout.depth[1] - (layout.depth[1] - layout.depth[0]) * 0.28,
      });
    }

    return out;
  }, [layout]);

const GlassMaterial: React.FC<{ glass: GlassSpec; transmissive: boolean }> = ({
  glass,
  transmissive,
}) => {
  if (!transmissive) {
    return (
      <meshPhysicalMaterial
        color={glass.backdropColor ?? glass.color}
        transmission={0}
        transparent
        opacity={0.82}
        roughness={glass.roughness + 0.06}
        metalness={0}
        ior={glass.ior}
        clearcoat={glass.clearcoat}
        clearcoatRoughness={glass.clearcoatRoughness}
        envMapIntensity={glass.envMapIntensity * 0.9}
        depthWrite={false}
      />
    );
  }

  return (
    <meshPhysicalMaterial
      color={glass.color}
      transmission={glass.transmission}
      thickness={glass.thickness}
      roughness={glass.roughness}
      metalness={0}
      ior={glass.ior}
      attenuationColor={new THREE.Color(glass.attenuationColor)}
      attenuationDistance={glass.attenuationDistance}
      clearcoat={glass.clearcoat}
      clearcoatRoughness={glass.clearcoatRoughness}
      iridescence={glass.iridescence}
      iridescenceIOR={glass.iridescenceIOR}
      iridescenceThicknessRange={[100, glass.iridescenceThickness]}
      envMapIntensity={glass.envMapIntensity}
    />
  );
};

export const Molecules: React.FC<{
  geometry: THREE.BufferGeometry;
  layout: LayoutSpec;
  glass: GlassSpec;
  time: number;
}> = ({ geometry, layout, glass, time }) => {
  const instances = useInstances(layout);

  return (
    <group>
      {/* Hero — always full-fat refractive glass. */}
      <group position={layout.heroPosition}>
        <mesh
          geometry={geometry}
          scale={layout.heroScale}
          rotation={[
            Math.sin(time * 0.11) * 0.18,
            time * layout.spin[1],
            Math.sin(time * 0.07) * 0.09,
          ]}
        >
          <GlassMaterial glass={glass} transmissive />
        </mesh>

        {layout.shell ? (
          <mesh>
            <sphereGeometry args={[layout.shell.radius, 64, 48]} />
            <meshPhysicalMaterial
              color={layout.shell.color}
              transmission={1}
              thickness={0.35}
              roughness={0.03}
              ior={1.2}
              metalness={0}
              transparent
              opacity={layout.shell.opacity}
              clearcoat={1}
              clearcoatRoughness={0.02}
              envMapIntensity={glass.envMapIntensity * 1.1}
            />
          </mesh>
        ) : null}
      </group>

      {instances.map((inst, i) => {
        const drift = layout.drift;
        return (
          <mesh
            key={i}
            geometry={geometry}
            scale={inst.scale}
            position={[
              inst.position[0] + Math.sin(time * 0.18 + inst.driftPhase) * drift * 6,
              inst.position[1] + time * drift * 0.5 + Math.cos(time * 0.13 + inst.driftPhase) * drift * 4,
              inst.position[2],
            ]}
            rotation={[
              inst.rotation[0] + time * inst.spin[0],
              inst.rotation[1] + time * inst.spin[1],
              inst.rotation[2] + time * inst.spin[2],
            ]}
          >
            <GlassMaterial glass={glass} transmissive={inst.near} />
          </mesh>
        );
      })}
    </group>
  );
};
