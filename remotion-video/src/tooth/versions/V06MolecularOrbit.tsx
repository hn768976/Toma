import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { Halo, SceneBackdrop, Starfield, mulberry32 } from "../parts";
import { Stage, useLoop, wave } from "../stage";

/**
 * Version 06 - "Molecular Orbit".
 *
 * A pearlescent tooth inside a cloud of orbiting spheres. Each orbit is a tilted
 * circle and each sphere completes a whole number of laps over the clip, which
 * is what keeps the swarm loopable however tangled it looks.
 */

const BRIGHT_BLUE: EnvSpec = {
  top: "#ffffff",
  horizon: "#bcdcff",
  bottom: "#4c7fb8",
  lights: [
    { azimuth: 40, elevation: 55, size: 44, color: "#ffffff", intensity: 3.2 },
    { azimuth: 220, elevation: 20, size: 60, color: "#d5ecff", intensity: 1.6 },
    { azimuth: 310, elevation: 45, size: 30, color: "#ffe9f6", intensity: 1.0 },
  ],
};

type Orbit = {
  readonly radius: number;
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly spin: number;
  readonly laps: number;
  readonly phase: number;
  readonly beads: readonly { size: number; offset: number }[];
};

const useOrbits = (count: number, seed: number): Orbit[] =>
  useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const beadCount = 1 + Math.floor(random() * 3);
      return {
        radius: 1.35 + random() * 0.95,
        tiltX: (random() - 0.5) * Math.PI,
        tiltZ: (random() - 0.5) * Math.PI,
        spin: random() * Math.PI * 2,
        // Whole laps only - a fractional lap would jump at the loop point.
        laps: 1 + Math.floor(random() * 3),
        phase: random(),
        beads: Array.from({ length: beadCount }, () => ({
          size: 0.05 + random() * 0.055,
          offset: random(),
        })),
      };
    });
  }, [count, seed]);

const OrbitPath: React.FC<{ readonly orbit: Orbit; readonly t: number }> = ({
  orbit,
  t,
}) => (
  <group rotation={[orbit.tiltX, orbit.spin, orbit.tiltZ]}>
    <mesh rotation-x={Math.PI / 2}>
      <torusGeometry args={[orbit.radius, 0.0045, 6, 128]} />
      <meshBasicMaterial color="#cfeaff" transparent opacity={0.55} toneMapped={false} />
    </mesh>
    {orbit.beads.map((bead, i) => {
      const angle = (t * orbit.laps + orbit.phase + bead.offset) * Math.PI * 2;
      return (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * orbit.radius,
            0,
            Math.sin(angle) * orbit.radius,
          ]}
        >
          <sphereGeometry args={[bead.size, 20, 14]} />
          <meshPhysicalMaterial
            color="#4f9fe8"
            roughness={0.18}
            metalness={0.1}
            clearcoat={1}
            envMapIntensity={1.4}
          />
        </mesh>
      );
    })}
  </group>
);

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();
  const orbits = useOrbits(7, 91);

  return (
    <>
      <SceneBackdrop
        colors={["#eaf6ff", "#9ed0f7", "#4e9ae0", "#1d63b4"]}
        stops={[0, 0.3, 0.66, 1]}
        center={[0.5, 0.52]}
        radius={[0.82, 0.78]}
      />
      <StudioEnvironment spec={BRIGHT_BLUE} intensity={1.2} />
      <directionalLight position={[3, 5, 4]} intensity={1.3} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={0.5} color="#ffd9f0" />

      <Halo color="#ffffff" size={4.6} opacity={0.35} power={2.4} position={[0, 0.1, -2]} />
      <Starfield count={260} seed={57} spread={[8, 5, 4]} color="#bfe2ff" size={7} opacity={0.75} />

      <group rotation-y={t * Math.PI * 2} position-y={wave(t, 1) * 0.05}>
        <mesh geometry={full} scale={1.05}>
          <meshPhysicalMaterial
            color="#efe4fb"
            roughness={0.15}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.06}
            iridescence={1}
            iridescenceIOR={1.6}
            iridescenceThicknessRange={[240, 880]}
            envMapIntensity={1.35}
            sheen={0.6}
            sheenColor="#ffd4ee"
            sheenRoughness={0.35}
          />
        </mesh>
      </group>

      <group rotation-y={-t * Math.PI * 2} rotation-x={wave(t, 1) * 0.08}>
        {orbits.map((orbit, i) => (
          <OrbitPath key={i} orbit={orbit} t={t} />
        ))}
      </group>
    </>
  );
};

export const V06MolecularOrbit: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#2f7fd0" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.4]} toneMapping={THREE.ACESFilmicToneMapping} exposure={1.05}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
