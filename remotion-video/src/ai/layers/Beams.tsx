// Volumetric-looking light: a projection cone, falling light shafts, and a
// radial flare.
//
// None of these are true volumetrics - that would mean ray-marching a medium,
// which is far too slow under software WebGL. They are camera-facing gradients
// tuned so their falloff reads the way scattered light does: bright and tight
// at the source, widening and softening with distance, and always additive so
// they never occlude what is behind them.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { toRgb } from "../palette";

// ---------------------------------------------------------------- light cone

export type LightConeProps = {
  colour: string;
  /** Radius at the wide (top) end. */
  radius?: number;
  height?: number;
  /** Brightness at the narrow (bottom) end. */
  intensity?: number;
  /** How quickly the beam fades from apex to mouth. */
  falloff?: number;
  opacity?: number;
  position?: [number, number, number];
  /** Rotate to put the apex where the emitter is; [PI,0,0] flips it upright. */
  rotation?: [number, number, number];
};

const CONE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform float uIntensity;
  uniform float uFalloff;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    // uv.y runs 0 at the apex to 1 at the mouth on a three cone.
    float up = pow(1.0 - vUv.y, uFalloff);

    // Edge-on faces of the shell are where a real beam looks densest, so lean
    // into the grazing angle instead of fighting it.
    float graze = pow(1.0 - abs(vNormal.z), 1.5);

    // Slow vertical striations, so the beam breathes rather than sitting still.
    float striation = 0.82 + 0.18 * sin(vUv.x * 42.0 + uTime * 0.6);

    float energy = up * (0.45 + graze * 0.85) * uIntensity * striation;
    float alpha = clamp(energy, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * energy * uOpacity, alpha);
  }
`;

export const LightCone: React.FC<LightConeProps> = ({
  colour,
  radius = 1.3,
  height = 3.2,
  intensity = 0.8,
  falloff = 2.2,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColour: { value: new THREE.Vector3() },
          uIntensity: { value: 0.8 },
          uFalloff: { value: 2.2 },
          uOpacity: { value: 1 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uColour.value.set(...toRgb(colour));
  u.uIntensity.value = intensity;
  u.uFalloff.value = falloff;
  u.uOpacity.value = opacity;
  u.uTime.value = frame / fps;

  return (
    <mesh material={material} position={position} rotation={rotation} frustumCulled={false}>
      {/* Open-ended so the mouth never shows a flat cap. */}
      <coneGeometry args={[radius, height, 48, 1, true]} />
    </mesh>
  );
};

// --------------------------------------------------------------- light shafts

export type LightShaftsProps = {
  colour: string;
  width?: number;
  height?: number;
  /** Number of shafts across the width. */
  count?: number;
  /** Tilt of the shafts, in radians. */
  slant?: number;
  intensity?: number;
  opacity?: number;
  position?: [number, number, number];
};

const SHAFT_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform float uCount;
  uniform float uSlant;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    // Shear x by height so the shafts rake across the frame.
    float x = vUv.x + (vUv.y - 1.0) * uSlant;

    // Sum a few incommensurable frequencies so the shafts do not read as a
    // regular comb; slow phase drift keeps them alive.
    float s = 0.0;
    s += pow(max(0.0, sin(x * uCount * 3.14159 + uTime * 0.11)), 12.0);
    s += pow(max(0.0, sin(x * uCount * 1.93 + 1.7 - uTime * 0.07)), 18.0) * 0.7;
    s += pow(max(0.0, sin(x * uCount * 4.71 + 3.1 + uTime * 0.05)), 26.0) * 0.5;

    // Brightest at the top where the light enters, gone before the floor.
    float vertical = pow(vUv.y, 1.7) * (1.0 - smoothstep(0.75, 1.0, vUv.y) * 0.35);
    float energy = s * vertical * uIntensity;

    float alpha = clamp(energy, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * energy * uOpacity, alpha);
  }
`;

const SHAFT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const LightShafts: React.FC<LightShaftsProps> = ({
  colour,
  width = 14,
  height = 8,
  count = 7,
  slant = 0.18,
  intensity = 0.55,
  opacity = 1,
  position = [0, 1.5, -2],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColour: { value: new THREE.Vector3() },
          uCount: { value: 7 },
          uSlant: { value: 0.18 },
          uIntensity: { value: 0.55 },
          uOpacity: { value: 1 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uColour.value.set(...toRgb(colour));
  u.uCount.value = count;
  u.uSlant.value = slant;
  u.uIntensity.value = intensity;
  u.uOpacity.value = opacity;
  u.uTime.value = frame / fps;

  return (
    <mesh material={material} position={position} frustumCulled={false}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
};

// ---------------------------------------------------------------------- flare

export type FlareProps = {
  colour: string;
  /** Radius of the soft halo. */
  size?: number;
  intensity?: number;
  /** Length of the horizontal streak, relative to size. 0 disables it. */
  streak?: number;
  opacity?: number;
  position?: [number, number, number];
};

const FLARE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform float uIntensity;
  uniform float uStreak;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);

    // Inverse-square-ish core with a soft halo, which is what a small bright
    // source looks like once the lens has had its way with it.
    float core = 1.0 / (1.0 + r * r * 26.0);
    float halo = exp(-r * r * 3.2) * 0.55;
    float energy = (core + halo) * uIntensity;

    if (uStreak > 0.0) {
      float s = exp(-pow(p.y / max(uStreak * 0.14, 1e-4), 2.0))
              * exp(-pow(p.x * 1.15, 2.0));
      energy += s * uIntensity * 0.6;
    }

    float alpha = clamp(energy, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * energy * uOpacity, alpha);
  }
`;

export const Flare: React.FC<FlareProps> = ({
  colour,
  size = 1.2,
  intensity = 1,
  streak = 0,
  opacity = 1,
  position = [0, 0, 0],
}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT,
        fragmentShader: FLARE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColour: { value: new THREE.Vector3() },
          uIntensity: { value: 1 },
          uStreak: { value: 0 },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uColour.value.set(...toRgb(colour));
  u.uIntensity.value = intensity;
  u.uStreak.value = streak;
  u.uOpacity.value = opacity;

  return (
    <mesh material={material} position={position} frustumCulled={false}>
      <planeGeometry args={[size * 2, size * 2]} />
    </mesh>
  );
};
