// The shared hero: the neural-circuitry panel, shaded by the hero shader.
//
// All nine versions mount this same component and differ only in the uniforms
// and transform they feed it, which is what keeps the set feeling like one
// family rather than nine unrelated clips.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Palette, toRgb } from "../palette";
import { HERO_FRAGMENT, HERO_VERTEX } from "../shaders/hero";

export type HeroCircuitryProps = {
  /** Parsed hero geometry, supplied by NeuralCanvas. */
  geometry: THREE.BufferGeometry;
  palette: Palette;
  /** Overall emissive gain. 1 is the neutral look. */
  glow?: number;
  /** 0 hides the panel, 1 shows it fully; wipes in radially from the centre. */
  reveal?: number;
  /** Local-space Y of the scan sweep. Park it outside +/-1.4 to hide it. */
  scanY?: number;
  scanGain?: number;
  /** Strength of the energy pulse travelling up the traces. */
  pulse?: number;
  /** Extra heat at the centre of the panel. */
  coreHeat?: number;
  /** How strongly the flat tops of the traces are lit, vs. only their walls. */
  fill?: number;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  /** Set false to draw the panel with normal alpha instead of additive. */
  additive?: boolean;
};

export const HeroCircuitry: React.FC<HeroCircuitryProps> = ({
  geometry,
  palette,
  glow = 1,
  reveal = 1,
  scanY = 99,
  scanGain = 0,
  pulse = 0.6,
  coreHeat = 0.35,
  fill = 0.3,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  additive = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HERO_VERTEX,
        fragmentShader: HERO_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uPrimary: { value: new THREE.Vector3() },
          uAccent: { value: new THREE.Vector3() },
          uCore: { value: new THREE.Vector3() },
          uTime: { value: 0 },
          uGlow: { value: 1 },
          uReveal: { value: 1 },
          uScan: { value: 99 },
          uScanGain: { value: 0 },
          uPulse: { value: 0.6 },
          uCoreHeat: { value: 0.35 },
          uFill: { value: 0.3 },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  // Uniforms are written straight from the Remotion frame rather than from a
  // useFrame clock, so every frame is reproducible on its own.
  const u = material.uniforms;
  u.uPrimary.value.set(...toRgb(palette.primary));
  u.uAccent.value.set(...toRgb(palette.accent));
  u.uCore.value.set(...toRgb(palette.core));
  u.uTime.value = frame / fps;
  u.uGlow.value = glow;
  u.uReveal.value = reveal;
  u.uScan.value = scanY;
  u.uScanGain.value = scanGain;
  u.uPulse.value = pulse;
  u.uCoreHeat.value = coreHeat;
  u.uFill.value = fill;
  u.uOpacity.value = opacity;
  material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
};
