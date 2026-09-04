import React, { useMemo } from "react";
import * as THREE from "three";
import { SHAFT_COUNT, SHAFT_LAYERS, SPACING_X, SPACING_Z } from "../constants";
import { hexToRgb, type Palette } from "../palette";
import { mulberry32 } from "../random";
import { shaftFragmentShader, shaftVertexShader } from "./shaftShader";

const TWO_PI = Math.PI * 2;

type ShaftDef = {
  x: number;
  z: number;
  width: number;
  height: number;
  intensity: number;
  /** Integer cycles per loop, so the breathing is loop-exact. */
  cycles: number;
  phase: number;
  driftPhase: number;
};

const buildShafts = (seed: number): ShaftDef[] => {
  const rand = mulberry32(seed);
  return Array.from({ length: SHAFT_COUNT }, (_, i) => {
    // Sit in the aisles - offset half a bay from the panel columns.
    const lane = i - (SHAFT_COUNT - 1) / 2;
    return {
      x: lane * SPACING_X * 1.15 + (rand() - 0.5) * SPACING_X * 0.45,
      z: (rand() - 0.5) * SPACING_Z * 5.0,
      width: 1.5 + rand() * 3.4,
      height: 13 + rand() * 5,
      intensity: 0.30 + rand() * 0.42,
      cycles: 1 + Math.floor(rand() * 2),
      phase: rand(),
      driftPhase: rand(),
    };
  });
};

type Props = {
  palette: Palette;
  time: number;
  seed: number;
  /** Camera azimuth in this group's local space, so shafts face the camera. */
  faceYaw: number;
};

export const Shafts: React.FC<Props> = ({ palette, time, seed, faceYaw }) => {
  const shafts = useMemo(() => buildShafts(seed), [seed]);
  const color = useMemo(
    () => new THREE.Vector3(...hexToRgb(palette.shaft)),
    [palette.shaft],
  );

  return (
    <group>
      {shafts.map((s, i) => {
        const breathe =
          0.62 + 0.38 * Math.sin(TWO_PI * (s.cycles * time + s.phase));
        const drift = Math.sin(TWO_PI * (time + s.driftPhase)) * 0.32;

        return (
          <group
            key={i}
            position={[s.x + drift, s.height / 2 - 2.2, s.z]}
            rotation={[0, faceYaw, 0]}
          >
            {/* Stacking a few planes gives the beam some body without a
                volumetric pass; each is offset slightly in depth. */}
            {Array.from({ length: SHAFT_LAYERS }, (_, l) => (
              <mesh key={l} position={[0, 0, (l - 1) * 0.55]} frustumCulled={false}>
                <planeGeometry args={[s.width, s.height]} />
                <shaderMaterial
                  vertexShader={shaftVertexShader}
                  fragmentShader={shaftFragmentShader}
                  uniforms={{
                    uColor: { value: color },
                    uIntensity: { value: 0 },
                    uSoftness: { value: 0 },
                  }}
                  uniforms-uIntensity-value={
                    (s.intensity * breathe) / SHAFT_LAYERS
                  }
                  uniforms-uSoftness-value={2.4 + l * 0.9}
                  transparent
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};
