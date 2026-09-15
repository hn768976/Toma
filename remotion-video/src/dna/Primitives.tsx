import React, { useMemo } from "react";
import * as THREE from "three";
import { edgesOf, sampleSurface } from "./model";

export type Transform = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /**
   * Euler order. Defaults to three's "XYZ", which applies Z first — wrong when
   * a model needs to spin about its own long axis *before* being tilted into
   * the frame. Those cases pass "ZYX", which applies X (the helix axis) first
   * and the Z tilt last.
   */
  rotationOrder?: THREE.EulerOrder;
  scale?: number | [number, number, number];
};

const applyTransform = (t: Transform | undefined) => {
  const r = t?.rotation ?? [0, 0, 0];
  return {
    position: t?.position ?? ([0, 0, 0] as [number, number, number]),
    rotation: new THREE.Euler(r[0], r[1], r[2], t?.rotationOrder ?? "XYZ"),
    scale: (typeof t?.scale === "number"
      ? [t.scale, t.scale, t.scale]
      : (t?.scale ?? [1, 1, 1])) as [number, number, number],
  };
};

/* ------------------------------------------------------------------ *
 * Solid mesh
 * ------------------------------------------------------------------ */

export type SolidProps = Transform & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

export const Solid: React.FC<SolidProps> = ({ geometry, material, ...t }) => {
  const tr = applyTransform(t);
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={tr.position}
      rotation={tr.rotation}
      scale={tr.scale}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Surface point cloud
 * ------------------------------------------------------------------ */

const POINT_VERT = /* glsl */ `
  uniform float uSize;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uJitter;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aAxis;
  varying float vSeed;
  varying float vAxis;
  varying float vFade;

  void main() {
    vSeed = aSeed;
    vAxis = aAxis;

    vec3 p = position;
    // Each point breathes a little along its own normal so the cloud shimmers
    // instead of reading as a frozen shell.
    float ph = aSeed * 6.2831853 + uTime * (0.6 + aSeed * 0.8);
    p += normal * (sin(ph) * uJitter);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = mix(1.0, 0.35 + 0.65 * (0.5 + 0.5 * sin(ph * 1.7)), uTwinkle);
    vFade = twinkle;
    gl_PointSize = uSize * uPixelRatio * twinkle * (12.0 / max(0.001, -mv.z));
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uCore;
  varying float vSeed;
  varying float vAxis;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    // Soft falloff with a brighter core, which is what sells a glowing dot.
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(uCore, 0.0, d);
    vec3 col = mix(uColorA, uColorB, clamp(vAxis * 0.7 + vSeed * 0.3, 0.0, 1.0));
    float a = (halo * 0.65 + core * 0.9) * uOpacity * vFade;
    gl_FragColor = vec4(col * (0.75 + core * 0.9), a);
  }
`;

export type SurfacePointsProps = Transform & {
  geometry: THREE.BufferGeometry;
  count: number;
  seed: number;
  size: number;
  colorA: string;
  colorB?: string;
  opacity?: number;
  /** Seconds; drives the shimmer. Pass frame / fps. */
  time: number;
  twinkle?: number;
  jitter?: number;
  core?: number;
  additive?: boolean;
  depthWrite?: boolean;
};

export const SurfacePoints: React.FC<SurfacePointsProps> = ({
  geometry,
  count,
  seed,
  size,
  colorA,
  colorB,
  opacity = 1,
  time,
  twinkle = 0.6,
  jitter = 0,
  core = 0.22,
  additive = true,
  depthWrite = false,
  ...t
}) => {
  const tr = applyTransform(t);

  const pointGeometry = useMemo(() => {
    const cloud = sampleSurface(geometry, count, seed);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(cloud.normals, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(cloud.seeds, 1));
    g.setAttribute("aAxis", new THREE.BufferAttribute(cloud.axis, 1));
    g.computeBoundingSphere();
    return g;
  }, [geometry, count, seed]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        transparent: true,
        depthWrite,
        depthTest: true,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          uSize: { value: size },
          uTime: { value: 0 },
          uTwinkle: { value: twinkle },
          uJitter: { value: jitter },
          uPixelRatio: { value: 1 },
          uColorA: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB ?? colorA) },
          uOpacity: { value: opacity },
          uCore: { value: core },
        },
      }),
    // Uniform values are updated below; the material identity only needs to
    // change when its structural options do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [additive, depthWrite],
  );

  material.uniforms.uSize.value = size;
  material.uniforms.uTime.value = time;
  material.uniforms.uTwinkle.value = twinkle;
  material.uniforms.uJitter.value = jitter;
  material.uniforms.uColorA.value.set(colorA);
  material.uniforms.uColorB.value.set(colorB ?? colorA);
  material.uniforms.uOpacity.value = opacity;
  material.uniforms.uCore.value = core;
  material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;

  return (
    <points
      geometry={pointGeometry}
      material={material}
      position={tr.position}
      rotation={tr.rotation}
      scale={tr.scale}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Sharp-edge wireframe
 * ------------------------------------------------------------------ */

export type WireProps = Transform & {
  geometry: THREE.BufferGeometry;
  color: string;
  opacity?: number;
  thresholdAngle?: number;
  additive?: boolean;
};

export const Wire: React.FC<WireProps> = ({
  geometry,
  color,
  opacity = 1,
  thresholdAngle = 24,
  additive = true,
  ...t
}) => {
  const tr = applyTransform(t);
  const edges = useMemo(
    () => edgesOf(geometry, thresholdAngle),
    [geometry, thresholdAngle],
  );
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    [additive],
  );
  material.color.set(color);
  material.opacity = opacity;

  return (
    <lineSegments
      geometry={edges}
      material={material}
      position={tr.position}
      rotation={tr.rotation}
      scale={tr.scale}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Free-floating dust
 * ------------------------------------------------------------------ */

export type DustProps = {
  count: number;
  seed: number;
  /** Half-extent of the box the dust lives in. */
  bounds: [number, number, number];
  size: number;
  colorA: string;
  colorB?: string;
  opacity?: number;
  time: number;
  speed?: number;
};

const DUST_VERT = /* glsl */ `
  uniform float uSize;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uBounds;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    // Drift upward and wrap, so the field never empties out.
    float span = uBounds.y * 2.0;
    p.y = mod(p.y + uBounds.y + uTime * uSpeed * (0.4 + aSeed * 0.8), span) - uBounds.y;
    p.x += sin(uTime * 0.35 + aSeed * 12.0) * uBounds.x * 0.04;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vFade = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 20.0));
    gl_PointSize = uSize * (0.4 + aSeed) * (12.0 / max(0.001, -mv.z));
  }
`;

const DUST_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uColorA, uColorB, vSeed);
    gl_FragColor = vec4(col, a * a * uOpacity * vFade);
  }
`;

export const Dust: React.FC<DustProps> = ({
  count,
  seed,
  bounds,
  size,
  colorA,
  colorB,
  opacity = 1,
  time,
  speed = 0.35,
}) => {
  const [bx, by, bz] = bounds;

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let a = (seed * 2654435761) >>> 0;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() * 2 - 1) * bx;
      positions[i * 3 + 1] = (rand() * 2 - 1) * by;
      positions[i * 3 + 2] = (rand() * 2 - 1) * bz;
      seeds[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      Math.hypot(bx, by, bz) * 2,
    );
    return g;
  }, [count, seed, bx, by, bz]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uSize: { value: size },
          uTime: { value: 0 },
          uSpeed: { value: speed },
          uBounds: { value: new THREE.Vector3(...bounds) },
          uColorA: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB ?? colorA) },
          uOpacity: { value: opacity },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  material.uniforms.uSize.value = size;
  material.uniforms.uTime.value = time;
  material.uniforms.uSpeed.value = speed;
  material.uniforms.uBounds.value.set(...bounds);
  material.uniforms.uColorA.value.set(colorA);
  material.uniforms.uColorB.value.set(colorB ?? colorA);
  material.uniforms.uOpacity.value = opacity;

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};
