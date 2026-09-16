import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, DARK_STUDIO } from "../environment";
import { FloorReflection, GlowShell, Halo, SceneBackdrop } from "../parts";
import { Stage, useLoop, usePxScale, wave } from "../stage";
import { useLatticeMaterial } from "../shaders/materials";

/**
 * Version 07 - "Glass Scan".
 *
 * A luminous glass tooth turning on a dark reflective floor.
 *
 * Two things carry it. The body is a bright translucent blue with strong
 * iridescence, lit almost entirely by the environment rather than by lights, so
 * the colour shifts as it turns. Over that sit a handful of panel lines - five
 * latitudes, nine longitudes - which read as construction seams following the
 * form. An even, fine grid would instead look like a net bag thrown over a dark
 * object, which is what a denser lattice gave here.
 */

const FLOOR_Y = -1.25;

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { full } = useToothAssets();

  const lattice = useLatticeMaterial({
    toneMapped: false,
    uColor: "#bdeeff",
    uScanColor: "#ffffff",
    uRings: 5,
    uSegments: 9,
    uThickness: 0.75,
    uOpacity: 0.9,
    uPx: px,
    uScanY: -99,
    uScanWidth: 0.1,
    uScanStrength: 0,
  });

  const spin = t * Math.PI * 2;
  const lift = 0.02 + wave(t, 1) * 0.02;

  return (
    <>
      <SceneBackdrop
        colors={["#123256", "#0a1f3c", "#050f22", "#01050e"]}
        stops={[0, 0.3, 0.62, 1]}
        center={[0.42, 0.6]}
        radius={[1.05, 0.9]}
      />
      <StudioEnvironment spec={DARK_STUDIO} intensity={3.2} />
      <directionalLight position={[4, 4, 4]} intensity={1.5} color="#bfe9ff" />
      <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#6f9cff" />

      <Halo color="#14508f" size={6.4} opacity={0.45} power={2.4} position={[0, 0.1, -2.4]} />
      <Halo color="#2b7fc8" size={2.6} squash={0.35} opacity={0.5} power={2} position={[0, FLOOR_Y + 0.02, -0.3]} />

      <group rotation-y={spin} position-y={lift}>
        <mesh geometry={full} scale={1.24}>
          <meshPhysicalMaterial
            color="#16497f"
            roughness={0.09}
            metalness={0.3}
            clearcoat={1}
            clearcoatRoughness={0.03}
            iridescence={1}
            iridescenceIOR={2.1}
            iridescenceThicknessRange={[260, 1050]}
            emissive="#0b2c55"
            emissiveIntensity={0.85}
            envMapIntensity={3.8}
          />
        </mesh>
        <mesh geometry={full} material={lattice} scale={1.248} />
        {/* The bright cyan edge the reference draws around the whole silhouette. */}
        <GlowShell geometry={full} color="#7fd8ff" strength={1.5} power={2.6} scale={1.3} />
      </group>

      <FloorReflection
        geometry={full}
        floorY={FLOOR_Y}
        depth={1.15}
        color="#4ea6ff"
        shade="#08203c"
        opacity={0.24}
        rotationY={spin}
        scale={1.24}
        offsetY={lift}
      />
    </>
  );
};

export const V07GlassScan: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#01050e" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.6]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.0}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
