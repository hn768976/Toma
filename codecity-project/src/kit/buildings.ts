import * as THREE from "three";
import { GLSL_LINES, GLSL_SKY, SkyParams } from "../lib/glsl";
import { Box } from "./city";

// Instanced geometry for `copies` copies of a periodic block, spaced `period`
// apart along -z (copy 0 at z in [0, period], copy k at z - k * period).
export function buildingGeometry(boxes: Box[], period: number, copies: number, firstCopy = -1) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("normal", base.getAttribute("normal"));
  const n = boxes.length * copies;
  const off = new Float32Array(n * 3);
  const size = new Float32Array(n * 3);
  const par = new Float32Array(n * 2);
  let i = 0;
  for (let c = 0; c < copies; c++) {
    const k = firstCopy + c;
    for (const b of boxes) {
      off.set([b.x, b.y0, -(b.z + k * period)], i * 3);
      size.set([b.w, b.h, b.d], i * 3);
      par.set([b.seed, b.kind], i * 2);
      i++;
    }
  }
  geo.setAttribute("iOffset", new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 3));
  geo.setAttribute("iParams", new THREE.InstancedBufferAttribute(par, 2));
  geo.instanceCount = n;
  return geo;
}

export type BuildingStyle = {
  mode: "glass" | "solid";
  body: THREE.Color; // face colour (linear)
  bodyAlpha: number;
  line: THREE.Color; // edges, floor lines, mullions
  lineAlpha: number;
  edgeW: number; // half width in metres
  floorW: number;
  floorH: number;
  mullion: number; // spacing in metres
  windowLit: number; // fraction of lit windows (glass mode)
  window: THREE.Color;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  // Lighter toward the horizon (solid mode): colour the far fog blends to.
  hazeHeight: number;
  mirror: number; // 1 normal, -1 drawn mirrored under the floor
  brightness: number;
  sky?: SkyParams;
};

export const skyUniforms = (k?: SkyParams) => ({
  uSkyTop: { value: new THREE.Vector3(...(k?.top ?? [0, 0, 0])) },
  uSkyHorizon: { value: new THREE.Vector3(...(k?.horizon ?? [0, 0, 0])) },
  uGlow: { value: new THREE.Vector3(...(k?.glow ?? [0, 0, 0])) },
  uGlowDir: { value: new THREE.Vector3(...(k?.glowDir ?? [0, 0, -1])) },
  uGlowW: { value: new THREE.Vector2(...(k?.glowW ?? [1, 1])) },
  uGlow2: { value: new THREE.Vector3(...(k?.glow2 ?? [0, 0, 0])) },
});

const VERT = /* glsl */ `
attribute vec3 iOffset;
attribute vec3 iSize;
attribute vec2 iParams;
uniform float uMirror;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vSize;
varying vec2 vParams;
varying vec3 vWorld;
varying float vDist;
void main() {
  vec3 lp = position * iSize;
  vLocal = lp;
  vN = normal;
  vSize = iSize;
  vParams = iParams;
  vec3 wp = lp + iOffset;
  wp.y *= uMirror;
  vec4 w = modelMatrix * vec4(wp, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
${GLSL_LINES}
${GLSL_SKY}
uniform float uGlass;
uniform vec3 uBody;
uniform float uBodyAlpha;
uniform vec3 uLine;
uniform float uLineAlpha;
uniform float uEdgeW;
uniform float uFloorW;
uniform float uFloorH;
uniform float uMullion;
uniform float uWindowLit;
uniform vec3 uWindow;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uHazeH;
uniform float uBright;
uniform float uMirror;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vSize;
varying vec2 vParams;
varying vec3 vWorld;
varying float vDist;

void main() {
  vec3 an = abs(vN);
  // Face coordinates: u across the face, v up (or along, for roofs).
  float u, v, hu, hv;
  float faceId;
  if (an.y > 0.5) { u = vLocal.x; v = vLocal.z; hu = vSize.x * 0.5; hv = vSize.z * 0.5; faceId = 4.0; }
  else if (an.x > 0.5) { u = vLocal.z; v = vLocal.y; hu = vSize.z * 0.5; hv = vSize.y * 0.5; faceId = vN.x > 0.0 ? 0.0 : 1.0; }
  else { u = vLocal.x; v = vLocal.y; hu = vSize.x * 0.5; hv = vSize.y * 0.5; faceId = vN.z > 0.0 ? 2.0 : 3.0; }
  bool vertical = an.y < 0.5;
  float vc = vertical ? v - hv : v; // centred v

  // Box edges.
  float pxu = max(fwidth(u), 1e-5);
  float pxv = max(fwidth(v), 1e-5);
  float edge = max(lineAt(hu - abs(u), uEdgeW, pxu), lineAt(hv - abs(vc), uEdgeW, pxv));

  float kind = vParams.y;
  float seed = vParams.x;
  float lines = 0.0;
  float win = 0.0;
  if (vertical && kind < 0.5) {
    // Floor lines and mullions. Some buildings get only floor lines.
    float floorL = gridLines(v, uFloorH, uFloorW);
    float mullS = uMullion * (0.6 + floor(seed * 3.0) * 0.4);
    float mull = gridLines(u + hu, mullS, uFloorW * 0.8) * step(0.3, fract(seed * 7.13));
    lines = max(floorL, mull * 0.8);
    if (uGlass > 0.5) {
      // Lit windows: a cell per floor x mullion bay, hashed per building/face.
      float fi = floor(v / uFloorH);
      float ci = floor((u + hu) / mullS);
      float h = hash31(vec3(fi * 1.37 + faceId * 17.0, ci * 3.11, seed * 911.0));
      // Lit cells cluster in vertical runs, like the reference.
      float runs = hash21(vec2(ci * 5.3 + faceId, seed * 400.0));
      // Clusters: a coarse block noise decides which parts of a face are "occupied".
      float blk = hash31(vec3(floor(fi / 4.0) * 7.1 + faceId * 3.0, floor(ci / 3.0) * 2.3, seed * 97.0));
      // More lit windows low down, fewer near the top.
      float hb = 2.0 * exp(-v / 30.0) + 0.15;
      float lit = step(1.0 - uWindowLit * 2.6 * hb * step(0.6, blk) * (0.6 + runs * 0.8), h);
      vec2 cell = vec2(fract((u + hu) / mullS), fract(v / uFloorH));
      vec2 cpx = vec2(fwidth(cell.x), fwidth(cell.y));
      // Varied window sizes: short dashes to long bars.
      float wv = hash31(vec3(fi, ci, seed * 13.0));
      vec2 lo = vec2(0.1 + 0.3 * wv, 0.42 - 0.12 * step(0.8, wv));
      vec2 hi = vec2(0.9 - 0.25 * fract(wv * 7.0), 0.62);
      vec2 inr = smoothstep(lo - cpx, lo + cpx, cell) * (1.0 - smoothstep(hi - cpx, hi + cpx, cell));
      float rect = inr.x * inr.y;
      // Far away cells are sub-pixel: use their average.
      float cellPx = min(mullS / pxu, uFloorH / pxv);
      float near = smoothstep(2.0, 6.0, cellPx);
      win = mix(uWindowLit * 0.4 * 0.72 * 0.2, lit * rect, near) * step(uFloorH * 0.5, v) * step(v, vSize.y - uFloorH * 0.3);
    }
  }
  if (kind > 0.5 && kind < 1.5) lines = 0.0;

  float fogT = smoothstep(uFogNear, uFogFar, vDist);
  vec3 col;
  float alpha;
  if (uGlass > 0.5) {
    // Additive glass: faint body, bright edges and lines, lit windows.
    vec3 body = uBody * uBodyAlpha;
    // Fresnel-ish: faces seen at grazing angles look denser.
    vec3 vdir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(vdir, normalize(vN * vec3(1.0, uMirror, 1.0)))), 2.0);
    body *= 0.5 + 0.9 * fres;
    // Brighter toward the base (ground glow).
    float base = exp(-max(vWorld.y * uMirror, 0.0) / 22.0);
    col = body * (0.8 + 2.4 * base) + uLine * base * 0.06 + uLine * uLineAlpha * (edge + lines * 0.45) + uWindow * win;
    col *= uBright * (1.0 - fogT);
    alpha = 1.0;
  } else {
    // Solid: deep body, thin lines, hazing toward the horizon colour.
    float height01 = clamp(vWorld.y * uMirror / uHazeH, 0.0, 1.0);
    // Face shading (faces toward the camera end are lit) and per-building tint.
    float shade = an.z > 0.5 ? (vN.z > 0.0 ? 1.35 : 0.8) : (an.x > 0.5 ? 0.95 : 1.5);
    shade *= 0.8 + 0.45 * fract(seed * 13.7);
    vec3 body = uBody * shade * (0.8 + 0.6 * height01);
    float ln = max(edge * 1.0, lines * 0.6) * uLineAlpha;
    col += uLine * edge * 0.6 * uLineAlpha;
    col = mix(body, uLine, ln);
    // Height haze: low parts fade into the glow sooner.
    float haze = max(clamp(fogT * (1.15 - 0.5 * height01), 0.0, 1.0), smoothstep(0.7, 1.0, fogT));
    vec3 fogC = skyCol(normalize(vWorld - cameraPosition));
    col = mix(col * uBright, fogC, haze);
    alpha = 1.0;
  }
  gl_FragColor = vec4(col, alpha);
}
`;

export function buildingMaterial(s: BuildingStyle) {
  const glass = s.mode === "glass";
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uGlass: { value: glass ? 1 : 0 },
      uBody: { value: s.body },
      uBodyAlpha: { value: s.bodyAlpha },
      uLine: { value: s.line },
      uLineAlpha: { value: s.lineAlpha },
      uEdgeW: { value: s.edgeW },
      uFloorW: { value: s.floorW },
      uFloorH: { value: s.floorH },
      uMullion: { value: s.mullion },
      uWindowLit: { value: s.windowLit },
      uWindow: { value: s.window },
      uFog: { value: s.fogColor },
      uFogNear: { value: s.fogNear },
      uFogFar: { value: s.fogFar },
      uHazeH: { value: s.hazeHeight },
      uBright: { value: s.brightness },
      uMirror: { value: s.mirror },
      ...skyUniforms(s.sky),
    },
    transparent: glass,
    depthWrite: !glass,
    depthTest: true,
    blending: glass ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: glass || s.mirror < 0 ? THREE.DoubleSide : THREE.FrontSide,
  });
}
