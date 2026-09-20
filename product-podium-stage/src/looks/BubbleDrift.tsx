/**
 * Look 4 - Bubble Drift.
 *
 * High-key lilac field with translucent spheres drifting down past a white
 * cylinder plinth. The only light look in the set, which is most of its
 * value - everything else here is dark or saturated.
 *
 * There is no floor plane and no horizon: the ground fades into the
 * background so the plinth reads as standing in open space. The contact
 * shadow is carried by a separate soft shadow-catcher rather than a visible
 * floor.
 *
 * Sphere motion, and why it is built this way:
 *
 *   Each sphere has a fixed seeded position, radius and phase offset, and its
 *   height is derived from (frame + offset) mod cycleLength. Nothing is
 *   carried between frames - no mutable particle array, no accumulated
 *   velocity - because Remotion renders frames out of order across threads
 *   and any state carried forward would desynchronise between them.
 *
 *   cycleLength divides evenly into the composition duration, and the travel
 *   span runs from above the top of frame to below the bottom, so every
 *   sphere resets off-screen, staggered, and the field returns exactly to its
 *   frame-0 arrangement at the loop point.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Plinth } from "../rig/Plinth";
import { StageShadows } from "../rig/Rig";
import { GradientBackdrop } from "../rig/Backdrop";
import { randRange, seededRandom } from "../lib/random";
import { sawtooth } from "../lib/loop";
import type { LookDefinition, StagePalette } from "./types";

const SPHERE_COUNT = 38;
/** Divides evenly into the 300-frame duration. */
const CYCLE_FRAMES = 300;
/** Both ends are comfortably outside frame, so resets are never seen. */
const SPAWN_Y = 7.6;
const DESPAWN_Y = -3.6;

interface SphereSpec {
  x: number;
  z: number;
  radius: number;
  offsetFrames: number;
  /** Pale translucent, versus the tinted mostly-opaque majority. */
  translucent: boolean;
  /** Small horizontal wander, one whole cycle so it loops. */
  swayAmplitude: number;
  swayPhase: number;
}

const buildSpheres = (lookId: string): SphereSpec[] => {
  // Seeded on the look id, not the palette, so both palettes of this look
  // place their spheres identically.
  const rng = seededRandom(lookId, "spheres");
  return Array.from({ length: SPHERE_COUNT }, () => ({
    x: randRange(rng, -5.2, 5.2),
    // Spread through depth: some pass in front of the plinth, some behind,
    // and the extremes fall outside the focus range so DOF softens them.
    z: randRange(rng, -7.5, 6.0),
    radius: randRange(rng, 0.09, 0.42),
    offsetFrames: Math.floor(rng() * CYCLE_FRAMES),
    translucent: rng() < 0.3,
    swayAmplitude: randRange(rng, 0.05, 0.28),
    swayPhase: rng(),
  }));
};

const Spheres: React.FC<{
  specs: SphereSpec[];
  frame: number;
  color: string;
}> = ({ specs, frame, color }) => {
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 48, 32), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      {specs.map((spec, index) => {
        const progress = sawtooth(frame, CYCLE_FRAMES, spec.offsetFrames);
        const y = SPAWN_Y - progress * (SPAWN_Y - DESPAWN_Y);
        const sway =
          Math.sin((progress + spec.swayPhase) * Math.PI * 2) * spec.swayAmplitude;

        return (
          <mesh
            key={index}
            geometry={geometry}
            position={[spec.x + sway, y, spec.z]}
            scale={spec.radius}
          >
            {spec.translucent ? (
              <meshPhysicalMaterial
                color={new THREE.Color("#ffffff")}
                roughness={0.18}
                metalness={0}
                transparent
                opacity={0.55}
                // Off, so overlapping spheres blend instead of punching holes
                // in each other through the transparent sort order.
                depthWrite={false}
                clearcoat={0.8}
                clearcoatRoughness={0.15}
                envMapIntensity={1.1}
              />
            ) : (
              <meshPhysicalMaterial
                color={new THREE.Color(color)}
                roughness={0.3}
                metalness={0}
                clearcoat={0.55}
                clearcoatRoughness={0.22}
                envMapIntensity={0.9}
              />
            )}
          </mesh>
        );
      })}
    </group>
  );
};

export const BubbleDrift: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
  t: number;
  frame: number;
}> = ({ look, palette, frame }) => {
  const specs = useMemo(() => buildSpheres(look.id), [look.id]);
  const floorY = look.stageOffsetY;

  return (
    <group>
      {/* Wide and soft: this look wants a shadow you can barely find, only
          enough to sit the plinth on something. */}
      <StageShadows size={14} samples={20} focus={0.2} />

      <GradientBackdrop
        top={palette.backdropAlt}
        bottom={palette.backdrop}
        // A very wide span, so the ramp never resolves into a horizon: the
        // ground simply fades into the background.
        lowY={-6}
        highY={9}
      />

      <ambientLight intensity={1.15} color={new THREE.Color(palette.ambient)} />
      <hemisphereLight
        intensity={0.9}
        color={new THREE.Color(palette.key)}
        groundColor={new THREE.Color(palette.backdrop)}
      />
      {/* Weak and high, so the contact shadow exists but nothing has a hard
          edge. High key means low contrast, not no shading. */}
      <directionalLight
        position={[3.2, 9.5, 5.5]}
        intensity={1.15}
        color={new THREE.Color(palette.key)}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={32}
        shadow-bias={-0.0012}
        shadow-normalBias={0.05}
      />

      {/* Shadow catcher, not a floor: it takes the contact shadow while
          staying invisible, which is what keeps the ground line from
          appearing. */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial opacity={0.3} color={new THREE.Color("#4a3f7a")} />
      </mesh>

      <group position={[0, look.stageOffsetY, 0]}>
        <Plinth
          spec={look.plinth}
          color={palette.plinth}
          roughness={0.72}
          metalness={0}
          envMapIntensity={1.0}
        />
      </group>

      <Spheres specs={specs} frame={frame} color={palette.props ?? palette.ambient} />
    </group>
  );
};
