import React, { useMemo } from "react";
import * as THREE from "three";
import type { Look } from "../looks";
import { SIMPLEX_3D } from "./noise";

/**
 * Renders the *same* GLB geometry as a GPU point cloud — one point per source
 * vertex, drawn with gl.POINTS. Nothing about the mesh is altered; only the
 * draw mode changes. `uDissolve` pushes each point outward along its own
 * normal plus a curl offset, which produces the dispersal shots.
 */
const VERT = /* glsl */ `
${SIMPLEX_3D}

attribute vec3 aRand;

uniform float uDissolve;
uniform float uDisperse;
uniform float uJitter;
uniform float uTime;
uniform float uSize;
uniform float uPixelScale;
uniform float uObjectScale;
uniform float uFogNear;
uniform float uFogFar;

varying float vRand;
varying float vFog;
varying float vSide;
varying float vFade;

void main(){
  vec3 p = position;
  vec3 outward = normalize(position + vec3(1e-5));

  // idle breathing so static shots never look frozen
  p += outward * sin(uTime * 1.1 + aRand.x * 6.2831) * uJitter;

  // dispersal
  float d = uDissolve;
  if (d > 0.0) {
    float lag = mix(0.35, 1.0, aRand.y);          // points leave at different times
    float k = clamp((d - (1.0 - lag)) / max(lag, 0.001), 0.0, 1.0);
    k = k * k;
    vec3 curl = vec3(
      snoise(position * 1.7 + vec3(0.0, 0.0, uTime * 0.25)),
      snoise(position * 1.7 + vec3(5.2, 1.3, uTime * 0.25)),
      snoise(position * 1.7 + vec3(9.1, 7.7, uTime * 0.25))
    );
    p += outward * k * uDisperse * (0.45 + aRand.z * 0.9);
    p += curl * k * uDisperse * 0.55;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.001);

  // uSize is a world-space diameter. uPixelScale is drawingBufferHeight/2, so
  // the dot covers the same fraction of frame at 1080p and 4K — the 4K master
  // is a true up-res of the 1080p one, not a finer-looking different image.
  gl_PointSize = uSize * uObjectScale * uPixelScale * (0.55 + aRand.z * 0.9) / dist;
  gl_Position = projectionMatrix * mv;

  vRand = aRand.x;
  vSide = normalize(position).x * 0.5 + 0.5;
  vFog = smoothstep(uFogNear, uFogFar, dist);
  vFade = 1.0 - smoothstep(0.55, 1.0, d) * 0.75;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uFog;
uniform float uOpacity;

varying float vRand;
varying float vFog;
varying float vSide;
varying float vFade;

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;
  // soft core + falloff, so dense areas bloom together
  float a = smoothstep(0.5, 0.0, r);
  a = pow(a, 1.6);

  // Keep the highlight colour a minority: weighting it this heavily turned
  // every dot white and lost the palette.
  vec3 col = mix(uColorA, uColorB, clamp(vSide * 0.45 + vRand * 0.22, 0.0, 1.0));
  col = mix(col, uFog, vFog * 0.85);

  gl_FragColor = vec4(col, a * uOpacity * vFade * (1.0 - vFog * 0.55));
  #include <colorspace_fragment>
}
`;

const c = (hex: string) => new THREE.Color(hex);

export const VirusPoints: React.FC<{
  geometry: THREE.BufferGeometry;
  look: Look;
  /** 0 = intact, 1 = fully dispersed */
  dissolve: number;
  time: number;
  /** drawingBufferHeight / 2 of the canvas this is drawn into */
  pixelScale: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  sizeMul?: number;
  opacityMul?: number;
}> = ({
  geometry,
  look,
  dissolve,
  time,
  pixelScale,
  position,
  rotation,
  scale,
  sizeMul = 1,
  opacityMul = 1,
}) => {
  const material = useMemo(() => {
    const p = look.points;
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uDissolve: { value: 0 },
        uDisperse: { value: p.disperse },
        uJitter: { value: p.jitter },
        uTime: { value: 0 },
        uSize: { value: p.size },
        uPixelScale: { value: 540 },
        uObjectScale: { value: 1 },
        uColorA: { value: c(p.colorA) },
        uColorB: { value: c(p.colorB) },
        uFog: { value: c(look.bg.fog) },
        uFogNear: { value: look.bg.fogNear },
        uFogFar: { value: look.bg.fogFar },
        uOpacity: { value: p.opacity },
      },
    });
  }, [look]);

  material.uniforms.uDissolve.value = dissolve;
  material.uniforms.uTime.value = time;
  material.uniforms.uPixelScale.value = pixelScale;
  material.uniforms.uObjectScale.value = scale ?? 1;
  material.uniforms.uSize.value = look.points.size * sizeMul;
  material.uniforms.uOpacity.value = look.points.opacity * opacityMul;

  return (
    <points
      geometry={geometry}
      position={position ?? [0, 0, 0]}
      rotation={rotation ?? [0, 0, 0]}
      scale={scale ?? 1}
    >
      <primitive object={material} attach="material" />
    </points>
  );
};
