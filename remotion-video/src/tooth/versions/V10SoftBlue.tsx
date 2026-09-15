import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { SceneBackdrop } from "../parts";
import { Stage, useLoop, wave } from "../stage";

/**
 * Version 10 - "Soft Blue".
 *
 * Nothing but the tooth on a soft powder-blue field with one vertical band of
 * light. A slight tumble on top of the turn keeps it from looking like a
 * turntable render.
 */

const POWDER_STUDIO: EnvSpec = {
  top: "#ffffff",
  horizon: "#d3e5f5",
  bottom: "#6f92b4",
  lights: [
    { azimuth: 55, elevation: 50, size: 50, color: "#ffffff", intensity: 2.7 },
    { azimuth: 235, elevation: 22, size: 64, color: "#dcecfa", intensity: 1.2 },
    { azimuth: 150, elevation: -12, size: 72, color: "#8aa9c6", intensity: 0.45 },
  ],
};

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();

  return (
    <>
      {/* A tall, narrow radius turns the radial ramp into a vertical light band. */}
      <SceneBackdrop
        colors={["#c2d9ec", "#a8c6e0", "#9cbcd8", "#8fb0cd"]}
        stops={[0, 0.35, 0.7, 1]}
        center={[0.46, 0.5]}
        radius={[0.42, 6]}
      />
      <StudioEnvironment spec={POWDER_STUDIO} intensity={1.05} />
      <directionalLight position={[3.5, 5, 4.5]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[-4, 1.5, -2.5]} intensity={0.45} color="#cfe0f0" />
      <ambientLight intensity={0.28} color="#d7e6f4" />

      <group
        rotation-y={t * Math.PI * 2}
        rotation-x={wave(t, 1) * 0.07}
        rotation-z={wave(t, 2, 0.25) * 0.045}
        position-y={0.02 + wave(t, 1, 0.15) * 0.05}
      >
        <mesh geometry={full} scale={1.2}>
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.24}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={1.05}
          />
        </mesh>
      </group>
    </>
  );
};

export const V10SoftBlue: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#9cbcd8" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.5]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.08}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
