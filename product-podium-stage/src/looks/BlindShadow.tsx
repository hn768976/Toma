/**
 * Look 1 - Blind Shadow.
 *
 * Warm plaster wall and floor with a venetian blind gobo drifting across
 * both, and a low matte disc sitting on the floor.
 *
 * The blind is real geometry - a rack of tilted slats between the key light
 * and the stage - rather than a texture projected through the light. That
 * matters for two reasons. The penumbra then grows correctly with distance
 * from the occluder, so the slats are crisper high on the wall and softer
 * where they run out across the floor, which is the thing that sells it. And
 * the drift can be done by translating the blind, so the light *direction*
 * never changes: a buyer matching their own product's shadow to this frame
 * gets one fixed direction for the whole clip.
 *
 * The slats are invisible to the camera (colorWrite off) but fully present in
 * the shadow pass, which renders with its own depth material and so ignores
 * that flag.
 *
 * Loop: the blind translates by exactly one slat pitch over the 300 frames.
 * The rack is periodic and long enough that its ends never enter the shadow
 * camera, so frame 300 is pixel-identical to frame 0.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Plinth } from "../rig/Plinth";
import { StageShadows } from "../rig/Rig";
import { buildSurfaceTextures } from "../rig/textures";
import type { LookDefinition, StagePalette } from "./types";

/** Wall plane sits here; the floor runs from it toward camera. */
const WALL_Z = -8.3;
/** Key light position. Front-right and above, as in the reference. */
const LIGHT_POSITION = new THREE.Vector3(10, 9, 6);
const LIGHT_TARGET = new THREE.Vector3(0, 0.5, -2);

const SLAT_PITCH = 0.82;
/**
 * Enough slats that the rack over-covers the shadow camera.
 *
 * The loop works by translating the blind exactly one slat pitch, which is
 * indistinguishable from not moving it at all - but only if the rack's ends
 * stay outside the shadow camera for the whole drift. Otherwise a slat enters
 * or leaves at the edge, the shadow pattern does not repeat, and the clip has
 * a visible step at the loop point.
 *
 * The shadow camera is +/-18 and the blind is rolled SLAT_ANGLE relative to
 * it, so covering its corners needs 18 * (cos + sin) of that angle ~= 23.3.
 * 66 slats gives a half-extent of 27.1, with margin.
 */
const SLAT_COUNT = 66;
const SLAT_DEPTH = 0.34;
const SLAT_TILT = THREE.MathUtils.degToRad(24);
const SLAT_ANGLE = THREE.MathUtils.degToRad(21);
/** Fraction of the light-to-target distance at which the blind hangs. */
const BLIND_ALONG = 0.45;

const Blind: React.FC<{ t: number }> = ({ t }) => {
  const { position, rotation } = useMemo(() => {
    const blindPosition = LIGHT_POSITION.clone().lerp(LIGHT_TARGET, BLIND_ALONG);
    const helper = new THREE.Object3D();
    helper.position.copy(blindPosition);
    // For a non-camera Object3D, lookAt aims +Z at the target, so the slats
    // end up lying in a plane square to the light.
    helper.lookAt(LIGHT_TARGET);
    // Then roll about that axis to throw the slats diagonally.
    helper.rotateZ(SLAT_ANGLE);
    return { position: blindPosition, rotation: helper.rotation.clone() };
  }, []);

  // Long enough to over-cover the shadow camera across the roll, for the same
  // reason SLAT_COUNT is what it is.
  const geometry = useMemo(
    () => new THREE.BoxGeometry(58, 0.022, SLAT_DEPTH),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // One full pitch across the loop: continuous motion, exact return.
  const drift = t * SLAT_PITCH;

  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: SLAT_COUNT }, (_, i) => (
        <mesh
          key={i}
          geometry={geometry}
          castShadow
          position={[0, (i - (SLAT_COUNT - 1) / 2) * SLAT_PITCH + drift, 0]}
          rotation={[SLAT_TILT, 0, 0]}
        >
          {/* Invisible to the camera, but the shadow pass substitutes its own
              depth material, so the slat still occludes light. */}
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

export const BlindShadow: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
  t: number;
}> = ({ look, palette, t }) => {
  const plaster = useMemo(
    () =>
      buildSurfaceTextures({
        seed: 0x51a57e,
        size: 1024,
        basePeriod: 3,
        octaves: 6,
        // Mottle, not pattern: enough tonal drift that the wall never reads as
        // a flat fill, but nothing that resolves into a shape.
        contrast: 0.2,
        level: 0.9,
        repeat: [9, 4.5],
        anisotropy: 16,
      }),
    [],
  );
  useEffect(() => plaster.dispose, [plaster]);

  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.copy(LIGHT_TARGET);
    return object;
  }, []);

  return (
    <group position={[0, look.stageOffsetY, 0]}>
      {/* Tighter than the other looks: the slat edges need to stay defined
          rather than dissolving, while the contact shadow stays soft. */}
      <StageShadows size={18} samples={30} focus={0.85} />

      <ambientLight intensity={0.18} color={new THREE.Color(palette.ambient)} />
      {/* Sun-like: parallel rays give the slats a single consistent direction
          across wall and floor. */}
      <primitive object={target} />
      <directionalLight
        position={LIGHT_POSITION}
        target={target}
        intensity={3.1}
        color={new THREE.Color(palette.key)}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      {/* Bounce off the floor, keeping the shadowed side from going dead. */}
      <hemisphereLight
        intensity={0.28}
        color={new THREE.Color(palette.key)}
        groundColor={new THREE.Color(palette.backdropAlt)}
      />

      <Blind t={t} />

      {/* Wall. Large enough that its edges stay outside frame and outside the
          shadow camera. */}
      <mesh position={[0, 10, WALL_Z]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial
          color={new THREE.Color(palette.backdrop)}
          map={plaster.color}
          roughnessMap={plaster.linear}
          bumpMap={plaster.linear}
          bumpScale={1.4}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Floor, in the same plaster running toward camera. The seam where the
          two meet is the main scale cue in this look. */}
      <mesh
        position={[0, 0, WALL_Z + 24]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[60, 48]} />
        <meshStandardMaterial
          color={new THREE.Color(palette.backdrop)}
          map={plaster.color}
          roughnessMap={plaster.linear}
          bumpMap={plaster.linear}
          bumpScale={0.9}
          roughness={0.92}
          metalness={0}
        />
      </mesh>

      <Plinth
        spec={look.plinth}
        color={palette.plinth}
        roughness={0.7}
        metalness={0.06}
        envMapIntensity={1.0}
      />
    </group>
  );
};
