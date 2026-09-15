import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { ContactShadow, SceneBackdrop } from "../parts";
import { Stage, cwave, useLoop, wave } from "../stage";

/**
 * Version 04 - "Mint Studio".
 *
 * The quiet one: a glossy enamel tooth on a seamless mint cyclorama, one slow
 * turn, one slow breath of the camera. Nothing else - which means the material
 * and the shadow have to carry it.
 */

const MINT_STUDIO: EnvSpec = {
  top: "#ffffff",
  horizon: "#cfe8e0",
  bottom: "#6f9c92",
  lights: [
    { azimuth: 45, elevation: 58, size: 48, color: "#ffffff", intensity: 3.0 },
    { azimuth: 225, elevation: 16, size: 60, color: "#d8f2ec", intensity: 1.3 },
    { azimuth: 145, elevation: -10, size: 70, color: "#7fb3a7", intensity: 0.5 },
  ],
};

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();

  return (
    <>
      <SceneBackdrop
        colors={["#a6d9cb", "#86c2b3", "#6aa99a", "#5c9788"]}
        stops={[0, 0.38, 0.72, 1]}
        center={[0.5, 0.42]}
        radius={[0.75, 0.68]}
      />
      <StudioEnvironment spec={MINT_STUDIO} intensity={1.05} />
      <directionalLight position={[3.5, 5.5, 4]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, 2, -2.5]} intensity={0.45} color="#bfe3da" />
      <ambientLight intensity={0.25} color="#cfeae3" />

      <ContactShadow y={-1.22} radius={1.35} squash={0.5} opacity={0.28} power={2.6} color="#2c5b52" />

      <group rotation-y={t * Math.PI * 2} position-y={0.02 + wave(t, 1) * 0.035}>
        <mesh geometry={full}>
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.22}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.08}
            envMapIntensity={1.0}
          />
        </mesh>
      </group>
    </>
  );
};

export const V04MintStudio: React.FC = () => {
  const { t } = useLoop();
  const z = 5.9 - (1 - cwave(t, 1)) * 0.5;
  return (
    <AbsoluteFill style={{ backgroundColor: "#6fae9f" }}>
      <WithToothAssets>
        <Stage
          fov={30}
          position={[0, 0, z]}
          toneMapping={THREE.ACESFilmicToneMapping}
          exposure={1.1}
        >
          <Scene />
        </Stage>
      </WithToothAssets>
    </AbsoluteFill>
  );
};
