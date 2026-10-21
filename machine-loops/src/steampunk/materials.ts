// PBR metals with procedural rust, grime and edge wear, all built in the
// shader from object-space value noise (no image textures).
import * as THREE from "three";

export type MetalSpec = {
  color: [number, number, number]; // linear base colour
  metalness: number;
  roughness: number;
  rust?: number; // 0..1 coverage of rust patches
  grime?: number; // 0..1 darkening in crevices / low areas
  wear?: number; // 0..1 bright worn edges
  patina?: number; // 0..1 copper oxidation (muted brown-teal, kept non-green)
  scale?: number; // noise frequency
  seed?: number;
};

const noiseGLSL = /* glsl */ `
float h3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i + vec3(0,0,0)), h3(i + vec3(1,0,0)), f.x),
                 mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x),
                 mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
`;

export const metal = (spec: MetalSpec) => {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...spec.color),
    metalness: spec.metalness,
    roughness: spec.roughness,
    envMapIntensity: 1.0,
  });
  const u = {
    uRust: { value: spec.rust ?? 0 },
    uGrime: { value: spec.grime ?? 0 },
    uWear: { value: spec.wear ?? 0 },
    uPatina: { value: spec.patina ?? 0 },
    uScale: { value: spec.scale ?? 6 },
    uSeed: { value: spec.seed ?? 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vObj;
uniform float uRust, uGrime, uWear, uPatina, uScale, uSeed;
${noiseGLSL}
float gRust; float gEdge; float gPatina;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec3 p = vObj * uScale + uSeed;
  float n = fbm(p);
  float n2 = fbm(p * 2.7 + 5.0);
  gEdge = smoothstep(0.08, 0.5, length(fwidth(vNormal)) * 6.0);
  gRust = smoothstep(0.58 - 0.25 * uRust, 0.78 - 0.2 * uRust, n + 0.25 * n2 - 0.12) * step(0.001, uRust);
  gPatina = smoothstep(0.62, 0.8, fbm(p * 0.8 + 3.1)) * uPatina;
  vec3 rust = mix(vec3(0.12, 0.045, 0.02), vec3(0.3, 0.1, 0.035), n2);
  vec3 grime = diffuseColor.rgb * (1.0 - 0.55 * uGrime * smoothstep(0.3, 0.75, n2));
  diffuseColor.rgb = grime;
  // muted brown-teal oxidation: red stays >= green so nothing keys out
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.13, 0.11) + vec3(0.0, 0.006, 0.02) * n, gPatina);
  diffuseColor.rgb = mix(diffuseColor.rgb, rust, gRust);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + 0.04, gEdge * uWear * (1.0 - gRust));
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + gRust * 0.45 + gPatina * 0.3 - gEdge * uWear * 0.2 + (fbm(vObj * uScale * 9.0) - 0.5) * 0.12, 0.08, 1.0);`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
metalnessFactor = metalnessFactor * (1.0 - gRust * 0.85) * (1.0 - gPatina * 0.7);`,
      );
  };
  m.customProgramCacheKey = () => `metal-${spec.rust ?? 0}-${spec.patina ?? 0}`;
  return m;
};

// Library of finishes (linear colours).
export const MAT = {
  copper: () => metal({ color: [0.33, 0.2, 0.14], metalness: 1, roughness: 0.42, rust: 0.45, grime: 0.9, wear: 0.7, patina: 0.3, scale: 3.5, seed: 1 }),
  copperDark: () => metal({ color: [0.3, 0.15, 0.08], metalness: 1, roughness: 0.48, rust: 0.6, grime: 0.9, wear: 0.6, patina: 0.25, scale: 4, seed: 4 }),
  steel: () => metal({ color: [0.36, 0.36, 0.37], metalness: 1, roughness: 0.36, rust: 0.3, grime: 0.85, wear: 0.6, scale: 3, seed: 2 }),
  steelDark: () => metal({ color: [0.16, 0.16, 0.165], metalness: 1, roughness: 0.45, rust: 0.35, grime: 0.8, wear: 0.7, scale: 4, seed: 7 }),
  brass: () => metal({ color: [0.42, 0.3, 0.13], metalness: 1, roughness: 0.4, rust: 0.3, grime: 0.85, wear: 0.7, scale: 4, seed: 3 }),
  rustyIron: () => metal({ color: [0.16, 0.09, 0.05], metalness: 0.7, roughness: 0.62, rust: 0.85, grime: 0.8, wear: 0.5, scale: 7, seed: 5 }),
  blackIron: () => metal({ color: [0.012, 0.012, 0.013], metalness: 0.6, roughness: 0.5, rust: 0, grime: 0.5, wear: 0.9, scale: 5, seed: 6 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.018, 0.016), roughness: 0.8, metalness: 0 }),
  red: () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.02, 0.015), roughness: 0.4, metalness: 0.2 }),
  dialFace: (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0 }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(1, 1, 1),
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.18,
      clearcoat: 1,
      envMapIntensity: 1.2,
      depthWrite: false,
    }),
};
