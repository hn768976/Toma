// Percentage-closer soft shadows (PCSS). Same technique and shader as drei's
// <SoftShadows>, but patched into three's shader chunk at module load instead of
// in a React effect, so the very first frame a render thread draws already has
// soft shadows (drei's version patches after mount and recompiles).
// The sample rotation comes from gl_FragCoord only: fully deterministic.

import * as THREE from "three";

const SIZE = 22; // penumbra filter size
const SAMPLES = 10; // drei's default
const FOCUS = 0;

const pcss = `
#define PENUMBRA_FILTER_SIZE float(${SIZE})
// Per-pixel rotation of the sample disk: interleaved gradient noise from
// gl_FragCoord (one hash instead of drei's ten; same purpose, deterministic).
float vfIgn(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec2 vfVogel(int i, int n, float angle) {
  float r = sqrt(float(i) + 0.5) / sqrt(float(n));
  float theta = float(i) * 2.399963 + angle;
  return vec2(cos(theta), sin(theta)) * r;
}
float vfFindBlocker(sampler2D shadowMap, vec2 uv, float compare, float angle) {
  float texelSize = 1.0 / float(textureSize(shadowMap, 0).x);
  float sum = float(${FOCUS});
  float blockers = 0.0;
  for (int i = 0; i < ${SAMPLES}; i++) {
    vec2 offset = vfVogel(i, ${SAMPLES}, angle) * texelSize * 2.0 * PENUMBRA_FILTER_SIZE;
    float depth = unpackRGBAToDepth(texture2D(shadowMap, uv + offset));
    if (depth < compare) { sum += depth; blockers++; }
  }
  return blockers > 0.0 ? sum / blockers : -1.0;
}
float vfVogelFilter(sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius, float angle) {
  float texelSize = 1.0 / float(textureSize(shadowMap, 0).x);
  float shadow = 0.0;
  for (int i = 0; i < ${SAMPLES}; i++) {
    vec2 offset = vfVogel(i, ${SAMPLES}, angle) * texelSize * (1.0 + filterRadius * float(${SIZE}));
    shadow += step(zReceiver, unpackRGBAToDepth(texture2D(shadowMap, uv + offset)));
  }
  return shadow / float(${SAMPLES});
}
float PCSS(sampler2D shadowMap, vec4 coords) {
  vec2 uv = coords.xy;
  float zReceiver = coords.z;
  float angle = vfIgn(gl_FragCoord.xy) * PI2;
  float blocker = vfFindBlocker(shadowMap, uv, zReceiver, angle);
  if (blocker == -1.0) return 1.0;
  float penumbra = (zReceiver - blocker) / blocker;
  return vfVogelFilter(shadowMap, uv, zReceiver, 1.25 * penumbra, angle);
}
`;

const MARK = "/* voxel-fields pcss */";
const PROFILE = String(process.env.REMOTION_VF_PROFILE ?? "");
if (!PROFILE.includes("nopcss") && !THREE.ShaderChunk.shadowmap_pars_fragment.includes(MARK)) {
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  const patched = src
    .replace("#ifdef USE_SHADOWMAP", `#ifdef USE_SHADOWMAP\n${MARK}\n${pcss}`)
    .replace(
      "#if defined( SHADOWMAP_TYPE_PCF )",
      "\nreturn PCSS(shadowMap, shadowCoord);\n#if defined( SHADOWMAP_TYPE_PCF )",
    );
  if (patched === src || !patched.includes("return PCSS(")) {
    throw new Error("PCSS patch failed: three's shadowmap chunk changed");
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = patched;
}

export const PCSS_READY = true;
