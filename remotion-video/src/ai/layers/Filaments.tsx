// Radiating neural filaments.
//
// One reference reads as diffusion-tractography: thousands of fine fibres
// sweeping out of a hot core. The curves are generated once from a seeded walk
// that turns gradually rather than randomly per step - a per-step random
// direction gives noise, while integrating a slowly-rotating heading gives
// something that actually looks like a fibre bundle.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { toRgb } from "../palette";
import { makeRng, range } from "../rng";

export type FilamentsProps = {
  count?: number;
  /** Points per fibre. */
  segments?: number;
  /** Radius the fibres start from. */
  innerRadius?: number;
  /** Radius they reach by the end of the walk. */
  outerRadius?: number;
  /** Vertical squash, so the bundle reads as an ellipse rather than a disc. */
  squash?: number;
  /** Depth spread. */
  depth?: number;
  /** How sharply each fibre curves, in radians per step. */
  curl?: number;
  colour: string;
  tipColour?: string;
  brightness?: number;
  /** Speed of the energy running outward along the fibres. */
  flowSpeed?: number;
  opacity?: number;
  seed?: number;
  position?: [number, number, number];
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  attribute float aT;     // 0 at the core, 1 at the tip
  attribute float aId;
  varying float vT;
  varying float vFlow;
  void main() {
    vT = aT;
    // Energy travelling out along the fibre, de-phased per fibre.
    float head = fract(uTime * uFlowSpeed + aId * 3.77);
    float d = aT - head;
    vFlow = exp(-d * d * 90.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform vec3  uTipColour;
  uniform float uBrightness;
  uniform float uOpacity;
  varying float vT;
  varying float vFlow;
  void main() {
    // Hot at the core, tapering to nothing at the tip.
    float taper = pow(1.0 - vT, 1.4);
    float energy = (taper * 0.7 + vFlow * 0.9) * uBrightness;
    vec3 colour = mix(uColour, uTipColour, clamp(vFlow, 0.0, 1.0));
    float alpha = clamp(energy, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(colour * energy * uOpacity, alpha);
  }
`;

export const Filaments: React.FC<FilamentsProps> = ({
  count = 320,
  segments = 22,
  innerRadius = 0.15,
  outerRadius = 2.6,
  squash = 0.8,
  depth = 0.5,
  curl = 0.22,
  colour,
  tipColour,
  brightness = 1,
  flowSpeed = 0.22,
  opacity = 1,
  seed = 31,
  position = [0, 0, 0],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const geometry = useMemo(() => {
    const rng = makeRng(seed);
    const pos: number[] = [];
    const ts: number[] = [];
    const ids: number[] = [];

    for (let f = 0; f < count; f++) {
      const id = f / Math.max(1, count - 1);
      let angle = rng() * Math.PI * 2;
      // Signed turn rate held for the whole fibre: this is what makes it sweep
      // in one direction instead of jittering.
      const turn = range(rng, -curl, curl);
      const reach = range(rng, 0.55, 1) * outerRadius;
      const z0 = range(rng, -depth, depth);
      const wobble = range(rng, 0.6, 1.4);

      const pts: [number, number, number][] = [];
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        angle += turn * (0.4 + t);
        const r = innerRadius + (reach - innerRadius) * Math.pow(t, 0.78);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r * squash;
        const z = z0 * (1 - t * 0.5) + Math.sin(t * 6.2 * wobble) * depth * 0.25;
        pts.push([x, y, z]);
      }

      for (let s = 1; s < pts.length; s++) {
        const a = pts[s - 1];
        const b = pts[s];
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        ts.push((s - 1) / segments, s / segments);
        ids.push(id, id);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(ts), 1));
    g.setAttribute("aId", new THREE.BufferAttribute(new Float32Array(ids), 1));
    return g;
  }, [count, segments, innerRadius, outerRadius, squash, depth, curl, seed]);

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
          uFlowSpeed: { value: 0.22 },
          uColour: { value: new THREE.Vector3() },
          uTipColour: { value: new THREE.Vector3() },
          uBrightness: { value: 1 },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uTime.value = frame / fps;
  u.uFlowSpeed.value = flowSpeed;
  u.uColour.value.set(...toRgb(colour));
  u.uTipColour.value.set(...toRgb(tipColour ?? colour));
  u.uBrightness.value = brightness;
  u.uOpacity.value = opacity;

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      position={position}
      frustumCulled={false}
    />
  );
};
