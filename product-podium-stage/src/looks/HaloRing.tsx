/**
 * Look 2 - Halo Ring.
 *
 * A glowing neon torus hovering over a dark disc in a fogged blue void, with
 * a volumetric light cone falling from the ring to the plinth.
 *
 * The cone is a raymarched density field (volumetric.ts), terminated
 * analytically against the ground plane and the plinth so it occludes
 * correctly. It renders additively into the HDR buffer before post, so bloom
 * picks it up along with the ring.
 *
 * This look and its magenta counterpart are the same rig - identical
 * geometry, fog, camera and cone. Only the palette row differs, which is what
 * the two blue references in the brief turn out to be as well.
 *
 * Loop: the ring pulse runs two whole cycles over the clip, and both noise
 * fields drift by exactly one world period, so everything returns to its
 * frame-0 state.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Plinth } from "../rig/Plinth";
import { SceneFog, StageShadows } from "../rig/Rig";
import { GradientBackdrop } from "../rig/Backdrop";
import { plinthTopY } from "../rig/plinthGeometry";
import { loopPulse } from "../lib/loop";
import type { LookDefinition, StagePalette } from "./types";
import { volumetricFragmentShader, volumetricVertexShader } from "./volumetric";

const RING_Y = 2.0;
const RING_RADIUS = 1.38;
const RING_TUBE = 0.045;
/** Ring intensity pulses twice across the clip - whole cycles, so it loops. */
const PULSE_CYCLES = 2;

/**
 * Tilt of the ring's normal toward camera, in radians.
 *
 * The brief fixes the podium's top at ~55% of frame height and the camera at
 * an 8-degree downward tilt, which leaves about 31% of frame above the
 * podium. A ring high enough to be seen from below - the angle that opens it
 * into an ellipse - does not fit in that gap; at any height that does fit it
 * sits within a couple of degrees of eye level and reads as a flat bar.
 * Tipping the ring itself toward the camera opens the ellipse to match the
 * reference while keeping the podium placement and the locked camera, and a
 * hovering ring has no "correct" orientation to violate.
 */
const RING_TILT = THREE.MathUtils.degToRad(21);

/** Tileable-noise settings. World period = uNoisePeriod / frequency. */
const NOISE_PERIOD = 2.0;
const CONE_NOISE_FREQ = 0.5;
const FOG_NOISE_FREQ = 0.22;

const VolumetricStage: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
  t: number;
  frame: number;
  floorY: number;
  plinthTop: number;
  ringY: number;
  coneIntensity: number;
}> = ({ look, palette, t, frame, floorY, plinthTop, ringY, coneIntensity }) => {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: volumetricVertexShader,
      fragmentShader: volumetricFragmentShader,
      // Step count baked in as a compile-time constant: the loop unrolls and
      // there is no per-sample branch on a uniform.
      defines: { STEPS: look.volumetricSteps ?? 48 },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uInvViewProj: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uFrame: { value: 0 },
        uFloorY: { value: floorY },
        uPlinthTop: { value: plinthTop },
        uPlinthRadius: { value: look.plinth.radius },
        uRingY: { value: ringY },
        uRingRadius: { value: RING_RADIUS },
        uConeTopRadius: { value: RING_RADIUS * 1.02 },
        uConeBottomRadius: { value: look.plinth.radius * 1.05 },
        uConeColor: { value: new THREE.Color(palette.accent ?? "#ffffff") },
        uFogColor: { value: new THREE.Color(palette.fog ?? palette.ambient) },
        uConeIntensity: { value: 0 },
        uGlowIntensity: { value: 0 },
        uFogDensity: { value: 0.055 },
        uFogHeight: { value: 0.85 },
        uConeDrift: { value: new THREE.Vector3() },
        uFogDrift: { value: new THREE.Vector3() },
        uNoisePeriod: { value: NOISE_PERIOD },
        uConeNoiseFreq: { value: CONE_NOISE_FREQ },
        uFogNoiseFreq: { value: FOG_NOISE_FREQ },
      },
    });
    // Rebuilt only when the structural inputs change, not per frame: the
    // per-frame uniforms below are written in place on the existing material
    // so the shader is never recompiled mid-render.
  }, [look, palette, floorY, plinthTop, ringY]);

  useEffect(() => () => material.dispose(), [material]);

  // Both fields translate by exactly one noise period across the loop, so
  // frame 300 samples the same field as frame 0 while never stopping.
  //
  // The drift uniforms are added to the sample point *after* it is scaled by
  // the frequency, so they are in lattice units and each component must be a
  // whole multiple of NOISE_PERIOD. Scaling a period by a direction vector's
  // components - the obvious way to aim the drift - breaks exactly that, and
  // the field then lands somewhere mid-period at the loop point. It is a
  // quiet failure: the fog still drifts and still looks right in any single
  // frame, it just does not come back.
  material.uniforms.uFrame.value = frame;
  material.uniforms.uConeIntensity.value = 0.15 * coneIntensity;
  // Kept low: the ring's own halo comes from bloom on the emissive mesh,
  // and the volumetric glow term assumes a horizontal ring, so leaning on it
  // would misplace the halo now that the ring is tipped.
  material.uniforms.uGlowIntensity.value = 0.16 * coneIntensity;
  // Cone shimmer drifts downward, with the beam: one period on Y.
  (material.uniforms.uConeDrift.value as THREE.Vector3).set(0, -t * NOISE_PERIOD, 0);
  // Ground fog rolls sideways: one period on X. In world units that is
  // NOISE_PERIOD / FOG_NOISE_FREQ, about 9 units over the clip.
  (material.uniforms.uFogDrift.value as THREE.Vector3).set(t * NOISE_PERIOD, 0, 0);

  const onBeforeRender = useMemo(
    () =>
      (
        _renderer: THREE.WebGLRenderer,
        _scene: THREE.Scene,
        camera: THREE.Camera,
      ) => {
        // Taken at draw time, so the ray reconstruction always matches the
        // matrices actually used for this frame.
        (material.uniforms.uInvViewProj.value as THREE.Matrix4)
          .copy(camera.projectionMatrixInverse)
          .premultiply(camera.matrixWorld);
        (material.uniforms.uCamPos.value as THREE.Vector3).setFromMatrixPosition(
          camera.matrixWorld,
        );
      },
    [material],
  );

  return (
    <mesh
      material={material}
      frustumCulled={false}
      renderOrder={20}
      onBeforeRender={onBeforeRender}
    >
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

export const HaloRing: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
  t: number;
  /**
   * Required, not defaulted: this drives the raymarch's per-pixel start
   * offset. If it is ever constant the jitter freezes into fixed speckle
   * locked to screen coordinates instead of reading as atmosphere, and the
   * cone loses its shimmer - a failure that is invisible in a single still.
   */
  frame: number;
}> = ({ look, palette, t, frame }) => {
  const accent = palette.accent ?? "#ffffff";
  // Gentle: a pulse you notice only if you look for it. This sits under a
  // product shot for minutes at a time.
  const pulse = 0.88 + 0.12 * loopPulse(t, PULSE_CYCLES);

  const floorY = look.stageOffsetY;
  const plinthTop = plinthTopY(look.plinth) + look.stageOffsetY;
  const ringY = RING_Y + look.stageOffsetY;

  const ringGeometry = useMemo(
    () => new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 24, 320),
    [],
  );
  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  return (
    <group>
      <StageShadows size={6} samples={18} focus={0.5} />

      {/* Exponential fog matched to the backdrop.
          Without it the ground plane's far edge draws a hard horizontal line
          across the frame - no finite plane can reach the horizon, so the
          edge has to be faded rather than pushed further away. It doubles as
          the aerial perspective this look wants. */}
      <SceneFog color={palette.backdropAlt} density={0.032} />

      <GradientBackdrop
        top={palette.backdrop}
        bottom={palette.backdropAlt}
        lowY={-2.5}
        highY={6.5}
      />

      <ambientLight intensity={0.28} color={new THREE.Color(palette.ambient)} />
      {/* The ring is the practical source, so the key comes from where it is. */}
      <pointLight
        position={[0, ringY, 0]}
        intensity={16 * pulse}
        distance={16}
        decay={2}
        color={new THREE.Color(accent)}
      />
      {/* A little top-down shaping so the plinth's bevel still reads. */}
      <directionalLight
        position={[2.5, 8, 4]}
        intensity={0.55}
        color={new THREE.Color(palette.key)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      {/* Ground. Dark and a little glossy, so the ring leaves a pool under it. */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial
          color={new THREE.Color(palette.backdrop)}
          roughness={0.52}
          metalness={0.25}
          envMapIntensity={0.35}
        />
      </mesh>

      <group position={[0, look.stageOffsetY, 0]}>
        <Plinth
          spec={look.plinth}
          color={palette.plinth}
          roughness={0.42}
          metalness={0.1}
          envMapIntensity={0.5}
        />
        {/* Thin lit rim around the top edge, picking up the ring's colour. */}
        <mesh
          position={[0, plinthTopY(look.plinth) - 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[look.plinth.radius - 0.05, 0.012, 16, 256]} />
          <meshStandardMaterial
            color={new THREE.Color("#000000")}
            emissive={new THREE.Color(accent)}
            emissiveIntensity={3.2 * pulse}
            toneMapped
          />
        </mesh>
      </group>

      {/* The ring, tipped toward camera so it reads as an ellipse. */}
      <mesh
        geometry={ringGeometry}
        position={[0, ringY, 0]}
        rotation={[-Math.PI / 2 + RING_TILT, 0, 0]}
      >
        <meshStandardMaterial
          color={new THREE.Color("#000000")}
          emissive={new THREE.Color(accent)}
          emissiveIntensity={9 * pulse}
        />
      </mesh>

      <VolumetricStage
        look={look}
        palette={palette}
        t={t}
        frame={frame}
        floorY={floorY}
        plinthTop={plinthTop}
        ringY={ringY}
        coneIntensity={pulse}
      />
    </group>
  );
};
