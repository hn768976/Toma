import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, BLUE_STUDIO } from "../environment";
import { FloorReflection, Halo, SceneBackdrop } from "../parts";
import { Stage, useLoop, wave } from "../stage";
import { useBubbleMaterial } from "../shaders/materials";

/**
 * Version 09 - "Bubble Shield".
 *
 * A soap bubble seals around the tooth above a reflective floor. The bubble is
 * one sphere with a vertex ripple and a thin-film rim, and it reflects with the
 * tooth so the two read as one object standing on the surface.
 */

const FLOOR_Y = -1.34;

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();

  const bubble = useBubbleMaterial({
    toneMapped: false,
    uTime: t,
    uWobble: 0.013,
    // Wide, gentle falloff and almost no body haze: the reference bubble is a
    // soft sheen with a clear interior, not a bright ring around milk.
    uRim: 0.85,
    uRimPower: 2.7,
    uBase: 0.004,
    uFilm: 0.08,
    uTint: "#eaf7ff",
    uOpacity: 1,
  });

  const spin = t * Math.PI * 2;
  const lift = 0.02 + wave(t, 1) * 0.035;

  return (
    <>
      <SceneBackdrop
        colors={["#e8f6ff", "#8cc2ea", "#2f70ae", "#0b2a4d"]}
        stops={[0, 0.4, 0.74, 1]}
        center={[0.5, 0.58]}
        radius={[0.98, 0.9]}
      />
      <StudioEnvironment spec={BLUE_STUDIO} intensity={1.2} />
      <directionalLight position={[3, 5, 4]} intensity={2.15} color="#ffffff" />
      <directionalLight position={[-4, 1.5, -3]} intensity={0.55} color="#cfe6ff" />
      <ambientLight intensity={0.25} color="#d8ecff" />

      <Halo color="#ffffff" size={3.6} opacity={0.3} power={2.2} position={[0, 0.05, -2]} />
      <Halo color="#8fc8f5" size={3.2} squash={0.28} opacity={0.4} power={2} position={[0, FLOOR_Y + 0.01, -0.2]} />

      <group position-y={lift}>
        <group rotation-y={spin}>
          <mesh geometry={full} scale={1.0}>
            <meshPhysicalMaterial
              color="#ffffff"
              roughness={0.17}
              metalness={0}
              clearcoat={1}
              clearcoatRoughness={0.08}
              envMapIntensity={1.55}
            />
          </mesh>
        </group>
        <mesh material={bubble} scale={1.42}>
          <sphereGeometry args={[1, 72, 52]} />
        </mesh>
      </group>

      <FloorReflection
        geometry={full}
        floorY={FLOOR_Y}
        depth={1.9}
        color="#eaf5ff"
        shade="#2f6699"
        opacity={0.3}
        rotationY={spin}
        offsetY={lift}
      />
    </>
  );
};

export const V09BubbleShield: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0a2647" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.9]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.05}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
