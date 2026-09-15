import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { Halo, SceneBackdrop } from "../parts";
import { Stage, saw, useLoop, usePxScale, wave } from "../stage";
import { useLatticeMaterial } from "../shaders/materials";

/**
 * Version 11 - "Lattice Scan".
 *
 * A digital dental scan: a white tooth carrying a fine blue measurement grid,
 * with a scan band running up it. The grid is built from latitude and longitude
 * lines in object space rather than from the model's UVs, whose baked atlas
 * seams would otherwise cut visible scars across the surface.
 */

const SCAN_STUDIO: EnvSpec = {
  top: "#ffffff",
  horizon: "#cbe4fb",
  bottom: "#54749c",
  lights: [
    { azimuth: 45, elevation: 55, size: 46, color: "#ffffff", intensity: 2.9 },
    { azimuth: 225, elevation: 20, size: 60, color: "#d8edff", intensity: 1.3 },
  ],
};

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { full } = useToothAssets();

  const sweep = saw(t, 1);
  const scanY = -1.6 + sweep * 3.2;

  const lattice = useLatticeMaterial({
    toneMapped: false,
    uColor: "#3f8fdb",
    uScanColor: "#ffffff",
    uRings: 38,
    uSegments: 58,
    uThickness: 0.8,
    uOpacity: 0.62,
    uPx: px,
    uScanY: scanY,
    uScanWidth: 0.16,
    uScanStrength: 0.8 * Math.sin(Math.PI * sweep) ** 0.7,
  });

  return (
    <>
      <SceneBackdrop
        colors={["#59b0ef", "#2178cc", "#0d50a4", "#062f6b"]}
        stops={[0, 0.3, 0.66, 1]}
        center={[0.5, 0.54]}
        radius={[0.7, 0.66]}
      />
      <StudioEnvironment spec={SCAN_STUDIO} intensity={1.15} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={0.5} color="#cfe6ff" />
      <ambientLight intensity={0.3} color="#d6e9ff" />

      <Halo color="#eaf6ff" size={4.4} opacity={0.5} power={2.3} position={[0, 0.05, -2]} />

      <group rotation-y={t * Math.PI * 2} position-y={wave(t, 1) * 0.04}>
        <mesh geometry={full} scale={1.24}>
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.42}
            metalness={0}
            clearcoat={0.5}
            clearcoatRoughness={0.3}
            envMapIntensity={0.95}
          />
        </mesh>
        <mesh geometry={full} material={lattice} scale={1.247} />
      </group>
    </>
  );
};

export const V11LatticeScan: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d50a4" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.5]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.05}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
