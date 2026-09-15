// Renders a generated PCB trace field, with energy pulses running down each
// run and round pads at the ends.
//
// The pulse is computed per-vertex from distance-along-run, so a single draw
// call animates every trace independently without touching a buffer per frame.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { generateTraces, TraceOptions } from "../circuitTraces";
import { toRgb } from "../palette";

export type CircuitFieldProps = TraceOptions & {
  /** Resting colour of the copper. */
  colour: string;
  /** Colour of the energy travelling along a run. */
  pulseColour: string;
  /** Base brightness of an idle trace. */
  base?: number;
  /** Brightness of the pulse head. */
  pulse?: number;
  /** Runs traversed per second. */
  speed?: number;
  /** Length of the pulse head, in world units. */
  pulseLength?: number;
  opacity?: number;
  /** Fades the field out beyond this radius, in world units. 0 disables. */
  falloffRadius?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  showPads?: boolean;
  padSize?: number;
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPulseLength;
  uniform float uFalloff;
  attribute float aDist;
  attribute float aLen;
  attribute float aId;
  varying float vPulse;
  varying float vFalloff;

  void main() {
    // Each run gets its own phase offset so the board does not strobe in sync.
    float head = fract(uTime * uSpeed + aId * 7.31) * (aLen + uPulseLength * 2.0)
               - uPulseLength;
    float d = (aDist - head) / max(uPulseLength, 0.0001);
    vPulse = exp(-d * d * 2.5);

    vec4 world = modelMatrix * vec4(position, 1.0);
    vFalloff = uFalloff > 0.0
      ? 1.0 - smoothstep(uFalloff * 0.35, uFalloff, length(world.xy))
      : 1.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform vec3  uPulseColour;
  uniform float uBase;
  uniform float uPulse;
  uniform float uOpacity;
  varying float vPulse;
  varying float vFalloff;

  void main() {
    float energy = uBase + vPulse * uPulse;
    vec3 colour = mix(uColour, uPulseColour, clamp(vPulse, 0.0, 1.0));
    float alpha = clamp(energy, 0.0, 1.0) * uOpacity * vFalloff;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(colour * energy * vFalloff, alpha);
  }
`;

const PAD_VERT = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (1.0 / max(-mv.z, 0.001));
  }
`;

const PAD_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform float uOpacity;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    // Ring, not a disc: real pads read as an annulus with a drilled centre.
    float ring = smoothstep(0.45, 0.62, r) * (1.0 - smoothstep(0.82, 1.0, r));
    float alpha = ring * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * alpha, alpha);
  }
`;

export const CircuitField: React.FC<CircuitFieldProps> = ({
  colour,
  pulseColour,
  base = 0.16,
  pulse = 1.1,
  speed = 0.18,
  pulseLength = 0.5,
  opacity = 1,
  falloffRadius = 0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  showPads = true,
  padSize = 40,
  ...traceOptions
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { lines, padGeometry } = useMemo(() => {
    const field = generateTraces(traceOptions);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(field.positions, 3));
    g.setAttribute("aDist", new THREE.BufferAttribute(field.distances, 1));
    g.setAttribute("aLen", new THREE.BufferAttribute(field.lengths, 1));
    g.setAttribute("aId", new THREE.BufferAttribute(field.ids, 1));
    const p = new THREE.BufferGeometry();
    p.setAttribute("position", new THREE.BufferAttribute(field.pads, 3));
    return { lines: g, padGeometry: p };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    traceOptions.count,
    traceOptions.width,
    traceOptions.height,
    traceOptions.pitch,
    traceOptions.steps,
    traceOptions.horizontalBias,
    traceOptions.diagonalChance,
    traceOptions.padChance,
    traceOptions.seed,
  ]);

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
          uSpeed: { value: 0.18 },
          uPulseLength: { value: 0.5 },
          uFalloff: { value: 0 },
          uColour: { value: new THREE.Vector3() },
          uPulseColour: { value: new THREE.Vector3() },
          uBase: { value: 0.16 },
          uPulse: { value: 1.1 },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  const padMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PAD_VERT,
        fragmentShader: PAD_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uSize: { value: 40 },
          uColour: { value: new THREE.Vector3() },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  const t = frame / fps;
  const u = material.uniforms;
  u.uTime.value = t;
  u.uSpeed.value = speed;
  u.uPulseLength.value = pulseLength;
  u.uFalloff.value = falloffRadius;
  u.uColour.value.set(...toRgb(colour));
  u.uPulseColour.value.set(...toRgb(pulseColour));
  u.uBase.value = base;
  u.uPulse.value = pulse;
  u.uOpacity.value = opacity;

  const pu = padMaterial.uniforms;
  pu.uSize.value = padSize;
  pu.uColour.value.set(...toRgb(colour));
  pu.uOpacity.value = opacity * 0.9;

  return (
    <group position={position} rotation={rotation}>
      <lineSegments geometry={lines} material={material} frustumCulled={false} />
      {showPads && padGeometry.attributes.position.count > 0 ? (
        <points geometry={padGeometry} material={padMaterial} frustumCulled={false} />
      ) : null}
    </group>
  );
};
