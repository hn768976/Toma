import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { useToothAssets, WithToothAssets } from "../assets";
import { StudioEnvironment, type EnvSpec } from "../environment";
import { Backdrop, ContactShadow, Halo, SceneBackdrop, Starfield } from "../parts";
import { Stage, cwave, useLoop, usePxScale, wave } from "../stage";
import { useHexMaterial, useRingsMaterial } from "../shaders/materials";

/**
 * Version 03 - "Enamel Shield".
 *
 * A bright, soft-focus scene where a honeycomb shield gathers around the tooth,
 * collapses onto it as a protective coat and then dissolves. The shield is the
 * same shader twice: once on a sphere, once on an inflated copy of the tooth,
 * cross-faded between the two phases.
 */

const AIRY_STUDIO: EnvSpec = {
  top: "#ffffff",
  horizon: "#dbeefc",
  bottom: "#8fa9bd",
  lights: [
    { azimuth: 30, elevation: 55, size: 52, color: "#ffffff", intensity: 3.2 },
    { azimuth: 210, elevation: 20, size: 66, color: "#dcf0ff", intensity: 1.5 },
    { azimuth: 120, elevation: 75, size: 40, color: "#ffffff", intensity: 1.2 },
  ],
};

/** 0 before `from`, 1 after `to`, smooth in between. */
const seg = (t: number, from: number, to: number) =>
  THREE.MathUtils.smoothstep(t, from, to);

const Scene: React.FC = () => {
  const { t } = useLoop();
  const px = usePxScale();
  const { full } = useToothAssets();

  // Gather -> collapse -> coat -> dissolve. Both ends are "no shield", which is
  // what lets the clip loop.
  const gather = seg(t, 0.16, 0.3) * (1 - seg(t, 0.38, 0.47));
  const coat = seg(t, 0.4, 0.5) * (1 - seg(t, 0.72, 0.86));
  const sphereScale = THREE.MathUtils.lerp(1.78, 1.16, seg(t, 0.18, 0.47));

  const sphereHex = useHexMaterial({
    toneMapped: false,
    uColor: "#f2fbff",
    uRimColor: "#ffffff",
    uScale: 5.2,
    uThickness: 0.085,
    uFill: 0.05,
    uOpacity: 0.95 * gather,
    uReveal: 1,
    uRevealAxis: 9,
    uTriplanar: 1,
    uPx: px,
  });

  const coatHex = useHexMaterial({
    toneMapped: false,
    uColor: "#ffffff",
    uRimColor: "#ffffff",
    uScale: 13,
    uThickness: 0.11,
    uFill: 0.06,
    uOpacity: 1,
    uReveal: coat,
    // The coat grows upward from the roots as it forms and retreats as it goes.
    uRevealAxis: THREE.MathUtils.lerp(-1.3, 1.6, seg(t, 0.42, 0.56)),
    uTriplanar: 1,
    uPx: px,
  });

  const rings = useRingsMaterial({
    toneMapped: false,
    uColor: "#ffffff",
    uTime: t,
    uCount: 1.25,
    uSpeed: 3,
    uOpacity: 0.22,
    uInner: 0.5,
    uOuter: 3.5,
  });

  return (
    <>
      <SceneBackdrop
        colors={["#ffffff", "#eef7fd", "#cfe3f2", "#a9c6dd"]}
        stops={[0, 0.28, 0.58, 1]}
        center={[0.5, 0.62]}
        radius={[0.9, 0.8]}
      />
      <StudioEnvironment spec={AIRY_STUDIO} intensity={1.15} />
      <directionalLight position={[3, 6, 5]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={0.6} color="#cfe6ff" />

      <Halo color="#ffffff" size={5.6} opacity={0.5} power={2.2} position={[0, 0.15, -1.8]} />

      {/* Ripple rings on the floor, seen in perspective. */}
      <mesh material={rings} rotation-x={-Math.PI / 2} position-y={-1.28}>
        <planeGeometry args={[8.5, 8.5]} />
      </mesh>
      <ContactShadow y={-1.25} radius={1.5} squash={0.55} opacity={0.14} power={2.2} />

      <Starfield count={150} seed={31} spread={[9, 5, 5]} color="#ffffff" size={9} opacity={0.5} />

      <group rotation-y={t * Math.PI * 2} position-y={0.06 + wave(t, 1) * 0.045}>
        <mesh geometry={full}>
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.26}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={1.15}
            sheen={0.4}
            sheenColor="#dceeff"
          />
        </mesh>
        {coat > 0.001 ? (
          <mesh geometry={full} material={coatHex} scale={1.03} />
        ) : null}
        {gather > 0.001 ? (
          <mesh material={sphereHex} scale={sphereScale}>
            <sphereGeometry args={[1, 64, 44]} />
          </mesh>
        ) : null}
      </group>
    </>
  );
};

export const V03EnamelShield: React.FC = () => {
  const { t } = useLoop();
  // A slow breathing push, so the camera drifts like the reference without
  // breaking the loop.
  const z = 6.5 - cwave(t, 1) * 0.35 + 0.35;
  return (
    <AbsoluteFill style={{ backgroundColor: "#cfe4f3" }}>
      <WithToothAssets>
        <Stage
          fov={32}
          position={[0, 0, z]}
          toneMapping={THREE.ACESFilmicToneMapping}
          exposure={1.05}
        >
          <Scene />
        </Stage>
      </WithToothAssets>
      <Backdrop
        background="radial-gradient(60% 55% at 50% 42%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)"
        blend="screen"
      />
    </AbsoluteFill>
  );
};
