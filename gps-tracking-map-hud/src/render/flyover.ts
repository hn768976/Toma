// three.js (WebGL2) flyover renderer.
// The city is baked once into high-resolution, mipmapped, anisotropically
// filtered texture tiles (line SDF shader, world-space widths, 4x MSAA), then
// drawn on a ground plane seen in perspective. Scene renders go to half-float
// targets; a post pass mixes moves (soft-focus dissolve), adds slice glitches,
// vignette and a +-1/255 dither (never on pure black).
import * as THREE from 'three';
import { CITY, MAP_W, MAP_H } from '../city';
import type { RoadClass } from '../city/generate';

// Colours are used exactly as written (no sRGB<->linear conversion anywhere).
export const raw = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return new THREE.Color().setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace);
};

export interface FlyStyle {
  land: string; dark: string; water: string; runway: string;
  roads: Record<RoadClass, { color: string; w: number; a: number }>; // w = width in metres
}

const BAKE_VS = `
attribute vec2 aP0;
attribute vec2 aP1;
attribute vec2 aCorner;
uniform float uHalfW;
uniform float uFeather;
varying vec2 vLocal;
varying float vLen;
void main() {
  vec2 a = aP0, b = aP1;
  vec2 d = b - a;
  float L = length(d);
  vec2 t = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float e = uHalfW + uFeather * 1.5;
  vec2 pos = mix(a, b, aCorner.x) + t * (aCorner.x * 2.0 - 1.0) * e + n * aCorner.y * e;
  vLocal = vec2(dot(pos - a, t), dot(pos - a, n));
  vLen = L;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos.x, 0.0, pos.y, 1.0);
}`;
const BAKE_FS = `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uHalfW;
uniform float uFeather;
varying vec2 vLocal;
varying float vLen;
void main() {
  float ax = clamp(vLocal.x, 0.0, vLen);
  float dd = length(vec2(vLocal.x - ax, vLocal.y));
  float a = clamp((uHalfW - dd) / uFeather + 0.5, 0.0, 1.0) * uAlpha;
  gl_FragColor = vec4(uColor, a);
}`;

const GROUND_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GROUND_FS = `
uniform sampler2D uMap;
uniform float uBlur;
uniform float uFocus;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float sy = gl_FragCoord.y / uRes.y;
  float bias = uBlur + uFocus * smoothstep(0.62, 1.0, sy) * 2.2;
  vec3 c = texture2D(uMap, vUv, bias).rgb;
  c *= 1.0 - 0.15 * smoothstep(0.6, 1.0, sy);
  gl_FragColor = vec4(c, 1.0);
}`;

export const POST_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export const POST_FS = `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
uniform float uGlitch;
uniform float uSeed;
uniform float uVig;
uniform float uBright;
uniform vec2 uRes;
varying vec2 vUv;
float h1(float x) { return fract(sin(x * 91.3458 + uSeed * 17.13) * 47453.5453); }
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 uv = vUv;
  float off = 0.0;
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 22.0);
    float r = h1(band);
    if (r > 0.55) off = (h1(band + 7.0) - 0.5) * 0.12 * uGlitch;
    float fine = floor(uv.y * 160.0);
    if (h1(fine + 3.0) > 0.93) off += (h1(fine) - 0.5) * 0.03 * uGlitch;
  }
  vec2 u2 = vec2(uv.x + off, uv.y);
  vec3 a = texture2D(uA, u2).rgb;
  vec3 b = texture2D(uB, u2).rgb;
  vec3 c = mix(a, b, uMix);
  // soft bloom from the mip chain of the half-float targets
  vec3 bl = mix(texture2D(uA, u2, 3.0).rgb * 0.6 + texture2D(uA, u2, 5.0).rgb * 0.4, texture2D(uB, u2, 3.0).rgb * 0.6 + texture2D(uB, u2, 5.0).rgb * 0.4, uMix);
  c = mix(c, mix(texture2D(uA, u2, 1.0).rgb, texture2D(uB, u2, 1.0).rgb, uMix), 0.25) + bl * 0.28;
  if (uGlitch > 0.0 && off != 0.0) {
    c.r = mix(a, b, uMix).r;
    c.b = mix(texture2D(uA, u2 + vec2(0.004 * uGlitch, 0.0)).b, texture2D(uB, u2 + vec2(0.004 * uGlitch, 0.0)).b, uMix);
    c *= 1.0 + 0.25 * uGlitch;
  }
  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - uVig * smoothstep(0.35, 1.15, length(q));
  c *= uBright;
  float m = max(c.r, max(c.g, c.b));
  if (m > 0.5 / 255.0) c += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 17.0) - 1.0) / 255.0;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;

// ---- bake configuration
export const TEXEL = 0.8; // metres per texel in the detailed tiles
const TILE = 2048;
const TILE_M = TILE * TEXEL;
// detailed region (map coordinates) – covers every camera move's near field
export const REGION = { x0: 1200, y0: 400, nx: 7, ny: 4 };
const LOWRES = 2048; // whole generated area at low resolution (far field)
const EXTM = 2200;

function lineGeometry(cls: RoadClass) {
  const p0: number[] = [], p1: number[] = [], cr: number[] = [], idx: number[] = [];
  let n = 0;
  for (const r of CITY.raw.roads) {
    if (r.cls !== cls) continue;
    const p = r.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      for (const [cx, cy] of [[0, -1], [1, -1], [1, 1], [0, 1]]) { p0.push(p[i], p[i + 1]); p1.push(p[i + 2], p[i + 3]); cr.push(cx, cy); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('aP0', new THREE.Float32BufferAttribute(p0, 2));
  g.setAttribute('aP1', new THREE.Float32BufferAttribute(p1, 2));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(cr, 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((p0.length / 2) * 3), 3));
  g.setIndex(idx);
  return g;
}

function polyMesh(pts: number[], color: string) {
  const shape = new THREE.Shape();
  for (let i = 0; i < pts.length; i += 2) (i ? shape.lineTo(pts[i], pts[i + 1]) : shape.moveTo(pts[i], pts[i + 1]));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(Math.PI / 2); // (x, y) -> (x, 0, y)
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: raw(color), side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
  m.frustumCulled = false;
  return m;
}

export function buildBakeScene(style: FlyStyle) {
  const scene = new THREE.Scene();
  scene.background = raw(style.land);
  let order = 0;
  const kinds: [string, string][] = [['airport', style.dark], ['park', style.dark], ['block', style.dark], ['yard', style.dark], ['sea', style.water], ['river', style.water], ['pier', style.land], ['runway', style.runway]];
  for (const [kind, col] of kinds) for (const p of CITY.raw.polys) if (p.kind === kind) { const m = polyMesh(p.pts, col); m.renderOrder = order++; scene.add(m); }
  const lineMats: THREE.ShaderMaterial[] = [];
  for (const cls of ['rail', 'lane', 'street', 'avenue', 'highway'] as RoadClass[]) {
    const st = style.roads[cls];
    const mat = new THREE.ShaderMaterial({
      vertexShader: BAKE_VS, fragmentShader: BAKE_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: raw(st.color) }, uAlpha: { value: st.a }, uHalfW: { value: st.w / 2 }, uFeather: { value: TEXEL } },
    });
    lineMats.push(mat);
    const mesh = new THREE.Mesh(lineGeometry(cls), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1000 + order++;
    scene.add(mesh);
  }
  return { scene, lineMats };
}

function bakeOne(gl: THREE.WebGLRenderer, scene: THREE.Scene, lineMats: THREE.ShaderMaterial[], x0: number, y0: number, size: number, px: number, feather: number) {
  const rt = new THREE.WebGLRenderTarget(px, px, {
    samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    colorSpace: THREE.NoColorSpace, depthBuffer: false,
  });
  rt.texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  // ortho camera looking down (-y), map y -> world z
  const cam = new THREE.OrthographicCamera(x0, x0 + size, -y0, -(y0 + size), 0.1, 100);
  cam.position.set(0, 10, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  for (const m of lineMats) m.uniforms.uFeather.value = feather;
  gl.setRenderTarget(rt);
  gl.render(scene, cam);
  gl.setRenderTarget(null);
  return rt;
}

export interface Ground { group: THREE.Group; mats: THREE.ShaderMaterial[]; targets: THREE.WebGLRenderTarget[] }

export function bakeGround(gl: THREE.WebGLRenderer, style: FlyStyle, res: THREE.Vector2): Ground {
  const { scene, lineMats } = buildBakeScene(style);
  const group = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  const targets: THREE.WebGLRenderTarget[] = [];
  const mk = (rt: THREE.WebGLRenderTarget, x0: number, y0: number, size: number, order: number) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VS, fragmentShader: GROUND_FS, depthTest: false, depthWrite: false,
      uniforms: { uMap: { value: rt.texture }, uBlur: { value: 0 }, uFocus: { value: 1 }, uRes: { value: res } },
    });
    mats.push(mat);
    targets.push(rt);
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2); // in XZ plane, facing up; uv (0,0) at (-s/2, +s/2)
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x0 + size / 2, 0, y0 + size / 2);
    m.renderOrder = order;
    m.frustumCulled = false;
    group.add(m);
  };
  // far field: whole generated area, low resolution
  const W = MAP_W + 2 * EXTM, H = MAP_H + 2 * EXTM, S = Math.max(W, H);
  const lowRt = bakeOne(gl, scene, lineMats, -EXTM, -EXTM, S, LOWRES, S / LOWRES);
  mk(lowRt, -EXTM, -EXTM, S, 0);
  for (let j = 0; j < REGION.ny; j++) for (let i = 0; i < REGION.nx; i++) {
    const x0 = REGION.x0 + i * TILE_M, y0 = REGION.y0 + j * TILE_M;
    const rt = bakeOne(gl, scene, lineMats, x0, y0, TILE_M, TILE, TEXEL);
    mk(rt, x0, y0, TILE_M, 1);
  }
  // free bake geometry
  scene.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
  return { group, mats, targets };
}

// ---- camera moves
export const MOVE = 120; // 5 moves x 4 s
export interface Shot { tx: number; ty: number; yaw: number; pitch: number; dist: number }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

export function moves(): [Shot, Shot][] {
  const c = CITY.raw.center;
  const cl = CITY.raw.coastLine;
  // a coastal point inside the detailed region
  let ci = 0;
  for (let i = 0; i < cl.length; i += 2) if (cl[i] > 3000 && cl[i] < 6500 && cl[i + 1] > 1500 && cl[i + 1] < 6000) { ci = i; break; }
  const k2 = Math.min(cl.length - 2, ci + 2 * 140);
  const coastA = { x: cl[ci], y: cl[ci + 1] }, coastB = { x: cl[k2], y: cl[k2 + 1] };
  const along = Math.atan2(coastB.y - coastA.y, coastB.x - coastA.x);
  const j = CITY.pois.reduce((b, p) => (Math.hypot(p.x - 7200, p.y - 3400) < Math.hypot(b.x - 7200, b.y - 3400) ? p : b), CITY.pois[0]);
  const d2r = Math.PI / 180;
  return [
    // 1 glide along the coast, looking inland
    [{ tx: coastA.x + 900, ty: coastA.y - 1500, yaw: along - 0.75, pitch: 52 * d2r, dist: 5800 }, { tx: coastB.x + 900, ty: coastB.y - 1500, yaw: along - 0.65, pitch: 52 * d2r, dist: 5800 }],
    // 2 push towards the central district
    [{ tx: c.x + 600, ty: c.y - 400, yaw: -1.15, pitch: 48 * d2r, dist: 8600 }, { tx: c.x + 400, ty: c.y - 300, yaw: -1.1, pitch: 52 * d2r, dist: 5800 }],
    // 3 turn over a highway junction
    [{ tx: j.x, ty: j.y, yaw: -0.4, pitch: 50 * d2r, dist: 6200 }, { tx: j.x, ty: j.y, yaw: 0.45, pitch: 50 * d2r, dist: 6200 }],
    // 4 high pull-back
    [{ tx: c.x + 1800, ty: c.y - 600, yaw: -0.9, pitch: 48 * d2r, dist: 6200 }, { tx: c.x + 1900, ty: c.y - 700, yaw: -0.85, pitch: 45 * d2r, dist: 10500 }],
    // 5 low glide
    [{ tx: c.x + 3400, ty: c.y - 1700, yaw: 2.35, pitch: 55 * d2r, dist: 5200 }, { tx: c.x + 2600, ty: c.y - 900, yaw: 2.3, pitch: 55 * d2r, dist: 5200 }],
  ];
}

export function shotAt(mv: [Shot, Shot], t: number): Shot {
  const e = ease(Math.min(1, Math.max(0, t)));
  const [a, b] = mv;
  return { tx: lerp(a.tx, b.tx, e), ty: lerp(a.ty, b.ty, e), yaw: lerp(a.yaw, b.yaw, e), pitch: lerp(a.pitch, b.pitch, e), dist: lerp(a.dist, b.dist, e) };
}

export function placeCamera(cam: THREE.PerspectiveCamera, s: Shot) {
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw);
  const hd = s.dist * Math.sin(s.pitch), h = s.dist * Math.cos(s.pitch);
  cam.position.set(s.tx - dx * hd, h, s.ty - dz * hd);
  cam.up.set(0, 1, 0);
  cam.lookAt(s.tx, 0, s.ty);
  cam.updateMatrixWorld();
}
