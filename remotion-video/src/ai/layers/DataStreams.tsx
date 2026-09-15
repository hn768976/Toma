// Horizontal light streaks travelling across the frame.
//
// Several references run bright dashes left-to-right behind the hero to sell
// "data moving". Each streak is one line segment whose X offset is computed in
// the vertex shader and wrapped, so the whole field is a single draw call with
// no per-frame buffer writes, and each streak fades from a bright head to a
// dark tail rather than being a uniform dash.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { toRgb } from "../palette";
import { makeRng, range } from "../rng";

export type DataStreamsProps = {
  count?: number;
  /** Total width streaks wrap across. */
  span?: number;
  /** Vertical half-extent streaks are scattered through. */
  height?: number;
  /** Depth half-extent. */
  depth?: number;
  colour: string;
  /** Units per second. Negative sends them right-to-left. */
  speed?: number;
  /** Streak length range, in world units. */
  lengthRange?: [number, number];
  opacity?: number;
  /** Vertical band, in world units, kept clear around y=0. 0 disables. */
  clearBand?: number;
  seed?: number;
  position?: [number, number, number];
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpan;
  uniform float uSpeed;
  attribute float aT;       // -0.5 at the tail, +0.5 at the head
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aLen;
  attribute float aBright;
  varying float vFade;

  void main() {
    float span = uSpan;
    float x = mod(uTime * uSpeed * aSpeed + aPhase * span, span) - span * 0.5;
    vec3 p = vec3(x + aT * aLen, position.y, position.z);
    // Bright at the leading end, falling away behind it.
    vFade = smoothstep(-0.5, 0.5, aT) * aBright;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float alpha = vFade * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColour * alpha, alpha);
  }
`;

export const DataStreams: React.FC<DataStreamsProps> = ({
  count = 120,
  span = 18,
  height = 4.5,
  depth = 4,
  colour,
  speed = 1.6,
  lengthRange = [0.4, 2.4],
  opacity = 0.75,
  clearBand = 0,
  seed = 23,
  position = [0, 0, 0],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const geometry = useMemo(() => {
    const rng = makeRng(seed);
    const pos: number[] = [];
    const t: number[] = [];
    const phase: number[] = [];
    const spd: number[] = [];
    const len: number[] = [];
    const bright: number[] = [];

    for (let i = 0; i < count; i++) {
      let y = range(rng, -height, height);
      if (clearBand > 0) {
        // Push streaks out of the centre band so they never cross the hero.
        const sign = y < 0 ? -1 : 1;
        y = sign * (clearBand + Math.abs(y) * (1 - clearBand / height));
      }
      const z = range(rng, -depth, depth);
      const l = range(rng, lengthRange[0], lengthRange[1]);
      const p = rng();
      const s = range(rng, 0.55, 1.6);
      const b = range(rng, 0.25, 1);
      for (const end of [-0.5, 0.5]) {
        pos.push(0, y, z);
        t.push(end);
        phase.push(p);
        spd.push(s);
        len.push(l);
        bright.push(b);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(t), 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(phase), 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(new Float32Array(spd), 1));
    g.setAttribute("aLen", new THREE.BufferAttribute(new Float32Array(len), 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(bright), 1));
    return g;
  }, [count, span, height, depth, lengthRange, clearBand, seed]);

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
          uSpan: { value: 18 },
          uSpeed: { value: 1.6 },
          uColour: { value: new THREE.Vector3() },
          uOpacity: { value: 0.75 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uTime.value = frame / fps;
  u.uSpan.value = span;
  u.uSpeed.value = speed;
  u.uColour.value.set(...toRgb(colour));
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
