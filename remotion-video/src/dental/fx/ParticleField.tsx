// One instanced particle system, four looks.
//
// The reference set needs cleaning bubbles, enamel sparkle, lifted plaque
// debris and mineral crystals. They differ only in base geometry and a few
// lines of shading, so they share one instancing and motion path: each
// instance carries a spawn point sampled off the arch surface, the surface
// normal there, its arch angle, and a seed. Everything else -- age, drift,
// swirl, fade -- is derived in the vertex shader from uTime, so no
// per-frame CPU work happens at all.
//
// Gating emission on the arch angle is what ties the effects to the
// treatment: particles only appear where the cleaning wavefront currently
// is, so bubbles chase the sweep that is whitening the enamel.

import React, { useMemo } from "react";
import {
  AdditiveBlending,
  Color,
  DodecahedronGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  OctahedronGeometry,
  PlaneGeometry,
  BufferGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { GLSL_NOISE } from "../materials/noise";
import { mulberry32 } from "./random";
import { SurfaceSamples } from "./surfaceSamples";

export type ParticleVariant = "bubble" | "sparkle" | "debris" | "crystal";

const BASE_GEOMETRY: Record<ParticleVariant, () => BufferGeometry> = {
  // A once-subdivided icosahedron is round enough for a bubble at these
  // sizes; a plane is billboarded for sparkle; the solids stay flat-faceted
  // on purpose so debris and crystals catch distinct facet shading.
  bubble: () => new IcosahedronGeometry(1, 1),
  sparkle: () => new PlaneGeometry(2, 2),
  debris: () => new DodecahedronGeometry(1, 0),
  crystal: () => new OctahedronGeometry(1, 0),
};

const VERTEX = /* glsl */ `
${GLSL_NOISE}

attribute vec3 aSpawn;
attribute vec3 aNormal;
attribute float aTheta;
attribute vec4 aSeed;

uniform float uTime;
uniform float uLifetime;
uniform float uRise;
uniform float uSwirl;
uniform float uSwirlTurns;
uniform float uJitter;
uniform float uSizeMin;
uniform float uSizeMax;
uniform vec3 uStretch;
uniform float uEmission;
uniform float uBillboard;

// Emission follows the cleaning wavefront when uSweepGate is on.
uniform float uSweepGate;
uniform float uSweepPos;
uniform float uSweepBand;
uniform float uSweepSign;

varying float vAlpha;
varying float vColorMix;
varying vec3 vLocal;
varying vec3 vViewNormal;

void main() {
  float age = fract(aSeed.x + uTime / max(uLifetime, 0.001));

  float gate = 1.0;
  if (uSweepGate > 0.5) {
    float d = aTheta * uSweepSign - uSweepPos;
    gate = exp(-pow(d / max(uSweepBand, 0.001), 2.0));
  }
  float alpha = gate * uEmission
              * smoothstep(0.0, 0.14, age)
              * (1.0 - smoothstep(0.58, 1.0, age));

  vec3 n = normalize(aNormal);
  vec3 tangent = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 bitangent = cross(n, tangent);

  vec3 centre = aSpawn + n * (age * uRise);
  float swirl = aSeed.z * 6.2831853 + age * uSwirlTurns * 6.2831853;
  centre += (tangent * cos(swirl) + bitangent * sin(swirl)) * uSwirl * age;
  centre += vec3(
    gnoise(vec3(aSeed.xy * 40.0, uTime * 0.6)),
    gnoise(vec3(aSeed.yz * 40.0 + 7.0, uTime * 0.5)),
    gnoise(vec3(aSeed.zw * 40.0 + 3.0, uTime * 0.7))) * uJitter * age;

  float scale = mix(uSizeMin, uSizeMax, aSeed.y) * smoothstep(0.0, 0.25, alpha);

  vec4 centreView = modelViewMatrix * vec4(centre, 1.0);
  vec3 offset;
  if (uBillboard > 0.5) {
    offset = vec3(position.xy * scale, 0.0);
  } else {
    // Give each instance a fixed tumble so identical solids do not line up.
    float a = aSeed.w * 6.2831853;
    float ca = cos(a);
    float sa = sin(a);
    vec3 p = position * uStretch;
    p = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
    p = vec3(p.x, p.y * ca - p.z * sa, p.y * sa + p.z * ca);
    offset = (modelViewMatrix * vec4(p * scale, 0.0)).xyz;
  }

  vAlpha = alpha;
  vColorMix = aSeed.w;
  vLocal = position;
  vViewNormal = normalize((modelViewMatrix * vec4(normal, 0.0)).xyz);

  gl_Position = projectionMatrix * (centreView + vec4(offset, 0.0));
}
`;

const FRAGMENT = (variant: ParticleVariant) => /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uGlow;

varying float vAlpha;
varying float vColorMix;
varying vec3 vLocal;
varying vec3 vViewNormal;

void main() {
  vec3 tint = mix(uColorA, uColorB, vColorMix);
  float alpha = vAlpha * uOpacity;
  vec3 color = tint;

${
  variant === "sparkle"
    ? `
  // Soft four-point star: a tight core with a cross flare.
  vec2 p = vLocal.xy;
  float r = length(p);
  float core = pow(clamp(1.0 - r, 0.0, 1.0), 4.0);
  float flare = pow(clamp(1.0 - abs(p.x) * 3.2, 0.0, 1.0), 6.0)
              + pow(clamp(1.0 - abs(p.y) * 3.2, 0.0, 1.0), 6.0);
  float shape = core + flare * 0.35 * clamp(1.0 - r, 0.0, 1.0);
  if (shape < 0.003) discard;
  color = mix(tint, vec3(1.0), core) * uGlow;
  alpha *= shape;
`
    : variant === "bubble"
      ? `
  // A thin shell: bright where the surface turns away, near-clear head on,
  // plus a single hard highlight so it reads as a wet sphere.
  // A soap film: almost clear face-on, bright and dense at the silhouette,
  // with one small hard highlight. The faint constant term keeps a bubble
  // from vanishing entirely when it is only a few pixels across.
  float facing = abs(vViewNormal.z);
  float rim = pow(1.0 - facing, 2.0);
  vec3 highlightDir = normalize(vec3(-0.42, 0.6, 0.68));
  float spec = pow(clamp(dot(normalize(vViewNormal), highlightDir), 0.0, 1.0), 48.0);
  color = mix(tint, vec3(1.0), clamp(rim * 0.45 + spec, 0.0, 1.0)) * uGlow;
  alpha *= clamp(rim * 0.95 + spec * 1.8 + 0.09, 0.0, 1.0);
`
      : variant === "crystal"
        ? `
  float facing = abs(vViewNormal.z);
  float edge = pow(1.0 - facing, 1.6);
  float shade = 0.45 + 0.55 * clamp(vViewNormal.z * 0.5 + 0.7, 0.0, 1.0);
  color = mix(tint * shade, vec3(1.0), edge * 0.6) * uGlow;
  alpha *= clamp(0.34 + edge * 0.75, 0.0, 1.0);
`
        : `
  // Opaque lifted debris: simple view-space lambert, no transparency.
  float shade = 0.34 + 0.66 * clamp(vViewNormal.z * 0.6 + 0.55, 0.0, 1.0);
  color = tint * shade * uGlow;
`
}

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export type ParticleFieldProps = {
  samples: SurfaceSamples;
  variant: ParticleVariant;
  seed: number;
  /** Seconds for one spawn-to-fade cycle. */
  lifetime: number;
  /** Distance travelled along the surface normal over a lifetime. */
  rise: number;
  swirl?: number;
  swirlTurns?: number;
  jitter?: number;
  sizeMin: number;
  sizeMax: number;
  /** Per-axis scaling of the instance solid; elongates rods and flakes. */
  stretch?: [number, number, number];
  colorA: string;
  colorB?: string;
  opacity?: number;
  glow?: number;
  /** Master on/off, animate it to start and stop the effect. */
  emission: number;
  timeInSeconds: number;
  /** Tie emission to the cleaning wavefront: [position, band, sign]. */
  sweep?: [number, number, number];
};

export const ParticleField: React.FC<ParticleFieldProps> = ({
  samples,
  variant,
  seed,
  lifetime,
  rise,
  swirl = 0,
  swirlTurns = 1,
  jitter = 0,
  sizeMin,
  sizeMax,
  stretch,
  colorA,
  colorB,
  opacity = 1,
  glow = 1,
  emission,
  timeInSeconds,
  sweep,
}) => {
  const geometry = useMemo(() => {
    const base = BASE_GEOMETRY[variant]();
    const instanced = new InstancedBufferGeometry();
    instanced.index = base.index;
    instanced.setAttribute("position", base.getAttribute("position"));
    instanced.setAttribute("normal", base.getAttribute("normal"));
    instanced.instanceCount = samples.count;

    const rand = mulberry32(seed);
    const seeds = new Float32Array(samples.count * 4);
    for (let i = 0; i < seeds.length; i++) {
      seeds[i] = rand();
    }
    instanced.setAttribute("aSpawn", new InstancedBufferAttribute(samples.positions, 3));
    instanced.setAttribute("aNormal", new InstancedBufferAttribute(samples.normals, 3));
    instanced.setAttribute("aTheta", new InstancedBufferAttribute(samples.thetas, 1));
    instanced.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
    // Instances are repositioned in the shader, so the bounding volume has
    // to be generous or three culls the whole field the moment the spawn
    // cloud leaves the frustum.
    instanced.boundingSphere = null;
    return instanced;
  }, [samples, seed, variant]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT(variant),
        transparent: variant !== "debris",
        depthWrite: variant === "debris",
        blending: variant === "sparkle" ? AdditiveBlending : NormalBlending,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uLifetime: { value: 1 },
          uRise: { value: 0 },
          uSwirl: { value: 0 },
          uSwirlTurns: { value: 1 },
          uJitter: { value: 0 },
          uSizeMin: { value: 0.004 },
          uSizeMax: { value: 0.01 },
          uStretch: { value: new Vector3(1, 1, 1) },
          uEmission: { value: 0 },
          uBillboard: { value: variant === "sparkle" ? 1 : 0 },
          uSweepGate: { value: 0 },
          uSweepPos: { value: 0 },
          uSweepBand: { value: 0.4 },
          uSweepSign: { value: 1 },
          uColorA: { value: new Color() },
          uColorB: { value: new Color() },
          uOpacity: { value: 1 },
          uGlow: { value: 1 },
        },
      }),
    [variant],
  );

  const u = material.uniforms;
  u.uTime.value = timeInSeconds;
  u.uLifetime.value = lifetime;
  u.uRise.value = rise;
  u.uSwirl.value = swirl;
  u.uSwirlTurns.value = swirlTurns;
  u.uJitter.value = jitter;
  u.uSizeMin.value = sizeMin;
  u.uSizeMax.value = sizeMax;
  (u.uStretch.value as Vector3).set(...(stretch ?? [1, 1, 1]));
  u.uEmission.value = emission;
  u.uOpacity.value = opacity;
  u.uGlow.value = glow;
  (u.uColorA.value as Color).set(colorA);
  (u.uColorB.value as Color).set(colorB ?? colorA);
  u.uSweepGate.value = sweep ? 1 : 0;
  if (sweep) {
    u.uSweepPos.value = sweep[0];
    u.uSweepBand.value = sweep[1];
    u.uSweepSign.value = sweep[2];
  }

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
};
