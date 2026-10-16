import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

// Fat screen-space lines for LineSegments2 / LineSegmentsGeometry.
// Same extrusion as three's LineMaterial (constant pixel width), plus:
//  - analytic anti-aliasing across the width, and lines thinner than a pixel
//    keep a 1.5 px footprint with proportionally less energy, so far lines
//    fade out instead of crawling;
//  - a width/brightness boost close to the camera;
//  - distance fog toward a colour;
//  - a GLSL hook (`colorFn`) that decides the colour from world position,
//    view depth and the per-vertex data stored in instanceColorStart/End.

export type GlowLineParams = {
  linewidth: number; // px at the current drawing-buffer height
  nearBoost: number; // extra width multiplier at the camera
  nearDist: number;
  farDist: number;
  // Beyond this view depth the width shrinks ∝ 1/depth (sub-pixel lines then
  // lose energy instead of aliasing into moiré). 0 disables.
  taperDepth?: number;
  depthPull?: number;
  fogNear: number;
  fogFar: number;
  fogColor: THREE.ColorRepresentation;
  fogAmount: number; // 0..1 colour fog
  fadeNear: number; // energy fade (for additive lines)
  fadeFar: number;
  coreWhite: number; // how much the line centre burns toward white
  intensity: number;
  colorFn: string; // GLSL: vec3 lineColor(vec3 world, float depth, vec3 data)
  extraUniforms?: Record<string, THREE.IUniform>;
  blending: THREE.Blending;
  blendEquation?: THREE.BlendingEquation;
  depthTest: boolean;
};

const vertex = /* glsl */ `
uniform vec2 lineResolution;
uniform float linewidth;
uniform float nearBoost;
uniform float nearDist;
uniform float farDist;
uniform float taperDepth;
uniform float depthPull;
attribute vec3 instanceStart;
attribute vec3 instanceEnd;
attribute vec3 instanceColorStart;
attribute vec3 instanceColorEnd;
varying vec3 vData;
varying vec3 vWorld;
varying float vDepth;
varying float vUw;
varying float vClipW;
varying float vHalfQuad;
varying float vHalfW;
varying float vEnergy;

void trimSegment(const in vec4 start, inout vec4 end) {
  float a = projectionMatrix[2][2];
  float b = projectionMatrix[3][2];
  float nearEstimate = -0.5 * b / a;
  float alpha = (nearEstimate - start.z) / (end.z - start.z);
  end.xyz = mix(start.xyz, end.xyz, alpha);
}

void main() {
  float aspect = lineResolution.x / lineResolution.y;
  vec4 start = modelViewMatrix * vec4(instanceStart, 1.0);
  vec4 end = modelViewMatrix * vec4(instanceEnd, 1.0);
  // pull toward the eye by a fraction of depth so lines win the depth test
  // against the faces they lie on, at any distance
  start.xyz *= 1.0 - depthPull;
  end.xyz *= 1.0 - depthPull;
  if (start.z < 0.0 && end.z >= 0.0) trimSegment(start, end);
  else if (end.z < 0.0 && start.z >= 0.0) trimSegment(end, start);

  vec4 clipStart = projectionMatrix * start;
  vec4 clipEnd = projectionMatrix * end;
  vec3 ndcStart = clipStart.xyz / clipStart.w;
  vec3 ndcEnd = clipEnd.xyz / clipEnd.w;
  vec2 dir = ndcEnd.xy - ndcStart.xy;
  dir.x *= aspect;
  dir = normalize(dir + vec2(1e-9, 0.0));

  bool isStart = position.y < 0.5;
  float depth = -(isStart ? start.z : end.z);
  float w = linewidth * (1.0 + nearBoost * (1.0 - smoothstep(nearDist, farDist, depth)));
  if (taperDepth > 0.0) w *= min(1.0, taperDepth / max(depth, 1e-3));
  float drawW = max(w, 1.0);
  float quadW = drawW + 2.0; // 1 px AA margin each side
  vEnergy = min(w, 1.0);

  vec2 offset = vec2(dir.y, -dir.x);
  vec2 cap = dir;
  dir.x /= aspect;
  offset.x /= aspect;
  cap.x /= aspect;
  if (position.x < 0.0) offset *= -1.0;
  // short caps (half the drawn width) close the joins without long overlaps
  if (position.y < 0.0) offset += -cap * (drawW / quadW);
  else if (position.y > 1.0) offset += cap * (drawW / quadW);
  offset *= quadW;
  offset /= lineResolution.y;
  vec4 clip = isStart ? clipStart : clipEnd;
  offset *= clip.w;
  clip.xy += offset;
  gl_Position = clip;

  // screen-linear interpolation of the across-line coordinate (WebGL2 has
  // no noperspective): interpolate u*w and w, divide in the fragment.
  vUw = position.x * clip.w;
  vClipW = clip.w;
  vHalfQuad = quadW * 0.5;
  vHalfW = drawW * 0.5;
  vDepth = depth;
  vData = isStart ? instanceColorStart : instanceColorEnd;
  vec3 wp = isStart ? instanceStart : instanceEnd;
  vWorld = (modelMatrix * vec4(wp, 1.0)).xyz;
}`;

const fragment = (colorFn: string) => /* glsl */ `
uniform float fogNear;
uniform float fogFar;
uniform vec3 fogColor;
uniform float fogAmount;
uniform float fadeNear;
uniform float fadeFar;
uniform float coreWhite;
uniform float intensity;
varying vec3 vData;
varying vec3 vWorld;
varying float vDepth;
varying float vUw;
varying float vClipW;
varying float vHalfQuad;
varying float vHalfW;
varying float vEnergy;

${colorFn}

void main() {
  float d = abs(vUw / vClipW) * vHalfQuad; // px from centre line
  float cov = clamp(vHalfW + 0.5 - d, 0.0, 1.0);
  if (cov <= 0.0) discard;
  float core = 1.0 - smoothstep(0.0, vHalfW + 0.5, d);
  vec3 col = lineColor(vWorld, vDepth, vData);
  col = mix(col, vec3(max(col.r, max(col.g, col.b))), coreWhite * core * core);
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, vDepth);
  float fog = smoothstep(fogNear, fogFar, vDepth) * fogAmount;
  col = mix(col * intensity, fogColor, fog);
  float e = cov * vEnergy * fade;
  // alpha doubles as the bloom mask in the scene buffer
  gl_FragColor = vec4(col * e, 1.0);
}`;

export const makeGlowLineMaterial = (p: GlowLineParams) => {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment(p.colorFn),
    uniforms: {
      lineResolution: { value: new THREE.Vector2(1280, 720) },
      linewidth: { value: p.linewidth },
      nearBoost: { value: p.nearBoost },
      nearDist: { value: p.nearDist },
      farDist: { value: p.farDist },
      taperDepth: { value: p.taperDepth ?? 0 },
      depthPull: { value: p.depthPull ?? 0 },
      fogNear: { value: p.fogNear },
      fogFar: { value: p.fogFar },
      fogColor: { value: new THREE.Color(p.fogColor) },
      fogAmount: { value: p.fogAmount },
      fadeNear: { value: p.fadeNear },
      fadeFar: { value: p.fadeFar },
      coreWhite: { value: p.coreWhite },
      intensity: { value: p.intensity },
      ...(p.extraUniforms ?? {}),
    },
    transparent: true,
    depthWrite: false,
    depthTest: p.depthTest,
    blending: THREE.CustomBlending,
    blendEquation: p.blendEquation ?? THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  if (p.blendEquation === THREE.MaxEquation) {
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneFactor;
  }
  return mat;
};

// segments: flat array of [x0,y0,z0,x1,y1,z1, ...]; data: same layout, any vec3 per vertex.
export const makeLineSegments = (segments: Float32Array, data: Float32Array, material: THREE.ShaderMaterial) => {
  const geo = new LineSegmentsGeometry();
  geo.setPositions(segments);
  geo.setColors(data);
  const ls = new LineSegments2(geo, material as never);
  ls.frustumCulled = false;
  return ls;
};

export const setLineResolution = (mat: THREE.ShaderMaterial, w: number, h: number, basePx: number) => {
  mat.uniforms.lineResolution.value.set(w, h);
  mat.uniforms.linewidth.value = basePx * (h / 720);
};
