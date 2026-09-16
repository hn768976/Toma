import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { Halo, SceneBackdrop, Starfield, SurfacePoints } from "../parts";
import { Stage, useLoop, usePxScale, wave } from "../stage";
import { useWireMaterial } from "../shaders/materials";

/**
 * Version 01 - "Wireframe Halo".
 *
 * A low-poly tooth drawn as a glowing triangulated solid on deep navy.
 *
 * The mesh is opaque: front faces only, writing depth. The reference reads as a
 * lit volume with an emissive surface mesh, not as a see-through cage, so the
 * far side must not show through. The silhouette glow comes from a fresnel term
 * on the surface itself plus a soft billboard behind - an inflated shell would
 * put a hard offset outline around the tooth and make it look like a sticker.
 */

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { lowBary, points } = useToothAssets();

  const wire = useWireMaterial(
    {
      uFill: "#123f80",
      uLine: "#61c4ec",
      uGlow: "#6fd2ff",
      uFillAlpha: 1,
      uLineWidth: 0.8,
      uGlowStrength: 1.15,
      uFresnelPow: 1.9,
      uOpacity: 1,
      uPx: px,
      uScanY: -99,
      uScanWidth: 0.04,
      uScanStrength: 0,
      uScanColor: "#ff3d8b",
    },
    true,
  );

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
      {/* Tight, tooth-shaped bloom sitting just behind the mesh. */}
      <Halo color="#2f8ee0" size={3.4} squash={1.5} opacity={0.5} power={2.1} position={[0, 0, -0.9]} />
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
        <SurfacePoints cloud={points} count={2600} color="#dff4ff" size={4} opacity={0.5} />
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
