import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { GlowShell, Halo, SceneBackdrop, Starfield, SurfacePoints } from "../parts";
import { Stage, saw, useLoop, usePxScale, wave } from "../stage";
import { useRadialMaterial, useWireMaterial } from "../shaders/materials";

/**
 * Version 02 - "Scan Sweep".
 *
 * The wireframe tooth of version 01 with a magenta analysis plane travelling up
 * through it. The plane exists twice: as a band term inside the tooth's own
 * shader, and as a real disc in the scene - so it reads as a flat line when it
 * passes the camera's eye level and opens into an ellipse above and below,
 * exactly as a physical plane would.
 */

const SCAN_BOTTOM = -1.52;
const SCAN_TOP = 1.56;

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { low, lowBary, points } = useToothAssets();

  const sweep = saw(t, 1);
  const scanY = SCAN_BOTTOM + sweep * (SCAN_TOP - SCAN_BOTTOM);
  // Fading the beam out at both ends of the sweep hides the wrap, so the clip
  // still loops cleanly even though the plane itself teleports.
  const scanStrength = Math.sin(Math.PI * sweep) ** 0.6;

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
    uScanY: scanY,
    uScanWidth: 0.05,
    uScanStrength: 2.6 * scanStrength,
    uScanColor: "#ff2f86",
  });

  const disc = useRadialMaterial(
    { uColor: "#ff2f86", uOpacity: 0.5 * scanStrength, uPower: 1.4, uAspect: 1 },
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
        <GlowShell geometry={low} color="#1c6ac4" strength={0.5} power={3.2} scale={1.035} />
        <SurfacePoints cloud={points} count={4200} color="#cdefff" size={5} opacity={0.35} />
      </group>

      <group position-y={scanY}>
        <mesh material={disc} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.22, 72]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.88, 0.97, 96]} />
          <meshBasicMaterial
            color="#ff6aae"
            transparent
            opacity={0.95 * scanStrength}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
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
