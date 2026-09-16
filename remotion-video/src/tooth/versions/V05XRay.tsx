import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { Halo, SceneBackdrop, Starfield } from "../parts";
import { Stage, useLoop, wave } from "../stage";
import { useXRayMaterial } from "../shaders/materials";

/**
 * Version 05 - "X-Ray".
 *
 * Additive, double-sided and depth-write-free, so every shell the ray passes
 * through adds to the pixel: thick crown, faint roots.
 *
 * The supplied model has a ledge where the crown meets the roots. An opaque
 * top-lit render hides it under the crown's overhang; an additive one cannot.
 * Relaxing it out of the geometry was tried and abandoned - Laplacian smoothing
 * flattens patches into camera-facing planes whose fresnel term collapses, which
 * trades one hard edge for a scatter of dark specks. Carrying the contrast low
 * enough does the job instead, and the ledge then reads as the gum line it
 * roughly follows.
 *
 * The reference is a pale, low-contrast plate sitting in a vertical shaft of
 * haze that runs past the tooth both above and below, with the roots dissolving
 * into it. Kept deliberately dim and small in frame - pushing the exposure turns
 * the tooth into a flat blue silhouette and loses the radiograph feel entirely.
 */

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();

  const xray = useXRayMaterial({
    uCore: "#1348a8",
    uEdge: "#8ad4ff",
    uIntensity: 0.34,
    uFresnelPow: 1.55,
    uBase: 0.5,
    uFadeStart: -1.3,
    uFadeEnd: -0.55,
    uOpacity: 1,
  });

  return (
    <>
      <SceneBackdrop
        colors={["#04102c", "#020a1c", "#010714", "#000000"]}
        stops={[0, 0.25, 0.45, 1]}
        center={[0.5, 0.56]}
        radius={[0.95, 0.8]}
      />
      <Halo color="#0e3570" size={5.2} opacity={0.3} power={2.4} position={[0, 0.1, -2]} />
      {/* The shaft of haze the tooth sits in - it runs past it top and bottom. */}
      <Halo color="#17477f" size={2.6} squash={1.9} opacity={0.2} power={1.3} position={[0, 1.5, -0.8]} />
      <Halo color="#1d58a4" size={1.9} squash={2.3} opacity={0.3} power={1.35} position={[0, -1.65, -0.7]} />
      <Starfield count={90} seed={23} spread={[14, 8, 10]} color="#5fa8ff" size={9} opacity={0.28} />

      <group rotation-y={t * Math.PI * 2} position-y={0.06 + wave(t, 1) * 0.04} scale={1.02}>
        <mesh geometry={full} material={xray} />
      </group>
    </>
  );
};

export const V05XRay: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.8]} toneMapping={THREE.NoToneMapping}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
