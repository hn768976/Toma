// Concentric HUD rings.
//
// Drawn analytically in one fragment shader on a single quad rather than as
// ring geometry: an arc's ends, its tick marks and its soft edges are all just
// smoothsteps on radius and angle, which stays crisp at 4K where a tessellated
// ring would show facets. Tilting the quad in 3D gives the elliptical
// foreshortening the references have, for free.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { toRgb } from "../palette";

export type Ring = {
  /** Radius in world units. */
  radius: number;
  /** Stroke width in world units. */
  width: number;
  /** Where the arc starts, in turns (0..1). */
  arcStart?: number;
  /** How much of the circle the arc covers, in turns. 1 is a full ring. */
  arcLength?: number;
  /** Turns per second; sign sets direction. */
  spin?: number;
  brightness?: number;
  /** Number of tick marks around the ring. 0 draws a solid stroke. */
  ticks?: number;
  /** Fraction of each tick cell that is drawn. */
  tickDuty?: number;
};

export type HaloRingsProps = {
  rings: Ring[];
  colour: string;
  /** Half-size of the quad the rings are drawn on. Must exceed the radii. */
  extent: number;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Uniform scale, for reticles that close in on their target. */
  scale?: number;
};

const MAX_RINGS = 8;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  #define MAX_RINGS ${MAX_RINGS}

  uniform vec4  uRingA[MAX_RINGS];  // radius, width, arcStart, arcLength
  uniform vec4  uRingB[MAX_RINGS];  // spin, brightness, ticks, tickDuty
  uniform vec3  uColour;
  uniform float uExtent;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  const float TAU = 6.283185307;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uExtent;
    float r = length(p);
    // atan returns -PI..PI; shift to 0..1 turns so arcs are easy to express.
    float turn = atan(p.y, p.x) / TAU + 0.5;

    float energy = 0.0;

    for (int i = 0; i < MAX_RINGS; i++) {
      vec4 a = uRingA[i];
      vec4 b = uRingB[i];
      float brightness = b.y;
      if (brightness <= 0.0) continue;

      // Radial stroke, softened by roughly a pixel's worth of world units.
      float band = 1.0 - smoothstep(0.0, a.y, abs(r - a.x));
      if (band <= 0.0) continue;

      float spun = fract(turn - uTime * b.x);
      float arcStart = fract(a.z);
      float arcLen = clamp(a.w, 0.0, 1.0);
      float rel = fract(spun - arcStart);
      // Feather the arc ends so they do not chatter as the ring rotates.
      float arc = arcLen >= 1.0
        ? 1.0
        : smoothstep(0.0, 0.01, rel) * (1.0 - smoothstep(arcLen - 0.01, arcLen, rel));

      float tick = 1.0;
      if (b.z > 0.5) {
        float cell = fract(spun * b.z);
        tick = 1.0 - smoothstep(b.w, b.w + 0.12, cell);
      }

      energy += band * arc * tick * brightness;
    }

    float alpha = clamp(energy, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * energy * uOpacity, alpha);
  }
`;

export const HaloRings: React.FC<HaloRingsProps> = ({
  rings,
  colour,
  extent,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const material = useMemo(() => {
    const a: THREE.Vector4[] = [];
    const b: THREE.Vector4[] = [];
    for (let i = 0; i < MAX_RINGS; i++) {
      a.push(new THREE.Vector4());
      b.push(new THREE.Vector4());
    }
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uRingA: { value: a },
        uRingB: { value: b },
        uColour: { value: new THREE.Vector3() },
        uExtent: { value: 1 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
      },
    });
  }, []);

  const u = material.uniforms;
  const a = u.uRingA.value as THREE.Vector4[];
  const b = u.uRingB.value as THREE.Vector4[];
  for (let i = 0; i < MAX_RINGS; i++) {
    const ring = rings[i];
    if (ring) {
      a[i].set(
        ring.radius,
        ring.width,
        ring.arcStart ?? 0,
        ring.arcLength ?? 1,
      );
      b[i].set(
        ring.spin ?? 0,
        ring.brightness ?? 1,
        ring.ticks ?? 0,
        ring.tickDuty ?? 0.5,
      );
    } else {
      // brightness 0 switches the slot off inside the shader loop.
      a[i].set(0, 0, 0, 0);
      b[i].set(0, 0, 0, 0);
    }
  }
  u.uColour.value.set(...toRgb(colour));
  u.uExtent.value = extent;
  u.uTime.value = frame / fps;
  u.uOpacity.value = opacity;

  return (
    <mesh
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      frustumCulled={false}
    >
      <planeGeometry args={[extent * 2, extent * 2]} />
    </mesh>
  );
};
