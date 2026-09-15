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
 * through adds to the pixel: thick crown, faint roots. The roots are then faded
 * out into a soft beam below, the way the reference dissolves them into mist.
 */

const Scene: React.FC = () => {
  const { t } = useLoop();
  const { full } = useToothAssets();

  const xray = useXRayMaterial({
    uCore: "#0b3ea8",
    uEdge: "#7fd4ff",
    uIntensity: 0.8,
    uFresnelPow: 1.55,
    uBase: 0.24,
    uFadeStart: -1.02,
    uFadeEnd: -0.15,
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
      <Halo color="#123f86" size={6.5} opacity={0.34} power={2.4} position={[0, 0.1, -2]} />
      {/* The misty column the roots dissolve into. */}
      <Halo color="#1b57a8" size={1.15} squash={4.2} opacity={0.5} power={1.6} position={[0, -2.05, -0.6]} />
      <Starfield count={120} seed={23} spread={[14, 8, 10]} color="#5fa8ff" size={10} opacity={0.35} />

      <group rotation-y={t * Math.PI * 2} position-y={0.08 + wave(t, 1) * 0.04} scale={1.34}>
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
