import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { GlowShell, Halo, SceneBackdrop, Starfield, SurfacePoints } from "../parts";
import { Stage, useLoop, usePxScale, wave } from "../stage";
import { useWireMaterial } from "../shaders/materials";

/**
 * Version 01 - "Wireframe Halo".
 *
 * A low-poly tooth drawn as a glowing triangulated shell on deep navy.
 * Everything is additive and double-sided so the far side of the mesh shows
 * through the near side, which is what gives the reference its x-ray quality.
 */

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { low, lowBary, points } = useToothAssets();

  const wire = useWireMaterial({
    uFill: "#0e3f91",
    uLine: "#52c4f2",
    uGlow: "#1d6fd2",
    uFillAlpha: 0.11,
    uLineWidth: 0.85,
    uGlowStrength: 0.5,
    uFresnelPow: 2.1,
    uOpacity: 1,
    uPx: px,
    uScanY: -99,
    uScanWidth: 0.04,
    uScanStrength: 0,
    uScanColor: "#ff3d8b",
  });

  return (
    <>
      <SceneBackdrop
        colors={["#0b2570", "#061643", "#020827", "#01030d"]}
        stops={[0, 0.32, 0.62, 1]}
        center={[0.5, 0.54]}
        radius={[1.2, 0.95]}
        vignette={0.86}
        vignetteColor="#000208"
        vignetteCenter={[0.5, 0.52]}
        vignetteRadius={[0.7, 0.6]}
        vignetteRange={[0.3, 1.15]}
        vignettePower={2.2}
      />
      <Halo color="#1b5fc0" size={9} opacity={0.34} power={2.8} position={[0, 0, -2.2]} />
      <Starfield
        count={340}
        seed={11}
        spread={[18, 10, 12]}
        color="#7cc4ff"
        size={13}
        opacity={0.75}
      />
      <group rotation-y={t * Math.PI * 2} position-y={wave(t, 1) * 0.05} scale={1.34}>
        <mesh geometry={lowBary} material={wire} />
        <GlowShell geometry={low} color="#1c6ac4" strength={0.5} power={3.2} scale={1.035} />
        <SurfacePoints cloud={points} count={4200} color="#cdefff" size={5} opacity={0.35} />
      </group>
    </>
  );
};

export const V01WireframeHalo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#01030d" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.6]} toneMapping={THREE.NoToneMapping}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
