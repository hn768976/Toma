import * as THREE from "three";
import { GLSL_AALINE, GLSL_HASH } from "../../lib/glsl";
import { GlyphAtlas, SpriteLayer, colorRGBA, RGBA } from "../../lib/glyphs";
import { FONT_MONO } from "../../lib/assets";
import { hash01, mod, mulberry32, TAU } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";
import { GLSL_TOPO_HEIGHT, TOPO_T, topoHeight } from "./terrain";

export type TopoVersion = {
  id: string;
  contour: string; // contour line colour
  base: string; // terrain base colour
  haze: string; // horizon haze colour
  gold: string; // city lights
  tagMode: "values" | "bigdata"; // framed tags: values only, or BIG DATA + boxed values
  tagCount: number; // framed tags per tile
  seed: number;
};

const LOOP = 600;
const K = 3; // tiles replicated along z
const Z_NEAR = 6; // world z where wrapped objects re-enter (behind camera)
const Z_SPAN = K * TOPO_T;

const CAM_H = 8.5;

const terrainVert = /* glsl */ `
${GLSL_TOPO_HEIGHT}
uniform float uOffset;
out vec2 vT; out float vDist; out float vH;
void main(){
  vec3 p = position;
  vec2 t = vec2(p.x, p.z - uOffset);
  float h = topoHeight(t);
  p.y = h;
  vT = t; vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const terrainFrag = /* glsl */ `
precision highp float;
precision highp int;
${GLSL_TOPO_HEIGHT}
${GLSL_HASH}
${GLSL_AALINE}
uniform vec3 uLine; uniform vec3 uBase; uniform vec3 uHaze; uniform vec3 uTile;
uniform float uPx; uniform float uFogNear; uniform float uFogFar; uniform float uStep;
in vec2 vT; in float vDist; in float vH;
out vec4 o;
float aaDots(vec2 p, float r){
  vec2 fw = max(fwidth(p), vec2(1e-5));
  vec2 d = (abs(fract(p) - 0.5)) / fw;
  float dist = length(d);
  float cov = 1.0 - smoothstep(r - 0.6, r + 0.6, dist);
  float meanCov = clamp(3.14159 * r * r * fw.x * fw.y, 0.0, 1.0);
  float fade = smoothstep(3.0, 7.0, 1.0 / max(fw.x, fw.y));
  return mix(meanCov, cov, fade);
}
void main(){
  float h = topoHeight(vT);
  float c = h / uStep;
  float w = 0.9 * uPx + 0.22;
  float minor = aaLine(c, w);
  float major = aaLine(c / 5.0, w * 1.5);
  // dotted look along the lines (fine world-space dot lattice)
  float dots = aaDots(vT * 2.6, 2.2 * uPx + 0.55);
  float dotMean = clamp(3.14159 * pow(2.2*uPx+0.55, 2.0) * pow(fwidth(vT.x*2.6),2.0), 0.0, 1.0);
  float lineMask = max(minor * mix(0.55, 1.0, dots), major);
  // brighter where contours bunch up (steep slopes)
  float steep = clamp(length(vec2(dFdx(h), dFdy(h))) / max(length(vec2(dFdx(vT.x), dFdy(vT.y))), 1e-4), 0.0, 3.0);
  float lum = 0.55 + 0.35 * smoothstep(0.2, 1.5, steep) + 0.25 * smoothstep(-3.0, 4.0, h);
  vec3 col = uBase * (0.75 + 0.5 * smoothstep(-6.0, 5.0, h));
  col += uLine * lineMask * lum * (1.0 + 1.2 * major);
  // faint square grid
  float grid = max(aaLine(vT.x / 8.0, 0.8*uPx+0.3), aaLine(vT.y / 8.0, 0.8*uPx+0.3));
  col += uLine * grid * 0.32;
  // scattered dim tiles
  vec2 cell = floor(vT / 1.5);
  ivec2 ci = ivec2(int(cell.x) + 4096, int(mod(cell.y, ${TOPO_T / 1.5}.0)));
  float r = hash12i(ci);
  if (r < 0.03) {
    vec2 f = fract(vT / 1.5);
    vec2 fw = fwidth(vT / 1.5);
    float inside = smoothstep(0.12 - fw.x, 0.12 + fw.x, f.x) * smoothstep(0.88 + fw.x, 0.88 - fw.x, f.x) * smoothstep(0.3 - fw.y, 0.3 + fw.y, f.y) * smoothstep(0.7 + fw.y, 0.7 - fw.y, f.y);
    col += uTile * inside * (0.25 + 0.5 * fract(r * 97.0));
  }
  float fog = smoothstep(uFogNear, uFogFar, vDist);
  col = mix(col, uHaze, fog);
  o = vec4(col, 1.0);
}`;

const skyVert = /* glsl */ `
out vec3 vDir;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const skyFrag = /* glsl */ `
precision highp float;
uniform vec3 uHaze; uniform vec3 uTop; uniform vec3 uGlow;
in vec3 vDir; out vec4 o;
void main(){
  vec3 d = normalize(vDir);
  float e = d.y;
  vec3 col = mix(uHaze, uTop, smoothstep(-0.02, 0.35, e));
  float g = exp(-max(e + 0.01, 0.0) * 18.0) * exp(-pow(atan(d.x, -d.z) * 2.2, 2.0));
  col += uGlow * g;
  o = vec4(col, 1.0);
}`;

function pinIcon(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // classic map pin: circle head + pointed tail, with a hole
  const cx = w / 2, r = w * 0.34, cy = r + w * 0.08;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.97);
  ctx.bezierCurveTo(cx - r * 0.35, h * 0.72, cx - r, cy + r * 0.75, cx - r, cy);
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.bezierCurveTo(cx + r, cy + r * 0.75, cx + r * 0.35, h * 0.72, cx, h * 0.97);
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}
function softDot(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.9)");
  g.addColorStop(0.55, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function triIcon(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.18);
  ctx.lineTo(w * 0.9, h * 0.85);
  ctx.lineTo(w * 0.1, h * 0.85);
  ctx.closePath();
  ctx.fill();
}

const PIN = "", DOT = "", TRI = "";

type Pin = { x: number; z: number; y: number; value: number; tri: boolean; showPin: boolean; tick: boolean };
type Tag = { x: number; z: number; y: number; pole: number; big: boolean; value: number };
type Light = { x: number; z: number; y: number; size: number; phase: number; k: number; b: number };

function fmt(v: number) {
  return v.toFixed(2);
}

export const makeTopoLook = (v: TopoVersion): LookFactory => (ctx) => {
  const rng = mulberry32(v.seed);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, ctx.width / ctx.height, 0.3, 420);

  const cLine = new THREE.Color(v.contour);
  const cBase = new THREE.Color(v.base);
  const cHaze = new THREE.Color(v.haze);

  // ---- terrain mesh: denser rows near the camera
  const cols = 420, rows = 520;
  const xHalf = 230, zNear = 8, zFar = -330;
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  let k = 0;
  for (let j = 0; j <= rows; j++) {
    const t = Math.pow(j / rows, 1.9);
    const z = zNear + (zFar - zNear) * t;
    for (let i = 0; i <= cols; i++) {
      pos[k++] = -xHalf + (2 * xHalf * i) / cols;
      pos[k++] = 0;
      pos[k++] = z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  tg.setIndex(idx);
  const terrainMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: terrainVert,
    fragmentShader: terrainFrag,
    uniforms: {
      uOffset: { value: 0 },
      uLine: { value: cLine.clone().multiplyScalar(0.55) },
      uBase: { value: cBase },
      uHaze: { value: cHaze },
      uTile: { value: cLine.clone().multiplyScalar(0.22) },
      uPx: { value: ctx.pxScale },
      uFogNear: { value: 60 },
      uFogFar: { value: 280 },
      uStep: { value: 0.12 },
    },
    side: THREE.DoubleSide,
  });
  const terrain = new THREE.Mesh(tg, terrainMat);
  terrain.frustumCulled = false;
  scene.add(terrain);

  // ---- sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 64, 32),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        uHaze: { value: cHaze },
        uTop: { value: cBase.clone().multiplyScalar(0.35) },
        uGlow: { value: cLine.clone().multiplyScalar(0.12) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // ---- sprites
  const atlas = new GlyphAtlas({
    font: `700 96px ${FONT_MONO}`,
    fontPx: 96,
    chars: "0123456789.-+% BIGDAT",
    cellW: 80,
    cellH: 128,
    icons: { [PIN]: pinIcon, [DOT]: softDot, [TRI]: triIcon },
  });
  const sprites = new SpriteLayer(atlas, 30000, { billboard: true, fogNear: 60, fogFar: 260 });
  const labels = new SpriteLayer(atlas, 20000, { billboard: true, fogNear: 70, fogFar: 270, depthTest: false });
  labels.mesh.renderOrder = 2;
  scene.add(sprites.mesh);
  scene.add(labels.mesh);

  // ---- per-tile content (generated once from the seed, periodic in z)
  const pins: Pin[] = [];
  for (let i = 0; i < 64; i++) {
    const x = (rng() * 2 - 1) * 46;
    const z = -rng() * TOPO_T;
    pins.push({ x, z, y: 0, value: 20 + rng() * 680, tri: rng() < 0.22, showPin: rng() < 0.62, tick: rng() < 0.35 });
  }
  const tags: Tag[] = [];
  for (let i = 0; i < v.tagCount; i++) {
    const x = (rng() * 2 - 1) * 42;
    const z = -((i + rng() * 0.8) / v.tagCount) * TOPO_T;
    tags.push({ x, z, y: 0, pole: 3.2 + rng() * 4.5, big: v.tagMode === "bigdata" && rng() < 0.55, value: 100 + rng() * 600 });
  }
  const lights: Light[] = [];
  // clusters in low areas: candidate centres, keep the lowest
  for (let c = 0; c < 40; c++) {
    let best = { x: 0, z: 0, h: 1e9 };
    for (let s = 0; s < 14; s++) {
      const x = (rng() * 2 - 1) * 90;
      const z = -rng() * TOPO_T;
      const h = topoHeight(x, z);
      if (h < best.h) best = { x, z, h };
    }
    const n = 30 + Math.floor(rng() * 70);
    const spread = 1.5 + rng() * 4;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, r = spread * Math.sqrt(-2 * Math.log(1 - rng() * 0.999)) * 0.6;
      const x = best.x + Math.cos(a) * r;
      const z = best.z + Math.sin(a) * r * 0.8;
      lights.push({ x, z, y: 0, size: 0.12 + rng() * 0.14, phase: rng(), k: 1 + Math.floor(rng() * 3), b: 0.5 + rng() * 0.8 });
    }
  }
  // sprinkle single dots
  for (let i = 0; i < 260; i++) {
    const x = (rng() * 2 - 1) * 110, z = -rng() * TOPO_T;
    if (topoHeight(x, z) < -0.6) lights.push({ x, z, y: 0, size: 0.1 + rng() * 0.1, phase: rng(), k: 1 + Math.floor(rng() * 3), b: 0.4 + rng() * 0.6 });
  }
  for (const p of pins) p.y = topoHeight(p.x, p.z);
  for (const t of tags) t.y = topoHeight(t.x, t.z);
  for (const l of lights) l.y = topoHeight(l.x, l.z) + 0.05;

  const white = colorRGBA("#ffffff", 1, 1.6);
  const labelCol = colorRGBA("#e8fbff", 0.95, 1.1);
  const triCol = colorRGBA("#ffa02a", 1, 2.0);
  const gold = new THREE.Color(v.gold);
  const lineTint = colorRGBA(v.contour, 1, 1.8);

  // world z of an object at tile-local z, copy j, for camera offset
  const wrapZ = (zLocal: number, j: number, offset: number) => Z_NEAR - mod(Z_NEAR - (zLocal - j * TOPO_T + offset), Z_SPAN);

  return {
    scene,
    camera,
    grainFrame: (f) => f % LOOP,
    update(frame) {
      const f = mod(frame, LOOP);
      const ph = f / LOOP;
      const offset = TOPO_T * ph;
      terrainMat.uniforms.uOffset.value = offset;

      // camera: low, gliding forward (world moves +z), slow sway on whole cycles
      const sway = Math.sin(TAU * ph) * 1.2;
      camera.position.set(sway, CAM_H + Math.sin(TAU * ph * 2) * 0.25, 0);
      camera.rotation.order = "YXZ";
      camera.rotation.set(-18 * (Math.PI / 180), Math.sin(TAU * ph) * 0.02, 0);
      camera.updateMatrixWorld();

      sprites.begin();
      labels.begin();
      // city lights
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i];
        const tw = 0.55 + 0.45 * Math.sin(TAU * (l.k * ph + l.phase));
        const a = l.b * tw;
        const c: RGBA = [gold.r * 3.5 * a, gold.g * 3.5 * a, gold.b * 3.5 * a, 1];
        for (let j = 0; j < K; j++) {
          const z = wrapZ(l.z, j, offset);
          sprites.icon(DOT, l.x, l.y, z, l.size, c, -0.5, -0.5, 1, 1);
        }
      }
      // pins + value labels
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        const val = p.tick ? p.value + (hash01(i, Math.floor(f / 12), v.seed) - 0.5) * 40 : p.value;
        for (let j = 0; j < K; j++) {
          const z = wrapZ(p.z, j, offset);
          const s = 0.62;
          if (p.showPin) labels.icon(PIN, p.x, p.y, z, s * 1.1, white, -0.38, 0, 0.76, 1.0);
          const lx = p.showPin ? 0.6 : 0;
          if (p.tri) labels.icon(TRI, p.x, p.y, z, s, triCol, lx, 0.1, 0.6, 0.6);
          labels.text(fmt(val), p.x, p.y, z, s * 0.75, labelCol, "left", (lx + (p.tri ? 0.8 : 0)) / 0.75, 0.25);
        }
      }
      // framed tags on thin poles
      for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        const val = t.value + (hash01(i, Math.floor(f / 8), v.seed + 7) - 0.5) * 60;
        const label = t.big ? "BIG DATA" : fmt(val);
        for (let j = 0; j < K; j++) {
          const z = wrapZ(t.z, j, offset);
          const s = 0.55;
          const poleEm = t.pole / s;
          labels.rect(t.x, t.y, z, s, lineTint, -0.03, 0, 0.06, poleEm);
          labels.icon(DOT, t.x, t.y, z, s, white, -0.35, -0.35, 0.7, 0.7);
          const w = atlas.width(label) + 0.9;
          const y0 = poleEm;
          labels.rect(t.x, t.y, z, s, colorRGBA(v.contour, 1, 0.16), -0.15, y0, w, 1.35);
          labels.frame(t.x, t.y, z, s, lineTint, -0.15, y0, w, 1.35, 0.07);
          labels.text(label, t.x, t.y, z, s, colorRGBA("#ffffff", 1, 1.4), "left", 0.3, y0 + 0.42);
        }
      }
      sprites.end();
      labels.end();

      return {
        focusNear: 20,
        focusFar: 42,
        nearBlurAt: 11,
        farBlurAt: 120,
        nearCoc: 0.0075,
        farCoc: 0.0055,
        bloom: 0.45,
        bloomRadius: 0.55,
        exposure: 1.0,
        vignette: 0.55,
        grain: 0.015,
      };
    },
  };
};
