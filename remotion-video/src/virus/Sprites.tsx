// Soft-edged sprite layers: dust specks, background bokeh discs, and the
// additive rim glow that sits behind each core on look 9.
//
// The bokeh is real sprites rather than blurred geometry — cheaper, and a
// radial falloff gives a softer edge than a depth-of-field pass ever will.

import React, { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { mulberry32, range, pick, intRange } from "./lib/rng";
import { frustumHalfHeight } from "./lib/field";

const SPRITE_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute float aScale;
attribute vec3 aColour;
attribute float aOpacity;

varying vec2 vUv;
varying vec3 vColour;
varying float vOpacity;

void main() {
  vUv = uv;
  vColour = aColour;
  vOpacity = aOpacity;
  // Camera-facing quad: expand in view space so the disc never foreshortens.
  vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
  mv.xy += position.xy * aScale;
  gl_Position = projectionMatrix * mv;
}
`;

const SPRITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vColour;
varying float vOpacity;
uniform float uEdge;

void main() {
  float d = length(vUv - 0.5) * 2.0;
  // uEdge near 1 gives a near-solid disc with a soft rim (bokeh);
  // near 0 gives a gaussian dot (specks, glow).
  float a = 1.0 - smoothstep(uEdge, 1.0, d);
  a *= a;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(vColour, a * vOpacity);
}
`;

interface SpriteDatum {
  base: THREE.Vector3;
  scale: number;
  colour: THREE.Color;
  opacity: number;
  amp: THREE.Vector3;
  freq: THREE.Vector3;
  phase: THREE.Vector3;
}

const useSpriteMaterial = (edge: number, additive: boolean) =>
  useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SPRITE_VERT,
        fragmentShader: SPRITE_FRAG,
        uniforms: { uEdge: { value: edge } },
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
      }),
    [edge, additive],
  );

/**
 * Shared renderer for a drifting sprite layer. Positions are recomputed from
 * `t` every frame; like the particles, the drift uses integer frequencies so
 * every sprite returns exactly to its start at t = 1.
 */
const SpriteLayer: React.FC<{
  data: SpriteDatum[];
  edge: number;
  additive: boolean;
  t: number;
}> = ({ data, edge, additive, t }) => {
  const geoRef = useRef<THREE.InstancedBufferGeometry>(null);
  const material = useSpriteMaterial(edge, additive);

  const attrs = useMemo(() => {
    const n = data.length;
    const offset = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const colour = new Float32Array(n * 3);
    const opacity = new Float32Array(n);
    data.forEach((d, i) => {
      scale[i] = d.scale;
      opacity[i] = d.opacity;
      colour[i * 3] = d.colour.r;
      colour[i * 3 + 1] = d.colour.g;
      colour[i * 3 + 2] = d.colour.b;
    });
    return { offset, scale, colour, opacity, n };
  }, [data]);

  useLayoutEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    const off = attrs.offset;
    const tau = Math.PI * 2;
    data.forEach((d, i) => {
      off[i * 3] = d.base.x + d.amp.x * Math.sin(tau * d.freq.x * t + d.phase.x);
      off[i * 3 + 1] = d.base.y + d.amp.y * Math.sin(tau * d.freq.y * t + d.phase.y);
      off[i * 3 + 2] = d.base.z + d.amp.z * Math.sin(tau * d.freq.z * t + d.phase.z);
    });
    const attr = geo.getAttribute("aOffset") as THREE.BufferAttribute;
    attr.needsUpdate = true;
    geo.instanceCount = attrs.n;
  }, [data, t, attrs]);

  if (attrs.n === 0) return null;

  return (
    <mesh frustumCulled={false} material={material} renderOrder={-500}>
      <instancedBufferGeometry ref={geoRef} instanceCount={attrs.n}>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3]}
        />
        <bufferAttribute
          attach="attributes-uv"
          args={[new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2]}
        />
        <bufferAttribute attach="index" args={[new Uint16Array([0, 1, 2, 0, 2, 3]), 1]} />
        <instancedBufferAttribute attach="attributes-aOffset" args={[attrs.offset, 3]} />
        <instancedBufferAttribute attach="attributes-aScale" args={[attrs.scale, 1]} />
        <instancedBufferAttribute attach="attributes-aColour" args={[attrs.colour, 3]} />
        <instancedBufferAttribute attach="attributes-aOpacity" args={[attrs.opacity, 1]} />
      </instancedBufferGeometry>
    </mesh>
  );
};

export const Specks: React.FC<{
  spec: NonNullable<import("./data/types").LookSpec["specks"]>;
  seed: number;
  cameraZ: number;
  fov: number;
  t: number;
}> = ({ spec, seed, cameraZ, fov, t }) => {
  const data = useMemo(() => {
    const rng = mulberry32(seed ^ 0x5eed_1);
    const out: SpriteDatum[] = [];
    for (let i = 0; i < spec.count; i++) {
      const z = range(rng, -20, 4);
      const halfH = frustumHalfHeight(z, cameraZ, fov) * 1.1;
      const halfW = halfH * (16 / 9);
      // yBand lets a look confine its specks to part of the frame — look 10
      // only has them down in the blue.
      const band = spec.yBand ?? [0, 1];
      const yt = range(rng, band[0], band[1]);
      out.push({
        base: new THREE.Vector3(
          range(rng, -halfW, halfW),
          -halfH + yt * halfH * 2,
          z,
        ),
        scale: range(rng, spec.sizeRange[0], spec.sizeRange[1]),
        colour: new THREE.Color(spec.colour),
        opacity: spec.opacity * range(rng, 0.45, 1),
        amp: new THREE.Vector3(range(rng, 0.1, 0.4), range(rng, 0.1, 0.4), range(rng, 0.05, 0.2)),
        freq: new THREE.Vector3(intRange(rng, 1, 2), intRange(rng, 1, 2), 1),
        phase: new THREE.Vector3(
          range(rng, 0, Math.PI * 2),
          range(rng, 0, Math.PI * 2),
          range(rng, 0, Math.PI * 2),
        ),
      });
    }
    return out;
  }, [spec, seed, cameraZ, fov]);

  return <SpriteLayer data={data} edge={0.0} additive t={t} />;
};

export const BokehDiscs: React.FC<{
  spec: NonNullable<import("./data/types").LookSpec["bokeh"]>;
  seed: number;
  cameraZ: number;
  fov: number;
  t: number;
}> = ({ spec, seed, cameraZ, fov, t }) => {
  const data = useMemo(() => {
    const rng = mulberry32(seed ^ 0x5eed_2);
    const out: SpriteDatum[] = [];
    for (let i = 0; i < spec.count; i++) {
      // Sits behind all geometry; the field starts at about -20.
      const z = range(rng, -30, -21);
      const halfH = frustumHalfHeight(z, cameraZ, fov) * 1.05;
      const halfW = halfH * (16 / 9);
      out.push({
        base: new THREE.Vector3(range(rng, -halfW, halfW), range(rng, -halfH, halfH), z),
        scale: range(rng, spec.sizeRange[0], spec.sizeRange[1]),
        colour: new THREE.Color(pick(rng, spec.colours)),
        opacity: spec.opacity * range(rng, 0.35, 1),
        amp: new THREE.Vector3(range(rng, 0.2, 0.7), range(rng, 0.2, 0.7), 0),
        freq: new THREE.Vector3(intRange(rng, 1, 2), intRange(rng, 1, 2), 1),
        phase: new THREE.Vector3(
          range(rng, 0, Math.PI * 2),
          range(rng, 0, Math.PI * 2),
          0,
        ),
      });
    }
    return out;
  }, [spec, seed, cameraZ, fov]);

  return <SpriteLayer data={data} edge={0.55} additive={false} t={t} />;
};
