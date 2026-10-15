import * as THREE from "three";
import type { Atlas } from "./atlas";

// Instanced, atlas-textured tiles. Each instance has its own transform
// (instanceMatrix), atlas rect and opacity. Faces are lit by a simple
// directional term so tumbling tiles change shade; an optional light sweep
// (a soft band in world space) can cross them.

const VERT = /* glsl */ `
attribute vec4 aRect;
attribute float aAlpha;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = mix(aRect.xy, aRect.zw, uv);
  vAlpha = aAlpha;
  mat4 mm = modelMatrix * instanceMatrix;
  vec4 w = mm * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(mm) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D atlas;
uniform vec3 fogColor;
uniform vec2 fogRange; // start, end (distance from camera)
uniform float fogMax;
uniform float fogMin;
uniform vec3 lightDir;
uniform float shadeAmt;
uniform vec3 sweepColor;
uniform vec2 sweepAxis; // world xy direction of travel (normalised)
uniform float sweepPos; // position along sweepAxis
uniform float sweepWidth;
uniform float useAtlas;
uniform vec3 flatColor;
uniform float gradX; // brightness ramp across world x (left darker)
varying vec2 vUv;
varying float vAlpha;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 c = useAtlas > 0.5 ? texture2D(atlas, vUv).rgb : flatColor;
  float l = dot(normalize(vNormal), normalize(lightDir));
  c *= 1.0 - shadeAmt + shadeAmt * (0.5 + 0.5 * l);
  c *= 1.0 + gradX * clamp(vWorld.x / 9.0, -1.0, 1.0);
  float s = dot(vWorld.xy, sweepAxis) - sweepPos;
  c += sweepColor * exp(-s * s / (sweepWidth * sweepWidth));
  float d = distance(vWorld, cameraPosition);
  float f = mix(fogMin, fogMax, smoothstep(fogRange.x, fogRange.y, d));
  c = mix(c, fogColor, f);
  gl_FragColor = vec4(c, vAlpha);
}
`;

export type TileMaterialOpts = {
  fogColor?: string;
  fogRange?: [number, number];
  fogMax?: number;
  fogMin?: number;
  transparent?: boolean;
  shadeAmt?: number;
  lightDir?: [number, number, number];
  flatColor?: string; // when set, no atlas (slab sides)
  gradX?: number;
};

export const makeTileMaterial = (atlas: Atlas, o: TileMaterialOpts = {}) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      atlas: { value: atlas.texture },
      fogColor: { value: new THREE.Color(o.fogColor ?? "#000000") },
      fogRange: { value: new THREE.Vector2(...(o.fogRange ?? [1e5, 2e5])) },
      fogMax: { value: o.fogMax ?? 0 },
      fogMin: { value: o.fogMin ?? 0 },
      lightDir: { value: new THREE.Vector3(...(o.lightDir ?? [-0.4, 0.6, 1])) },
      shadeAmt: { value: o.shadeAmt ?? 0 },
      sweepColor: { value: new THREE.Color(0, 0, 0) },
      sweepAxis: { value: new THREE.Vector2(1, 0) },
      sweepPos: { value: -1e4 },
      sweepWidth: { value: 1 },
      useAtlas: { value: o.flatColor ? 0 : 1 },
      flatColor: { value: new THREE.Color(o.flatColor ?? "#ffffff") },
      gradX: { value: o.gradX ?? 0 },
    },
    transparent: o.transparent ?? false,
    side: THREE.DoubleSide,
  });

const attach = (geo: THREE.BufferGeometry, count: number) => {
  const rect = new Float32Array(count * 4);
  const alpha = new Float32Array(count).fill(1);
  const rectAttr = new THREE.InstancedBufferAttribute(rect, 4);
  const alphaAttr = new THREE.InstancedBufferAttribute(alpha, 1);
  geo.setAttribute("aRect", rectAttr);
  geo.setAttribute("aAlpha", alphaAttr);
  return {
    setRect: (i: number, r: readonly number[]) => {
      rect.set(r, i * 4);
      rectAttr.needsUpdate = true;
    },
    setAlpha: (i: number, a: number) => {
      alpha[i] = a;
      alphaAttr.needsUpdate = true;
    },
  };
};

// Flat tile in the XY plane, `w` wide × w·aspect high, centred.
export const makeTileMesh = (atlas: Atlas, count: number, material: THREE.Material, w = 1) => {
  const geo = new THREE.PlaneGeometry(w, w * atlas.aspect);
  const a = attach(geo, count);
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  return { mesh, ...a };
};

// Thin slab: atlas on the front (+z) face, flat material on the sides/back.
export const makeSlabMesh = (
  atlas: Atlas,
  count: number,
  face: THREE.Material,
  side: THREE.Material,
  w: number,
  depth: number,
) => {
  const geo = new THREE.BoxGeometry(w, w * atlas.aspect, depth);
  const a = attach(geo, count);
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z
  const mesh = new THREE.InstancedMesh(geo, [side, side, side, side, face, side], count);
  mesh.frustumCulled = false;
  return { mesh, ...a };
};
