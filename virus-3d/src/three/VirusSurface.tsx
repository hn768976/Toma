import React, { useMemo } from "react";
import * as THREE from "three";
import type { Look } from "../looks";
import { SIMPLEX_3D } from "./noise";

const VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vRadius;
varying float vDepth;

void main(){
  vLocal   = position;
  vRadius  = length(position);
  vec4 wp  = modelMatrix * vec4(position, 1.0);
  vWorld   = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mv  = viewMatrix * wp;
  vDepth   = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;

${SIMPLEX_3D}

varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vRadius;
varying float vDepth;

uniform vec3  uCapsid;
uniform vec3  uSpike;
uniform float uSpikeStart;
uniform float uSpikeEnd;
uniform float uTipGlow;
uniform vec3  uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
uniform vec3  uSssColor;
uniform float uSss;
uniform float uSpecular;
uniform float uShininess;
uniform float uBump;
uniform float uNoiseScale;
uniform float uMottle;
uniform vec3  uAmbientColor;
uniform float uAmbient;
uniform vec3  uKeyColor;
uniform vec3  uKeyDir;
uniform float uKey;
uniform vec3  uFillColor;
uniform vec3  uFillDir;
uniform float uFill;
uniform vec3  uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uOpacity;
uniform float uDim;
uniform vec3  uCamPos;
uniform float uWrap;
uniform float uHoloBase;
uniform float uHoloPower;

void main(){
  // Ng = geometric normal, N = bump-perturbed normal.
  // Subsurface and rim must read off Ng: driving them from the perturbed
  // normal makes every micro-facet that tilts away from the key light glow,
  // which covers the capsid in coloured fuzz.
  vec3 Ng = normalize(vNormalW);
  vec3 N = Ng;
  vec3 V = normalize(uCamPos - vWorld);

  // --- procedural protein-shell detail (noise in object space, so the
  //     texture sticks to the mesh as it rotates)
  float n = 0.0;
#ifndef SIMPLE
  vec3 np = vLocal * uNoiseScale;
  n  = fbm(np);
  float e  = 0.06;
  vec3 grad = vec3(
    fbm(np + vec3(e,0.0,0.0)) - fbm(np - vec3(e,0.0,0.0)),
    fbm(np + vec3(0.0,e,0.0)) - fbm(np - vec3(0.0,e,0.0)),
    fbm(np + vec3(0.0,0.0,e)) - fbm(np - vec3(0.0,0.0,e))
  );
  // keep only the tangential part so the bump never flips the surface
  vec3 tangential = grad - dot(grad, N) * N;
  N = normalize(N - uBump * tangential);
#endif

  // --- albedo: capsid body vs spike tips, keyed off distance from centre
  float spikeMask = smoothstep(uSpikeStart, uSpikeEnd, vRadius);
  vec3 albedo = mix(uCapsid, uSpike, spikeMask);
  // Clamped, darkening-biased: an unclamped multiplier lets bright noise peaks
  // push the albedo past white, which shows up as speckled white dots.
  albedo *= clamp(1.0 + uMottle * n, 0.6, 1.08);

  // --- lighting
  vec3 L = normalize(uKeyDir);
  vec3 F = normalize(uFillDir);

  // uWrap blends toward half-lambert. A hard terminator reads as plastic;
  // wrapping it is what makes the shell look like soft tissue.
  float ndlHard = max(dot(N, L), 0.0);
  float ndl = mix(ndlHard, pow(dot(N, L) * 0.5 + 0.5, 1.6), uWrap);
  float ndf = max(dot(N, F), 0.0);

  vec3 diffuse = albedo * (uKeyColor * ndl * uKey + uFillColor * ndf * uFill);
  vec3 ambient = albedo * uAmbientColor * uAmbient;

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uShininess) * uSpecular;

  // True back-light: only the shell turned away from the key glows through.
  // A wrapped term here washes the whole body in the rim colour.
  float back = pow(max(-dot(Ng, L), 0.0), 2.2);
  vec3 sss = uSssColor * back * uSss;

  // Grazing-angle rim, gated to the backlit side so it reads as a light
  // wrapping the silhouette rather than a uniform tint.
  float fres = pow(1.0 - max(dot(Ng, V), 0.0), uRimPower);
  float rimGate = mix(0.2, 1.0, back);
  vec3 rim = uRimColor * fres * uRimStrength * rimGate;

  // Spike tips pick up the emissive lift, the capsid body does not.
  vec3 tips = uSpike * spikeMask * uTipGlow * (0.4 + 0.6 * fres);

  vec3 color = ambient + diffuse + sss + rim + tips + uKeyColor * spec;
  color *= uDim;

  // --- atmospheric depth fade toward the plate colour
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  color = mix(color, uFog, fog);

#ifdef HOLO
  // See-through shell: opacity rides the view angle, so faces turned toward
  // the camera go glassy and the silhouette stays defined. Drawn double-sided
  // with no depth write, so the far side reads through the near side.
  float holoF = pow(1.0 - abs(dot(Ng, V)), uHoloPower);
  float alpha = uOpacity * clamp(uHoloBase + (1.0 - uHoloBase) * holoF, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
#else
  gl_FragColor = vec4(color, uOpacity);
#endif
  #include <colorspace_fragment>
}
`;

const c = (hex: string) => new THREE.Color(hex);
const v = (a: [number, number, number]) => new THREE.Vector3(...a).normalize();

export const makeSurfaceMaterial = (
  look: Look,
  opts?: { dim?: number; opacity?: number; simple?: boolean; holo?: boolean },
) => {
  const m = look.mat;
  // Defocused background copies skip the expensive fbm detail — they are
  // blurred past recognition, so the noise would only cost render time.
  const defines =
    (opts?.simple ? "#define SIMPLE 1\n" : "") + (opts?.holo ? "#define HOLO 1\n" : "");
  const frag = defines ? `${defines}${FRAG}` : FRAG;
  const holo = opts?.holo ? look.holo : null;
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    transparent: (opts?.opacity ?? 1) < 1 || Boolean(opts?.holo),
    depthWrite: !opts?.holo,
    side: opts?.holo ? THREE.DoubleSide : THREE.FrontSide,
    blending:
      holo?.blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uCapsid: { value: c(m.capsid) },
      uSpike: { value: c(m.spike) },
      uSpikeStart: { value: m.spikeStart },
      uSpikeEnd: { value: m.spikeEnd },
      uTipGlow: { value: m.tipGlow },
      uRimColor: { value: c(m.rimColor) },
      uRimPower: { value: m.rimPower },
      uRimStrength: { value: m.rimStrength },
      uSssColor: { value: c(m.sssColor) },
      uSss: { value: m.sss },
      uSpecular: { value: m.specular },
      uShininess: { value: m.shininess },
      uBump: { value: m.bump },
      uNoiseScale: { value: m.noiseScale },
      uMottle: { value: m.mottle },
      uAmbientColor: { value: c(m.ambientColor) },
      uAmbient: { value: m.ambient },
      uKeyColor: { value: c(m.keyColor) },
      uKeyDir: { value: v(m.keyDir) },
      uKey: { value: m.key },
      uFillColor: { value: c(m.fillColor) },
      uFillDir: { value: v(m.fillDir) },
      uFill: { value: m.fill },
      uFog: { value: c(look.bg.fog) },
      uFogNear: { value: look.bg.fogNear },
      uFogFar: { value: look.bg.fogFar },
      uOpacity: { value: opts?.opacity ?? 1 },
      uDim: { value: opts?.dim ?? 1 },
      uCamPos: { value: new THREE.Vector3(0, 0, 5) },
      uWrap: { value: m.wrap },
      uHoloBase: { value: look.holo.base },
      uHoloPower: { value: look.holo.power },
    },
  });
};

export const VirusSurface: React.FC<{
  geometry: THREE.BufferGeometry;
  look: Look;
  dim?: number;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  cameraZ: number;
  simple?: boolean;
  holo?: boolean;
}> = ({
  geometry,
  look,
  dim,
  opacity,
  position,
  rotation,
  scale,
  cameraZ,
  simple,
  holo,
}) => {
  const material = useMemo(
    () => makeSurfaceMaterial(look, { dim, opacity, simple, holo }),
    [look, dim, opacity, simple, holo],
  );
  // Camera never moves (the world does), but keep the uniform authoritative.
  material.uniforms.uCamPos.value.set(0, 0, cameraZ);

  return (
    <mesh
      geometry={geometry}
      position={position ?? [0, 0, 0]}
      rotation={rotation ?? [0, 0, 0]}
      scale={scale ?? 1}
    >
      <primitive object={material} attach="material" />
    </mesh>
  );
};
