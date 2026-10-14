// Surface finish: a fixed procedural micro-variation of roughness and tone,
// keyed to each part's *local* position so it stays glued to the surface as
// the hand moves (no swimming). Pure function of position - deterministic.
import * as THREE from "three";

const NOISE = /* glsl */ `
varying vec3 vFinishPos;
float fHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i), fHash(i + vec3(1, 0, 0)), f.x),
                 mix(fHash(i + vec3(0, 1, 0)), fHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0, 0, 1)), fHash(i + vec3(1, 0, 1)), f.x),
                 mix(fHash(i + vec3(0, 1, 1)), fHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

export type FinishOptions = {
  /** scale of the fine grain (bead-blast speckle), per local unit */
  grain: number;
  /** strength of the roughness variation (0..1) */
  roughVar: number;
  /** strength of the large, soft tone variation (0..1) */
  toneVar: number;
  /** directional brushing along local Z (0 = none) */
  brush: number;
};

export const applyFinish = (m: THREE.MeshStandardMaterial, o: FinishOptions) => {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFinishPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFinishPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + NOISE)
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        {
          vec3 q = vFinishPos;
          // bead-blast speckle + soft blotches + optional brushing streaks
          float speck = fNoise(q * ${o.grain.toFixed(1)});
          float blotch = fNoise(q * 5.0) * 0.6 + fNoise(q * 11.0) * 0.4;
          float brush = fNoise(vec3(q.x * 220.0, q.y * 220.0, q.z * 6.0));
          float v = mix(speck, brush, ${o.brush.toFixed(2)}) * 0.6 + blotch * 0.4;
          roughnessFactor = clamp(roughnessFactor * (1.0 + ${o.roughVar.toFixed(2)} * (v - 0.5) * 2.0), 0.04, 1.0);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        {
          float tone = fNoise(vFinishPos * 4.0) * 0.7 + fNoise(vFinishPos * 23.0) * 0.3;
          diffuseColor.rgb *= 1.0 + ${o.toneVar.toFixed(2)} * (tone - 0.5) * 2.0;
        }`,
      );
  };
  // distinct program per option set
  m.customProgramCacheKey = () => `finish-${o.grain}-${o.roughVar}-${o.toneVar}-${o.brush}`;
};
