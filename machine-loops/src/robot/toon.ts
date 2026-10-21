// Comic toon shading: two tones per colour plus a small hard highlight, and
// inverted-hull outlines whose width is constant in screen pixels.
import * as THREE from "three";
import { mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paletteLinear } from "../lib/pipeline";

export const LIGHT_DIR = new THREE.Vector3(-0.55, 0.75, 0.6).normalize();

const toonVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const toonFrag = /* glsl */ `
uniform vec3 base;
uniform vec3 shade;
uniform vec3 lightDir; // view space
uniform float highlight;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float d = dot(n, lightDir);
  vec3 col = d > 0.05 ? base : shade;
  vec3 h = normalize(lightDir + normalize(vV));
  float s = pow(max(dot(n, h), 0.0), 60.0);
  if (highlight > 0.5 && s > 0.8) col = mix(col, vec3(1.6), 0.85);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Colours: sRGB hex in, linear out. The base tone is the palette colour as
// written; the shade tone is a darker, slightly cooler version.
const lin = (hex: string) => paletteLinear(hex);
export const toonMaterial = (hex: string, viewLight: THREE.Vector3, opts: { highlight?: boolean; shadeMul?: number } = {}) => {
  const b = lin(hex);
  const s = b.clone().multiplyScalar(opts.shadeMul ?? 0.52);
  s.b = Math.min(1, s.b * 1.08);
  return new THREE.ShaderMaterial({
    vertexShader: toonVert,
    fragmentShader: toonFrag,
    uniforms: {
      base: { value: b },
      shade: { value: s },
      lightDir: { value: viewLight },
      highlight: { value: opts.highlight === false ? 0 : 1 },
    },
  });
};

const outlineVert = /* glsl */ `
uniform vec2 resolution;
uniform float widthPx;
attribute vec3 smoothNormal;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 vn = normalize(normalMatrix * smoothNormal);
  vec2 dir = (projectionMatrix * vec4(vn, 0.0)).xy;
  float l = length(dir);
  dir = l > 1e-5 ? dir / l : vec2(0.0);
  clip.xy += dir * widthPx * 2.0 / resolution * clip.w;
  gl_Position = clip;
}
`;
const outlineFrag = /* glsl */ `
uniform vec3 color;
void main() { gl_FragColor = vec4(color, 1.0); }
`;

export const outlineUniforms = {
  resolution: { value: new THREE.Vector2(3840, 2160) },
  widthPx: { value: 9 },
};

export const outlineMaterial = (hex: string) =>
  new THREE.ShaderMaterial({
    vertexShader: outlineVert,
    fragmentShader: outlineFrag,
    side: THREE.BackSide,
    uniforms: { ...outlineUniforms, color: { value: lin(hex) } },
  });

// Adds a smooth (averaged) normal attribute so the hull doesn't split at
// hard edges.
export const withSmoothNormals = (g: THREE.BufferGeometry) => {
  const pos = g.getAttribute("position");
  const m = mergeVertices(g.clone().deleteAttribute("uv").deleteAttribute("normal"), 1e-4);
  m.computeVertexNormals();
  const sm = toCreasedNormals(m, Math.PI);
  // map smooth normals back to the original vertices by position
  const key = (x: number, y: number, z: number) => `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
  const map = new Map<string, [number, number, number]>();
  const sp = sm.getAttribute("position");
  const sn = sm.getAttribute("normal");
  for (let i = 0; i < sp.count; i++) {
    const k = key(sp.getX(i), sp.getY(i), sp.getZ(i));
    const prev = map.get(k);
    if (prev) {
      prev[0] += sn.getX(i); prev[1] += sn.getY(i); prev[2] += sn.getZ(i);
    } else map.set(k, [sn.getX(i), sn.getY(i), sn.getZ(i)]);
  }
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = map.get(key(pos.getX(i), pos.getY(i), pos.getZ(i))) ?? [0, 1, 0];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    arr[i * 3] = n[0] / l; arr[i * 3 + 1] = n[1] / l; arr[i * 3 + 2] = n[2] / l;
  }
  g.setAttribute("smoothNormal", new THREE.BufferAttribute(arr, 3));
  return g;
};
