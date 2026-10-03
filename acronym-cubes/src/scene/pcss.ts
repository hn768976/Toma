// Percentage-closer soft shadows (PCSS), patched into three's shadow shader
// chunk at MODULE LOAD, before any material compiles.
//
// Adapted from drei's <SoftShadows> (MIT, pmndrs/drei, N8Programs). drei
// applies the patch in a useEffect, i.e. after the first frame has already
// been drawn; with Remotion's out-of-order, multi-tab rendering that first
// frame would come out with hard shadows. Doing it at import time makes every
// frame - including frame 100 rendered alone from a cold start - identical.

import * as THREE from "three";

const pcss = (size: number, samples: number, spread: number) => `
#define PCSS_FILTER_SIZE float(${size})
vec3 pcssRand(vec2 uv) {
  return vec3(
    fract(sin(dot(uv, vec2(12.75613, 38.12123))) * 13234.76575),
    fract(sin(dot(uv, vec2(19.45531, 58.46547))) * 43678.23431),
    fract(sin(dot(uv, vec2(23.67817, 78.23121))) * 93567.23423));
}
vec3 pcssHighPassRand(vec2 uv) {
  vec3 lp = vec3(0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) lp += pcssRand(uv + vec2(float(x), float(y)));
  return pcssRand(uv) - lp / 9.0 + 0.5;
}
vec2 pcssVogel(int i, int n, float angle) {
  float r = sqrt(float(i) + 0.5) / sqrt(float(n));
  float theta = float(i) * 2.399963 + angle;
  return vec2(cos(theta), sin(theta)) * r;
}
float pcssFindBlocker(sampler2D shadowMap, vec2 uv, float compare, float angle) {
  float texel = 1.0 / float(textureSize(shadowMap, 0).x);
  float sum = 0.0;
  float count = 0.0;
  for (int i = 0; i < ${samples}; i++) {
    vec2 off = pcssVogel(i, ${samples}, angle) * texel * 2.0 * PCSS_FILTER_SIZE;
    float d = texture2D(shadowMap, uv + off).r;
    if (d < compare) { sum += d; count += 1.0; }
  }
  return count > 0.0 ? sum / count : -1.0;
}
float pcssFilter(sampler2D shadowMap, vec2 uv, float zReceiver, float radius, float angle) {
  float texel = 1.0 / float(textureSize(shadowMap, 0).x);
  float lit = 0.0;
  for (int i = 0; i < ${samples}; i++) {
    vec2 off = pcssVogel(i, ${samples}, angle) * texel * (1.0 + radius * PCSS_FILTER_SIZE);
    lit += step(zReceiver, texture2D(shadowMap, uv + off).r);
  }
  return lit / float(${samples});
}
float PCSS(sampler2D shadowMap, vec4 coords) {
  float angle = pcssHighPassRand(gl_FragCoord.xy).r * PI2;
  float blocker = pcssFindBlocker(shadowMap, coords.xy, coords.z, angle);
  if (blocker == -1.0) return 1.0;
  float penumbra = (coords.z - blocker) / blocker;
  // spread converts the (tiny, perspective-depth) blocker/receiver ratio
  // into a penumbra matching a large, soft window light.
  return pcssFilter(shadowMap, coords.xy, coords.z, min(1.25 * penumbra * float(${spread}), 1.5), angle);
}
`;

let installed = false;

export const installPCSS = (size = 18, samples = 16, spread = 1) => {
  if (installed) return;
  const original = THREE.ShaderChunk.shadowmap_pars_fragment;
  // Newer three uses a comparison sampler for PCF; PCSS needs raw depth,
  // which the Basic shadow path samples through a plain sampler2D.
  const start = original.lastIndexOf("float getShadow( sampler2D shadowMap");
  const marker = "if ( frustumTest ) {";
  const end = original.indexOf(marker, start) + marker.length;
  if (start < 0 || end < marker.length) {
    throw new Error("PCSS: shadow shader injection point not found");
  }
  const hasIntensity = original.slice(start, end).includes("shadowIntensity");
  const ret = hasIntensity
    ? "return mix( 1.0, PCSS( shadowMap, shadowCoord ), shadowIntensity );"
    : "return PCSS( shadowMap, shadowCoord );";
  THREE.ShaderChunk.shadowmap_pars_fragment = (
    original.slice(0, end) + "\n" + ret + original.slice(end)
  ).replace("#ifdef USE_SHADOWMAP", "#ifdef USE_SHADOWMAP\n" + pcss(size, samples, spread));
  installed = true;
};

// The renderer must use the Basic shadow map type for the patched path.
export const PCSS_SHADOW_TYPE = THREE.BasicShadowMap;
