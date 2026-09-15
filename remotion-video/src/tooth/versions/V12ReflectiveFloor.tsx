import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { FloorReflection, Halo, SceneBackdrop } from "../parts";
import { Stage, useLoop, wave } from "../stage";

/**
 * Version 12 - "Reflective Floor".
 *
 * The tooth sits small in frame on a glossy blue surface, turning and floating
 * just clear of its own reflection. The short five-second loop means one turn
 * has to feel unhurried, so the tooth is kept small and the camera stays put.
 */

const FLOOR_Y = -0.6;

const ROOM: EnvSpec = {
  top: "#eaf3fc",
  horizon: "#9bbddd",
  bottom: "#42688f",
  lights: [
    { azimuth: 60, elevation: 55, size: 44, color: "#ffffff", intensity: 2.6 },
    { azimuth: 240, elevation: 18, size: 58, color: "#cfe4f7", intensity: 1.1 },
  ],
};

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();

  const spin = t * Math.PI * 2;
  // A small hover, so the tooth never quite touches its reflection.
  const lift = -0.02 + wave(t, 1) * 0.035;

  return (
    <>
      <SceneBackdrop
        colors={["#8fb4d8", "#6f9bc6", "#5c88b4", "#4a7099"]}
        stops={[0, 0.34, 0.7, 1]}
        center={[0.5, 0.66]}
        radius={[1.1, 0.62]}
      />
      <StudioEnvironment spec={ROOM} intensity={1.1} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-4, 1.5, -3]} intensity={0.5} color="#cfe2f4" />
      <ambientLight intensity={0.3} color="#cfe0f0" />

      <Halo color="#cfe6fa" size={2.4} squash={0.2} opacity={0.22} power={2} position={[0, FLOOR_Y + 0.005, -0.15]} />

      <group position-y={lift} rotation-y={spin}>
        <mesh geometry={full} scale={0.56}>
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

      <FloorReflection
        geometry={full}
        floorY={FLOOR_Y}
        depth={1.5}
        color="#dcecfa"
        shade="#3f6b96"
        opacity={0.34}
        rotationY={spin}
        scale={0.56}
        offsetY={lift}
      />
    </>
  );
};

export const V12ReflectiveFloor: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#5c88b4" }}>
    <WithToothAssets>
      <Stage fov={30} position={[0, 0.12, 6.4]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.05}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
