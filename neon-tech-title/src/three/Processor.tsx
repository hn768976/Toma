import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { usePalette } from './theme';
import { loopAngle, loopSin } from '../lib/timing';

const CHEVRON_COUNT = 30;
const DOT_COUNT = 32;

/** One small arrow head, extruded flat, laid into the horizontal plane. */
const useChevronGeometry = () =>
  useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.075, -0.062);
    s.lineTo(0.036, 0);
    s.lineTo(-0.075, 0.062);
    s.lineTo(-0.034, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

/** Solid tier: a plain disc-topped cylinder, used below the well. */
const Tier: React.FC<{
  rTop: number;
  rBottom: number;
  topY: number;
  bottomY: number;
  colour: string;
  rough?: number;
  metal?: number;
}> = ({ rTop, rBottom, topY, bottomY, colour, rough = 0.42, metal = 0.5 }) => (
  <mesh position={[0, (topY + bottomY) / 2, 0]} castShadow receiveShadow>
    <cylinderGeometry args={[rTop, rBottom, topY - bottomY, 96]} />
    <meshStandardMaterial color={colour} roughness={rough} metalness={metal} />
  </mesh>
);

/**
 * Open step ring: a flat annular top plus its outer side wall.
 *
 * The upper half of the stack has to be built from annuli rather than solid
 * cylinders -- a solid cylinder's top cap fills the middle and buries the
 * recessed well that the core sits in.
 */
const StepRing: React.FC<{
  outer: number;
  inner: number;
  topY: number;
  bottomY: number;
  colour: string;
  rough?: number;
  metal?: number;
}> = ({ outer, inner, topY, bottomY, colour, rough = 0.34, metal = 0.58 }) => (
  <group>
    <mesh position={[0, topY, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <ringGeometry args={[inner, outer, 96]} />
      <meshStandardMaterial
        color={colour}
        roughness={rough}
        metalness={metal}
        side={THREE.DoubleSide}
      />
    </mesh>
    <mesh position={[0, (topY + bottomY) / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[outer, outer, topY - bottomY, 96, 1, true]} />
      <meshStandardMaterial
        color={colour}
        roughness={rough}
        metalness={metal}
        side={THREE.DoubleSide}
      />
    </mesh>
  </group>
);

/** A flat ribbon arc lying in the horizontal plane. */
const Arc: React.FC<{
  inner: number;
  outer: number;
  start: number;
  length: number;
  y: number;
  opacity?: number;
}> = ({ inner, outer, start, length, y, opacity = 0.95 }) => {
  const palette = usePalette();
  return (
  <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[inner, outer, 128, 1, start, length]} />
    <meshStandardMaterial
      color={palette.arc}
      roughness={0.62}
      metalness={0.04}
      transparent
      opacity={opacity}
      side={THREE.DoubleSide}
    />
  </mesh>
  );
};

export const Processor: React.FC = () => {
  const palette = usePalette();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const chevronGeo = useChevronGeometry();

  // Whole numbers of turns across the loop, so the last frame meets the first.
  const arcA = loopAngle(frame, durationInFrames, 1);
  const arcB = loopAngle(frame, durationInFrames, -1);
  const chevronSpin = loopAngle(frame, durationInFrames, 2);
  const dotSpin = loopAngle(frame, durationInFrames, -1);
  const pulse = loopSin(frame, durationInFrames, 6) * 0.5 + 0.5;

  const L = palette.metalLight;
  const M = palette.metalMid;
  const D = palette.metalDark;

  const WELL_R = 0.56;
  const WELL_FLOOR = 1.6;
  const WELL_TOP = 2.08;

  return (
    <group>
      {/* ---------- solid lower body ---------- */}
      <Tier rTop={2.42} rBottom={2.42} topY={0.24} bottomY={0} colour={D} rough={0.55} metal={0.42} />
      <Tier rTop={2.46} rBottom={2.46} topY={0.4} bottomY={0.24} colour={L} rough={0.42} metal={0.4} />
      <Tier rTop={1.94} rBottom={1.94} topY={1.12} bottomY={0.44} colour={D} rough={0.5} metal={0.45} />

      {/* Dotted lights around the drum shoulder. */}
      <group position={[0, 0.94, 0]} rotation={[0, dotSpin, 0]}>
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const a = (i / DOT_COUNT) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.93, 0, Math.sin(a) * 1.93]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={new THREE.Color('#e8f1ff')}
                emissiveIntensity={2.2}
                roughness={0.3}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      </group>

      <Tier rTop={1.78} rBottom={1.78} topY={1.32} bottomY={1.12} colour={L} rough={0.36} metal={0.5} />
      <Tier rTop={1.58} rBottom={1.58} topY={1.54} bottomY={1.32} colour={M} rough={0.45} metal={0.5} />

      {/* Lit gap that rings the barrel. */}
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[1.58, 1.58, 0.05, 96]} />
        <meshStandardMaterial
          color={palette.coreHot}
          emissive={new THREE.Color(palette.core)}
          emissiveIntensity={1.0 + pulse * 0.55}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>

      {/* ---------- stepped rings climbing toward the well ---------- */}
      <StepRing outer={1.42} inner={1.12} topY={1.74} bottomY={1.54} colour={L} />
      <StepRing outer={1.12} inner={0.86} topY={1.92} bottomY={1.74} colour={M} rough={0.42} />
      <StepRing outer={0.86} inner={WELL_R} topY={WELL_TOP} bottomY={1.92} colour={L} rough={0.3} metal={0.62} />

      {/* ---------- recessed well ---------- */}
      <mesh position={[0, (WELL_TOP + WELL_FLOOR) / 2, 0]}>
        <cylinderGeometry args={[WELL_R, WELL_R * 0.92, WELL_TOP - WELL_FLOOR, 64, 1, true]} />
        <meshStandardMaterial
          color="#2b3648"
          roughness={0.55}
          metalness={0.35}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Violet-blue lens on the floor of the well. */}
      <mesh position={[0, WELL_FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[WELL_R * 0.92, 64]} />
        <meshStandardMaterial
          color={palette.coreHot}
          emissive={new THREE.Color(palette.core)}
          emissiveIntensity={1.8 + pulse * 1.3}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, 1.95, 0]}
        color={palette.core}
        intensity={4.5 + pulse * 3}
        distance={8}
        decay={2}
      />

      {/* ---------- chevron ring ---------- */}
      <group position={[0, 2.02, 0]} rotation={[0, chevronSpin, 0]}>
        {Array.from({ length: CHEVRON_COUNT }, (_, i) => {
          const a = (i / CHEVRON_COUNT) * Math.PI * 2;
          return (
            <mesh
              key={i}
              geometry={chevronGeo}
              position={[Math.cos(a) * 1.34, 0, Math.sin(a) * 1.34]}
              rotation={[0, -a + Math.PI / 2, 0]}
            >
              <meshStandardMaterial
                color="#ffffff"
                emissive={new THREE.Color('#dfeaff')}
                emissiveIntensity={1.4}
                roughness={0.35}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* ---------- orbiting flat arcs ---------- */}
      <group rotation={[0, arcA, 0]}>
        <Arc inner={2.56} outer={3.04} start={0.2} length={2.05} y={0.5} />
        <Arc inner={2.56} outer={3.04} start={Math.PI + 0.4} length={1.45} y={0.5} />
      </group>
      <group rotation={[0, arcB, 0]}>
        <Arc inner={2.1} outer={2.48} start={1.15} length={2.25} y={0.86} opacity={0.9} />
        <Arc inner={2.1} outer={2.48} start={Math.PI + 1.35} length={1.05} y={0.86} opacity={0.9} />
        <mesh
          position={[Math.cos(3.4) * 2.29, 0.86, Math.sin(3.4) * 2.29]}
          rotation={[-Math.PI / 2, 0, -3.4 + Math.PI / 2]}
        >
          <cylinderGeometry args={[0, 0.34, 0.46, 3]} />
          <meshStandardMaterial
            color={palette.arc}
            roughness={0.62}
            metalness={0.04}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
};
