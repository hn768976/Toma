// Ambient particle haze.
//
// Every reference has a slow field of bright motes drifting through the depth
// of frame; without it the hero reads as a flat graphic pasted on a gradient
// rather than an object sitting in space. Points are scattered from a seeded
// RNG so the field is identical on every frame of the render, and drift is
// computed in the shader from a single time uniform rather than by rewriting
// the position buffer each frame.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { makeRng, range } from "../rng";
import { toRgb } from "../palette";

export type ParticleFieldProps = {
  count?: number;
  /** Half-extents of the box the particles are scattered through. */
  bounds?: [number, number, number];
  colour: string;
  /** Point size in pixels at unit distance. */
  size?: number;
  opacity?: number;
  /** Units per second of upward drift. */
  rise?: number;
  /** Amplitude of the lateral sway. */
  sway?: number;
  /** 0 disables twinkle, 1 fully modulates brightness. */
  twinkle?: number;
  seed?: number;
  position?: [number, number, number];
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uRise;
  uniform float uSway;
  uniform float uTwinkle;
  uniform vec3  uBounds;
  attribute float aPhase;
  attribute float aScale;
  varying float vFade;

  void main() {
    vec3 p = position;

    // Rise and wrap inside the box, so the field never empties out.
    float span = uBounds.y * 2.0;
    p.y = mod(p.y + uTime * uRise + uBounds.y, span) - uBounds.y;
    p.x += sin(uTime * 0.35 + aPhase * 6.283) * uSway;
    p.z += cos(uTime * 0.27 + aPhase * 6.283) * uSway * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * (1.0 / max(-mv.z, 0.001));

    float tw = mix(1.0, 0.45 + 0.55 * sin(uTime * 1.7 + aPhase * 12.566), uTwinkle);
    // Fade out at the far edge of the box so particles do not pop at the wrap.
    float depthFade = 1.0 - smoothstep(uBounds.z * 0.4, uBounds.z, abs(p.z));
    vFade = tw * depthFade;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    // Round, soft-edged point. gl_PointCoord is 0..1 across the sprite.
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, r));
    a *= a;
    float alpha = a * vFade * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * alpha, alpha);
  }
`;

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 900,
  bounds = [7, 4, 6],
  colour,
  size = 90,
  opacity = 0.7,
  rise = 0.12,
  sway = 0.15,
  twinkle = 0.6,
  seed = 7,
  position = [0, 0, 0],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const [boundsX, boundsY, boundsZ] = bounds;

  const geometry = useMemo(() => {
    const rng = makeRng(seed);
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = range(rng, -boundsX, boundsX);
      pos[i * 3 + 1] = range(rng, -boundsY, boundsY);
      pos[i * 3 + 2] = range(rng, -boundsZ, boundsZ);
      phase[i] = rng();
      // A few noticeably larger motes stop the field reading as uniform noise.
      scale[i] = rng() < 0.08 ? range(rng, 1.8, 3.2) : range(rng, 0.4, 1.1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
    return g;
    // Depend on the numbers, never on the array's identity.
  }, [count, boundsX, boundsY, boundsZ, seed]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: 90 },
          uRise: { value: 0.12 },
          uSway: { value: 0.15 },
          uTwinkle: { value: 0.6 },
          uBounds: { value: new THREE.Vector3() },
          uColour: { value: new THREE.Vector3() },
          uOpacity: { value: 0.7 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uTime.value = frame / fps;
  u.uSize.value = size;
  u.uRise.value = rise;
  u.uSway.value = sway;
  u.uTwinkle.value = twinkle;
  u.uBounds.value.set(bounds[0], bounds[1], bounds[2]);
  u.uColour.value.set(...toRgb(colour));
  u.uOpacity.value = opacity;

  return <points geometry={geometry} material={material} position={position} frustumCulled={false} />;
};
