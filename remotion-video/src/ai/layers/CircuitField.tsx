// Renders a generated PCB trace field, with energy pulses running down each
// run and round pads at the ends.
//
// The pulse is computed per-vertex from distance-along-run, so a single draw
// call animates every trace independently without touching a buffer per frame.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { generateTraces, toRibbons, TraceField, TraceOptions } from "../circuitTraces";
import { toRgb } from "../palette";

export type CircuitFieldProps = Partial<TraceOptions> & {
  /** Use a pre-built field (e.g. chevrons) instead of generating traces. */
  field?: TraceField;
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
  /** Fades the field out beyond this radius, in world units. 0 disables.
   * Left at 0 for the board backgrounds: the reference boards run at full
   * strength into all four corners, and any radial falloff here reads as a
   * vignette. */
  falloffRadius?: number;
  /**
   * Radius, in world units, kept clear of traces at the centre of the field.
   * The reference boards seat the hero in a dark well rather than letting
   * copper run straight across it; without this the board and the hero
   * compete for the same pixels and neither reads.
   */
  clearRadius?: number;
  /** Trace width in world units. This is why traces are ribbons, not lines. */
  traceWidth?: number;
  /** Cross-ribbon falloff exponent. Lower is a flatter, more solid trace. */
  softness?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Per-axis scale; [-1, 1, 1] mirrors the field across X. */
  scale?: [number, number, number];
  showPads?: boolean;
  padSize?: number;
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPulseLength;
  uniform float uFalloff;
  uniform float uClear;
  attribute float aDist;
  attribute float aLen;
  attribute float aId;
  attribute float aSide;
  varying float vPulse;
  varying float vFalloff;
  varying float vSide;

  void main() {
    // Each run gets its own phase offset so the board does not strobe in sync.
    float head = fract(uTime * uSpeed + aId * 7.31) * (aLen + uPulseLength * 2.0)
               - uPulseLength;
    float d = (aDist - head) / max(uPulseLength, 0.0001);
    vPulse = exp(-d * d * 2.5);
    vSide = aSide;

    vec4 world = modelMatrix * vec4(position, 1.0);
    float r = length(world.xy);
    vFalloff = uFalloff > 0.0
      ? 1.0 - smoothstep(uFalloff * 0.35, uFalloff, r)
      : 1.0;
    if (uClear > 0.0) {
      vFalloff *= smoothstep(uClear * 0.6, uClear, r);
    }

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
  uniform float uSoftness;
  varying float vPulse;
  varying float vFalloff;
  varying float vSide;

  void main() {
    // Cross-ribbon profile: a bright core that falls away to the edges, so a
    // trace reads as lit copper rather than a flat rectangle.
    float acrossEdge = 1.0 - abs(vSide);
    float core = pow(clamp(acrossEdge, 0.0, 1.0), uSoftness);

    float energy = (uBase + vPulse * uPulse) * core;
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
  clearRadius = 0,
  traceWidth = 0.02,
  softness = 0.55,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  showPads = true,
  field,
  padSize = 40,
  ...traceOptions
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { lines, padGeometry } = useMemo(() => {
    const built =
      field ??
      generateTraces({
        ...traceOptions,
        count: traceOptions.count ?? 100,
        width: traceOptions.width ?? 6,
        height: traceOptions.height ?? 4,
      });
    const ribbons = toRibbons(built, traceWidth);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(ribbons.positions, 3));
    g.setAttribute("aDist", new THREE.BufferAttribute(ribbons.distances, 1));
    g.setAttribute("aLen", new THREE.BufferAttribute(ribbons.lengths, 1));
    g.setAttribute("aId", new THREE.BufferAttribute(ribbons.ids, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(ribbons.sides, 1));
    g.setIndex(new THREE.BufferAttribute(ribbons.indices, 1));
    const p = new THREE.BufferGeometry();
    p.setAttribute("position", new THREE.BufferAttribute(built.pads, 3));
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
    field,
    traceWidth,
  ]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        // Ribbon quads wind away from camera, and V08 mirrors its field with a
        // negative scale which flips the winding again - front-face culling
        // would drop the whole board in both cases.
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 0.18 },
          uPulseLength: { value: 0.5 },
          uFalloff: { value: 0 },
          uClear: { value: 0 },
          uColour: { value: new THREE.Vector3() },
          uPulseColour: { value: new THREE.Vector3() },
          uBase: { value: 0.16 },
          uPulse: { value: 1.1 },
          uOpacity: { value: 1 },
          uSoftness: { value: 0.55 },
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
  u.uClear.value = clearRadius;
  u.uColour.value.set(...toRgb(colour));
  u.uPulseColour.value.set(...toRgb(pulseColour));
  u.uBase.value = base;
  u.uPulse.value = pulse;
  u.uOpacity.value = opacity;
  u.uSoftness.value = softness;

  const pu = padMaterial.uniforms;
  pu.uSize.value = padSize;
  pu.uColour.value.set(...toRgb(colour));
  pu.uOpacity.value = opacity * 0.9;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={lines} material={material} frustumCulled={false} />
      {showPads && padGeometry.attributes.position.count > 0 ? (
        <points geometry={padGeometry} material={padMaterial} frustumCulled={false} />
      ) : null}
    </group>
  );
};
