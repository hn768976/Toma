// Particles that condense out of a scattered ring into the circuitry itself.
//
// The targets are sampled from the hero GLB's own vertices, so the swarm
// resolves into the real board layout rather than an approximation of it - the
// moment the particles land, they *are* the artwork. Each particle interpolates
// from its scatter position to its target along an arc, staggered so the shape
// fills in from the centre outward instead of snapping into place at once.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { toRgb } from "../palette";
import { makeRng, range } from "../rng";
import { sampleSurfacePoints } from "../useGlb";

export type AssemblySwarmProps = {
  geometry: THREE.BufferGeometry;
  count?: number;
  /** 0 fully scattered, 1 fully assembled. */
  assembly: number;
  colour: string;
  /** Colour while still in flight, blended toward `colour` on arrival. */
  flightColour?: string;
  /** Radius of the ring particles start on. */
  scatterRadius?: number;
  /** Depth spread of the scatter. */
  scatterDepth?: number;
  size?: number;
  opacity?: number;
  /** How much of the timeline is spent staggering starts. 0 = all together. */
  stagger?: number;
  seed?: number;
  scale?: number;
  position?: [number, number, number];
};

const VERT = /* glsl */ `
  uniform float uAssembly;
  uniform float uStagger;
  uniform float uSize;
  uniform float uTime;
  attribute vec3  aTarget;
  attribute float aDelay;
  attribute float aPhase;
  varying float vArrived;

  void main() {
    // Per-particle window inside the global assembly progress.
    float span = max(1.0 - uStagger, 0.05);
    float t = clamp((uAssembly - aDelay * uStagger) / span, 0.0, 1.0);
    // Ease out: fast departure, gentle landing.
    float e = 1.0 - pow(1.0 - t, 3.0);

    vec3 from = position;
    vec3 to = aTarget;
    vec3 p = mix(from, to, e);

    // Bow the path outward at the midpoint so particles sweep in rather than
    // travelling in dead-straight lines.
    float arc = sin(e * 3.14159);
    p.z += arc * 0.45 * sin(aPhase * 6.283);
    p.xy += arc * 0.18 * vec2(cos(aPhase * 6.283), sin(aPhase * 12.566));

    // Idle drift, strongest before the particle has settled.
    p.xy += (1.0 - e) * 0.06 * vec2(
      sin(uTime * 0.9 + aPhase * 8.0),
      cos(uTime * 0.7 + aPhase * 5.0)
    );

    vArrived = e;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Particles shrink as they land, so the assembled board reads as fine
    // detail rather than a cloud of fat dots.
    gl_PointSize = uSize * mix(1.35, 0.55, e) * (1.0 / max(-mv.z, 0.001));
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform vec3  uFlightColour;
  uniform float uOpacity;
  varying float vArrived;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, r);
    a *= a;
    vec3 colour = mix(uFlightColour, uColour, vArrived);
    // Brighter in flight; the landed state is carried by the hero mesh itself.
    float energy = mix(1.15, 0.8, vArrived);
    float alpha = a * uOpacity * energy;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;

export const AssemblySwarm: React.FC<AssemblySwarmProps> = ({
  geometry,
  count = 6000,
  assembly,
  colour,
  flightColour,
  scatterRadius = 3.4,
  scatterDepth = 2.2,
  size = 130,
  opacity = 1,
  stagger = 0.45,
  seed = 41,
  scale = 1,
  position = [0, 0, 0],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const points = useMemo(() => {
    const targets = sampleSurfacePoints(geometry, count, seed);
    const rng = makeRng(seed + 991);
    const start = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const phase = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Scatter onto a ring rather than a ball: the reference opens on an
      // annulus of particles, and a ring also keeps the centre clear so the
      // shape reads as it fills in.
      const angle = rng() * Math.PI * 2;
      const radius = scatterRadius * range(rng, 0.75, 1.25);
      start[i * 3] = Math.cos(angle) * radius;
      start[i * 3 + 1] = Math.sin(angle) * radius * 0.85;
      start[i * 3 + 2] = range(rng, -scatterDepth, scatterDepth);

      // Stagger by distance from centre, so the board fills outward, with a
      // little jitter so the boundary is not a clean expanding circle.
      const tx = targets[i * 3];
      const ty = targets[i * 3 + 1];
      const d = Math.min(1, Math.hypot(tx, ty) / 1.3);
      delay[i] = Math.min(1, d * 0.8 + rng() * 0.3);
      phase[i] = rng();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
    g.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, [geometry, count, scatterRadius, scatterDepth, seed]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uAssembly: { value: 0 },
          uStagger: { value: 0.45 },
          uSize: { value: 130 },
          uTime: { value: 0 },
          uColour: { value: new THREE.Vector3() },
          uFlightColour: { value: new THREE.Vector3() },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uAssembly.value = assembly;
  u.uStagger.value = stagger;
  u.uSize.value = size;
  u.uTime.value = frame / fps;
  u.uColour.value.set(...toRgb(colour));
  u.uFlightColour.value.set(...toRgb(flightColour ?? colour));
  u.uOpacity.value = opacity;

  return (
    <points
      geometry={points}
      material={material}
      position={position}
      scale={scale}
      frustumCulled={false}
    />
  );
};
