import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { Halo, SceneBackdrop, Starfield, SurfacePoints } from "../parts";
import { Stage, saw, useLoop, usePxScale, wave } from "../stage";
import { useWireMaterial } from "../shaders/materials";

/**
 * Version 02 - "Scan Sweep".
 *
 * The solid hologram of version 01 with a magenta analysis plane travelling up
 * through it.
 *
 * The band is drawn only where the plane meets the tooth's surface, in the
 * tooth's own shader. That is what the reference shows: the line hugs the
 * silhouette and breaks into two separate segments as it crosses the two roots.
 * A free-standing disc cannot do that - it reads as a ring floating around the
 * tooth rather than a cut through it. All that sits outside the silhouette is a
 * flat billboard flare, roughly the width of the tooth.
 */

const SCAN_BOTTOM = -1.52;
const SCAN_TOP = 1.56;

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { lowBary, points } = useToothAssets();

  const sweep = saw(t, 1);
  const scanY = SCAN_BOTTOM + sweep * (SCAN_TOP - SCAN_BOTTOM);
  // Fading the beam out at both ends of the sweep hides the wrap, so the clip
  // still loops cleanly even though the plane itself teleports.
  const scanStrength = Math.sin(Math.PI * sweep) ** 0.6;

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
      uScanY: scanY,
      uScanWidth: 0.035,
      uScanStrength: 3.4 * scanStrength,
      uScanColor: "#ff4f9c",
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
      <Starfield count={340} seed={11} spread={[18, 10, 12]} color="#7cc4ff" size={13} opacity={0.75} />

      <group rotation-y={t * Math.PI * 2} position-y={wave(t, 1) * 0.05} scale={1.34}>
        <mesh geometry={lowBary} material={wire} />
        <SurfacePoints cloud={points} count={2600} color="#dff4ff" size={4} opacity={0.5} />
      </group>

      {/* The flare the cut throws past the silhouette - nothing more. */}
      <Halo
        color="#ff4f9c"
        size={2.9}
        squash={0.075}
        opacity={0.85 * scanStrength}
        power={1.9}
        position={[0, scanY, -0.15]}
      />
    </>
  );
};

export const V02ScanSweep: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#01030d" }}>
    <WithToothAssets>
      <Stage fov={32} position={[0, 0, 6.6]} toneMapping={THREE.NoToneMapping}>
        <Scene />
      </Stage>
    </WithToothAssets>
  </AbsoluteFill>
);
