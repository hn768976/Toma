import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { Halo, SceneBackdrop, mulberry32 } from "../parts";
import { Stage, useLoop, wave } from "../stage";

/**
 * Version 08 - "Atom Cage".
 *
 * Thin orbit rings accumulate around a matte tooth until it sits inside a full
 * atomic cage, then thin back out. Rings arrive and leave by fading their own
 * opacity, so the count can change without anything popping at the loop point.
 */

const CYAN_STUDIO: EnvSpec = {
  top: "#ffffff",
  horizon: "#c4e6ff",
  bottom: "#3f84c4",
  lights: [
    { azimuth: 50, elevation: 52, size: 48, color: "#ffffff", intensity: 2.8 },
    { azimuth: 230, elevation: 18, size: 62, color: "#d9f0ff", intensity: 1.4 },
  ],
};

type Ring = {
  readonly radius: number;
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly spin: number;
  readonly laps: number;
  readonly nodes: readonly number[];
};

const RING_COUNT = 13;

const useRings = (seed: number): Ring[] =>
  useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: RING_COUNT }, () => ({
      radius: 1.25 + random() * 0.55,
      tiltX: (random() - 0.5) * Math.PI * 1.2,
      tiltZ: (random() - 0.5) * Math.PI * 1.2,
      spin: random() * Math.PI * 2,
      laps: 1 + Math.floor(random() * 2),
      nodes: Array.from({ length: 1 + Math.floor(random() * 2) }, () => random()),
    }));
  }, [seed]);

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();
  const rings = useRings(404);

  // 2 rings -> all 13 -> back to 2, over one loop.
  const active = 2 + (1 - Math.cos(t * Math.PI * 2)) * 0.5 * (RING_COUNT - 2);

  return (
    <>
      <SceneBackdrop
        colors={["#8ddbff", "#4fb4f2", "#1f8ce0", "#0d63b8"]}
        stops={[0, 0.32, 0.68, 1]}
        center={[0.42, 0.62]}
        radius={[0.95, 0.9]}
      />
      <StudioEnvironment spec={CYAN_STUDIO} intensity={1.1} />
      <directionalLight position={[3, 5, 4]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-4, 0.5, -3]} intensity={0.5} color="#cfeaff" />
      <ambientLight intensity={0.3} color="#d6ecff" />

      <Halo color="#ffffff" size={4.2} opacity={0.22} power={2.6} position={[0, 0, -2]} />

      <group rotation-y={t * Math.PI * 2} position-y={wave(t, 1) * 0.04}>
        <mesh geometry={full} scale={1.02}>
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.5}
            metalness={0}
            clearcoat={0.35}
            clearcoatRoughness={0.35}
            envMapIntensity={0.9}
          />
        </mesh>
      </group>

      <group rotation-y={-t * Math.PI * 2 * 0.5} rotation-z={wave(t, 1) * 0.06}>
        {rings.map((ring, i) => {
          const fade = THREE.MathUtils.clamp(active - i, 0, 1);
          if (fade <= 0.001) {
            return null;
          }
          return (
            <group key={i} rotation={[ring.tiltX, ring.spin, ring.tiltZ]}>
              <mesh rotation-x={Math.PI / 2}>
                <torusGeometry args={[ring.radius, 0.005, 6, 140]} />
                <meshBasicMaterial
                  color="#e8f8ff"
                  transparent
                  opacity={0.75 * fade}
                  toneMapped={false}
                  depthWrite={false}
                />
              </mesh>
              {ring.nodes.map((offset, n) => {
                const angle = (t * ring.laps + offset) * Math.PI * 2;
                return (
                  <mesh
                    key={n}
                    position={[
                      Math.cos(angle) * ring.radius,
                      0,
                      Math.sin(angle) * ring.radius,
                    ]}
                  >
                    <sphereGeometry args={[0.032, 16, 12]} />
                    <meshBasicMaterial
                      color="#ffffff"
                      transparent
                      opacity={0.95 * fade}
                      toneMapped={false}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        })}
      </group>
    </>
  );
};

export const V08AtomCage: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#1f8ce0" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.2]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.05}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
