/**
 * Look 3 - Neon Tier.
 *
 * A two-tier black plinth ringed with neon edge strips, on a polished floor,
 * with a dark slab standing behind it and a neon line running along the
 * wall/floor junction past both frame edges.
 *
 * The reflections in the floor are most of what sells this look, so the floor
 * is a real planar reflector rather than an environment fake - a gradient
 * environment map has nothing in it to reflect, which is exactly why it was
 * the right choice for the plinth bevels and the wrong one here. Floor
 * roughness and reflection blur are the two values worth tuning first if the
 * look needs adjusting.
 *
 * Loop: each strip pulses a whole number of cycles, offset in phase from the
 * other, and the travelling glow on the wall line completes one pass.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { Plinth } from "../rig/Plinth";
import { StageShadows } from "../rig/Rig";
import { RingGlow, StripGlow } from "../rig/Glow";
import { buildSurfaceTextures } from "../rig/textures";
import { tierRadius, tierTopY } from "../rig/plinthGeometry";
import { loopPulse } from "../lib/loop";
import type { LookDefinition, StagePalette } from "./types";

const WALL_Z = -8.3;
const SLAB_Z = -5.2;
/** Runs well past both frame edges, as in the reference. */
const WALL_LINE_HALF_WIDTH = 42;

/** Whole cycles, so both strips return to their frame-0 brightness. */
const STRIP_CYCLES = 1;
/** Second tier trails the first slightly - they should not breathe together. */
const STRIP_PHASE_OFFSET = 0.37;

const wallLineVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const wallLineFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uBase;
uniform float uTravel;
uniform float uWidth;
varying vec2 vUv;

void main() {
  // A single soft bright spot running the length of the line, wrapping at the
  // ends. One complete pass across the clip, so it loops.
  float d = abs(fract(vUv.x - uTravel + 0.5) - 0.5);
  float travelling = exp(-pow(d / uWidth, 2.0));
  vec3 color = uColor * (uBase + travelling * 0.85);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const WallLine: React.FC<{ color: string; t: number; y: number }> = ({
  color,
  t,
  y,
}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: wallLineVertex,
        fragmentShader: wallLineFragment,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uBase: { value: 1.35 },
          uTravel: { value: 0 },
          uWidth: { value: 0.045 },
        },
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uTravel.value = t;

  return (
    <mesh material={material} position={[0, y, WALL_Z + 0.08]}>
      <planeGeometry args={[WALL_LINE_HALF_WIDTH * 2, 0.07]} />
    </mesh>
  );
};

/** One neon strip, sitting just proud of a tier's top edge. */
const NeonStrip: React.FC<{
  radius: number;
  y: number;
  color: string;
  intensity: number;
}> = ({ radius, y, color, intensity }) => (
  <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <torusGeometry args={[radius, 0.028, 16, 320]} />
    <meshStandardMaterial
      color={new THREE.Color("#000000")}
      emissive={new THREE.Color(color)}
      emissiveIntensity={intensity}
    />
  </mesh>
);

export const NeonTier: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
  t: number;
}> = ({ look, palette, t }) => {
  const accent = palette.accent ?? "#ffffff";
  const floorY = look.stageOffsetY;

  const concrete = useMemo(
    () =>
      buildSurfaceTextures({
        seed: 0x9e07c1,
        size: 1024,
        basePeriod: 4,
        octaves: 6,
        contrast: 0.2,
        level: 0.82,
        speckle: 0.09,
        repeat: [3, 2],
        anisotropy: 16,
      }),
    [],
  );
  useEffect(() => concrete.dispose, [concrete]);

  const strips = useMemo(
    () =>
      Array.from({ length: look.plinth.tiers }, (_, index) => ({
        radius: tierRadius(look.plinth, index) - 0.03,
        y: tierTopY(look.plinth, index) - 0.02,
      })),
    [look.plinth],
  );

  return (
    <group>
      <StageShadows size={5} samples={16} focus={0.4} />

      <ambientLight intensity={0.85} color={new THREE.Color(palette.ambient)} />
      {/* Barely there: the neon does the lighting, this just keeps the
          concrete from going pure black and gives the plinth a top edge. */}
      <directionalLight
        position={[1.2, 9.5, 7]}
        intensity={1.5}
        color={new THREE.Color(palette.key)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      {/* Back wall. */}
      <mesh position={[0, 10, WALL_Z]} receiveShadow>
        <planeGeometry args={[70, 34]} />
        <meshStandardMaterial
          color={new THREE.Color(palette.backdrop)}
          map={concrete.color}
          roughnessMap={concrete.linear}
          bumpMap={concrete.linear}
          bumpScale={0.5}
          roughness={0.92}
          metalness={0}
        />
      </mesh>

      <WallLine color={accent} t={t} y={floorY + 0.045} />
      {/* The wash the wall line throws up the concrete. */}
      <StripGlow
        color={accent}
        width={WALL_LINE_HALF_WIDTH * 2}
        height={7}
        falloff={0.085}
        intensity={0.5}
        position={[0, floorY + 3.5, WALL_Z + 0.12]}
      />

      {/* The slab: slightly wider than the plinth, as in the reference, and
          the main thing the floor has to reflect. */}
      <mesh position={[0, floorY + 3.6, SLAB_Z]} castShadow receiveShadow>
        <boxGeometry args={[6.4, 7.2, 0.4]} />
        <meshStandardMaterial
          color={new THREE.Color(palette.backdropAlt)}
          map={concrete.color}
          roughnessMap={concrete.linear}
          bumpMap={concrete.linear}
          bumpScale={0.35}
          roughness={0.72}
          metalness={0.03}
        />
      </mesh>

      {/* Polished floor. */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          resolution={1024}
          mixBlur={0.7}
          mixStrength={5.5}
          blur={[210, 75]}
          depthScale={1.1}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.3}
          depthToBlurRatioBias={0.22}
          mirror={0.55}
          color={new THREE.Color(palette.backdrop)}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* The pool the edge strips throw on the polished floor. */}
      <RingGlow
        color={accent}
        extent={look.plinth.radius * 3.2}
        peak={0.33}
        width={0.08}
        haze={0.3}
        intensity={0.3}
        position={[0, floorY + 0.006, 0]}
      />

      <group position={[0, look.stageOffsetY, 0]}>
        <Plinth
          spec={look.plinth}
          color={palette.plinth}
          roughness={0.42}
          metalness={0.15}
          envMapIntensity={0.45}
          clearcoat={0.3}
        />
        {strips.map((strip, index) => (
          <NeonStrip
            key={index}
            radius={strip.radius}
            y={strip.y}
            color={accent}
            intensity={
              // Out of phase with each other, so the stack breathes rather
              // than blinking as one object.
              6.2 *
              (0.82 +
                0.18 *
                  loopPulse(t, STRIP_CYCLES, index * STRIP_PHASE_OFFSET))
            }
          />
        ))}
      </group>
    </group>
  );
};
