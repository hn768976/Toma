import React, { useCallback } from "react";
import * as THREE from "three";
import { ThreeStage, BuiltScene } from "../../lib/three/ThreeStage";
import { defaultPost } from "../../lib/three/post";
import { gauss, mulberry32, range } from "../../lib/random";
import { instanced, linColor, quadGeo } from "../../lib/three/util";
import { FontGate } from "../../lib/ui/FontGate";
import { CyberFlythroughVersion } from "../../versions";
import { ATLAS_H, ATLAS_W, CELL_H, CELL_W, COLS, ROWS, drawAtlas } from "./atlas";

// Look 1 — Cyber Flythrough. Camera flies low over a dotted floor through
// floating HUD panels. Floor and panels live in a block of length W that
// repeats along z; the camera moves exactly N·W over the 600-frame loop.

export const CF_DURATION = 600;
const W = 96; // block length (also the visible window)
const N = 2; // blocks per loop
const BACK = 3;
const SP = 0.24; // dot spacing; W / SP is an integer so the floor tiles exactly
const STEP_FRAMES = 12; // widget values change every 12 frames (50 steps / loop)
const TAU = Math.PI * 2;

const COMMON_GLSL = /* glsl */ `
uniform float uCamD; uniform float uWin; uniform float uBack; uniform float uFocus; uniform float uCocK;
uniform float uPx; uniform float uFocal; uniform float uFar;
float wrapD(float zb){ return mod(zb - uCamD + uBack, uWin) - uBack; }
float cocPx(float z){ return uCocK * abs(1.0/max(z,0.15) - 1.0/uFocus) * uPx; }
`;

const FLOOR_VERT = /* glsl */ `
${COMMON_GLSL}
attribute float aKind; attribute float aY;
uniform vec3 uTeal; uniform vec3 uBlue;
varying vec4 vCol; varying float vSoft;
void main(){
  float d = wrapD(position.z);
  vec3 wp = vec3(position.x, aY, -d);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float z = max(-mv.z, 0.05);
  float core = 0.0065 * uFocal / z;
  float coc = min(cocPx(z) * 0.3, 3.0 * uPx);
  float sz = max(core, 1.0) + coc;
  gl_PointSize = sz * 2.2;
  vSoft = clamp(coc / sz, 0.0, 1.0);
  float area = min(1.0, core*core) / (1.0 + 0.04*coc*coc);
  float fade = smoothstep(uFar, uFar*0.2, d) * smoothstep(-uBack, 0.5, d);
  // the fine centre strip only exists near the camera (it would pile up at the horizon)
  if (abs(aKind - 0.15) < 0.01) fade *= smoothstep(6.0, 2.0, d) * 0.5;
  float lat = abs(position.x);
  float k = aKind; // 1 = major line, 0 = plain dot
  vec3 col = mix(uBlue, uTeal, 0.25 + 0.75*k);
  float inten = (0.6 + 1.7*k) * (1.0 - smoothstep(8.0, 30.0, lat)*0.8) * (position.x < 0.0 ? 1.3 : 0.65) * (aY > 0.01 ? 0.8 : 1.0);
  // horizon brightening: far dots pile up into the glow; keep them teal-white
  col = mix(col, uTeal, smoothstep(30.0, 90.0, d)*0.3);
  inten *= 1.0 - smoothstep(25.0, 80.0, d)*0.55;
  vCol = vec4(col, inten * area * fade);
  gl_Position = projectionMatrix * mv;
}`;
const DOT_FRAG = /* glsl */ `
varying vec4 vCol; varying float vSoft;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0 * 2.2;
  float hard = 1.0 - smoothstep(0.6, 1.0, r);
  float halo = exp(-r*r*0.9) * 0.35;
  float disc = (1.0 - smoothstep(0.82, 1.0, r)) * (0.75 + 0.25*smoothstep(0.5, 0.95, r));
  float a = mix(hard + halo, disc, vSoft);
  gl_FragColor = vec4(vCol.rgb * vCol.a * a, 1.0);
}`;

const PANEL_VERT = /* glsl */ `
${COMMON_GLSL}
attribute vec3 aPos; attribute vec2 aSize; attribute vec2 aCell; attribute float aYaw; attribute float aInt;
varying vec2 vUv; varying vec2 vAtlas; varying float vA; varying float vCoc;
uniform vec2 uCellUv; uniform vec2 uPadUv;
void main(){
  float d = wrapD(aPos.z);
  vec3 c = vec3(aPos.x, aPos.y, -d);
  vec2 q = (uv - 0.5) * aSize;
  float cy = cos(aYaw), sy = sin(aYaw);
  vec3 wp = c + vec3(q.x*cy, q.y, q.x*sy);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float z = max(-mv.z, 0.05);
  vUv = uv;
  vAtlas = aCell + uPadUv + uv * (uCellUv - 2.0*uPadUv);
  vCoc = cocPx(z);
  float fade = smoothstep(uFar, uFar*0.6, d) * smoothstep(3.0, 7.5, z);
  vA = aInt * fade;
  gl_Position = projectionMatrix * mv;
}`;
const PANEL_FRAG = /* glsl */ `
uniform sampler2D tAtlas;
varying vec2 vUv; varying vec2 vAtlas; varying float vA; varying float vCoc;
void main(){
  float bias = clamp(log2(1.0 + vCoc * 0.55), 0.0, 4.5);
  vec3 tex = texture2D(tAtlas, vAtlas, bias).rgb;
  vec2 dd = min(vUv, 1.0 - vUv);
  vec2 fw = max(fwidth(vUv), vec2(1e-5));
  vec2 soft = min(fw * (1.0 + vCoc*0.8), vec2(0.5));
  float a = smoothstep(0.0, soft.x, dd.x) * smoothstep(0.0, soft.y, dd.y);
  float energy = 1.0 / (1.0 + 0.015*vCoc*vCoc*0.1);
  gl_FragColor = vec4(tex * a * vA * energy, 1.0);
}`;

const STREAK_VERT = /* glsl */ `
${COMMON_GLSL}
uniform float uT; uniform vec3 uCamPos;
attribute vec3 aPos; attribute vec3 aLenWSpeed; attribute vec4 aCol; attribute float aVert;
varying vec2 vUv; varying vec4 vCol; varying float vDot; varying float vLen; varying float vHead;
void main(){
  float zb = aPos.z + uT * aLenWSpeed.z * uWin; // moves toward the camera
  float len = aLenWSpeed.x;
  float d0 = mod(zb - uCamD + uBack + len, uWin) - uBack - len;
  vec3 a, dir;
  if (aVert < 0.5) { a = vec3(aPos.x, aPos.y, -d0); dir = vec3(0.0, 0.0, -1.0); }
  else { a = vec3(aPos.x, 0.0, -d0); dir = vec3(0.0, 1.0, 0.0); }
  vec3 p = a + dir * (uv.x * len);
  vec3 vd = normalize(p - uCamPos);
  vec3 side = normalize(cross(dir, vd));
  vec4 mv0 = modelViewMatrix * vec4(p, 1.0);
  float z = max(-mv0.z, 0.1);
  float minW = 1.2 * uPx * z / uFocal;
  float w = max(aLenWSpeed.y, minW);
  vec3 wp = p + side * (uv.y * 2.0 - 1.0) * w;
  float dd = -p.z;
  float fade = smoothstep(uFar, uFar*0.5, dd) * smoothstep(0.2, 2.0, z);
  vUv = vec2(uv.x, uv.y*2.0-1.0);
  vDot = aVert < 0.5 && fract(aPos.z * 7.31) < 0.7 ? 1.0 : 0.0;
  vLen = len;
  vHead = smoothstep(30.0, 8.0, dd);
  vCol = vec4(aCol.rgb, aCol.a * fade * (aLenWSpeed.y / w));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
}`;
const STREAK_FRAG = /* glsl */ `
varying vec2 vUv; varying vec4 vCol; varying float vDot; varying float vLen; varying float vHead;
void main(){
  float across = exp(-vUv.y*vUv.y*3.5);
  float along = smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.02, vUv.x) * (0.25 + 0.75*(1.0 - vUv.x)) + 2.5 * exp(-vUv.x * 60.0) * vHead;
  // most trails are dotted: a dash pattern in world units along the streak
  float dots = vDot > 0.5 ? smoothstep(0.55, 0.2, abs(fract(vUv.x * vLen * 2.2) - 0.5) * 2.0) * 1.6 : 1.0;
  gl_FragColor = vec4(vCol.rgb * vCol.a * across * along * dots, 1.0);
}`;

const BOKEH_VERT = /* glsl */ `
${COMMON_GLSL}
uniform float uT;
attribute float aSize; attribute vec4 aCol; attribute vec2 aDrift;
varying vec4 vCol; varying float vSoft;
void main(){
  float d = wrapD(position.z);
  vec3 wp = vec3(position.x + sin(uT*6.2831853*aDrift.x + position.z)*0.3, position.y + sin(uT*6.2831853*aDrift.y + position.x)*0.25, -d);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float z = max(-mv.z, 0.05);
  float core = aSize * uFocal / z;
  float coc = min(cocPx(z) * 0.5, 9.0 * uPx);
  float sz = max(core, 1.2*uPx) + coc;
  gl_PointSize = sz * 2.2;
  vSoft = clamp(coc / sz, 0.0, 1.0);
  float fade = smoothstep(uFar, uFar*0.5, d) * smoothstep(0.3, 1.5, z);
  float area = (core*core + 1.0) / (sz*sz + 1.0);
  vCol = vec4(aCol.rgb, aCol.a * fade * mix(1.0, area, 0.85));
  gl_Position = projectionMatrix * mv;
}`;

const BG_VERT = /* glsl */ `
varying vec2 vNdc;
void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const BG_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform float uHorizon; uniform float uAspect;
varying vec2 vNdc;
void main(){
  float y = vNdc.y - uHorizon;
  vec3 c = y > 0.0 ? mix(uTop*1.35, uTop*0.7, smoothstep(0.0, 1.6, y)) : mix(uTop*0.9, uBottom, smoothstep(0.0, 1.2, -y));
  float g = exp(-abs(y)*5.0) * (0.55 + 0.45*exp(-vNdc.x*vNdc.x*1.2));
  float c0 = exp(-(vNdc.x*vNdc.x*uAspect*uAspect*0.6 + y*y*14.0));
  c += uGlow * (g*0.08);
  c *= 1.0 - 0.55 * c0;
  vec2 gq = abs(fract(vNdc * vec2(9.0, 7.0)) - 0.5);
  float grid = (1.0 - smoothstep(0.0, 0.012, min(gq.x, gq.y))) * smoothstep(0.2, -0.8, vNdc.x) * smoothstep(-0.1, 0.8, vNdc.y);
  c += uGlow * grid * 0.05;
  c *= 1.4 - 0.95 * smoothstep(-0.8, 1.0, vNdc.x);
  gl_FragColor = vec4(c, 1.0);
}`;

const buildScene = (v: CyberFlythroughVersion): BuiltScene => {
  const r = mulberry32(0xc1be7);
  const teal = linColor(v.teal);
  const blue = linColor(v.blue);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 300);

  const uni = {
    uCamD: { value: 0 },
    uWin: { value: W },
    uBack: { value: BACK },
    uFocus: { value: 13 },
    uCocK: { value: 260 },
    uPx: { value: 1 },
    uFocal: { value: 1000 },
    uFar: { value: W - BACK - 2 },
    uT: { value: 0 },
    uTeal: { value: teal },
    uBlue: { value: blue },
    uCamPos: { value: new THREE.Vector3() },
  };
  const add = (vs: string, fs: string, extra: Record<string, THREE.IUniform> = {}) =>
    new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: { ...uni, ...extra },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

  // ---- background
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTop: { value: linColor(v.bgTop) },
      uBottom: { value: linColor(v.bgBottom) },
      uGlow: { value: linColor(v.blue).lerp(teal, 0.35) },
      uHorizon: { value: 0.1 },
      uAspect: { value: 16 / 9 },
    },
  });
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // ---- floor dots
  const cols = Math.round(38.4 / SP);
  const rows = Math.round(W / SP);
  const fineCols = Math.round(8 / 0.12);
  const fineRows = Math.round(W / 0.12);
  const fPos = new Float32Array((cols * rows + fineCols * fineRows) * 3);
  const fKind = new Float32Array(cols * rows + fineCols * fineRows);
  let n = 0;
  for (let iz = 0; iz < fineRows; iz++)
    for (let ix = 0; ix < fineCols; ix++) {
      fPos[n * 3] = (ix - fineCols / 2) * 0.12 + 0.06;
      fPos[n * 3 + 2] = iz * 0.12 + 0.06;
      fKind[n] = 0.15;
      n++;
    }
  for (let iz = 0; iz < rows; iz++)
    for (let ix = 0; ix < cols; ix++) {
      const gx = ix - cols / 2;
      fPos[n * 3] = gx * SP;
      fPos[n * 3 + 2] = iz * SP;
      fKind[n] = gx % 8 === 0 ? 1 : iz % 20 === 0 ? 0.5 : 0;
      n++;
    }
  // layered, wavy dotted "data terrain" surfaces at different heights and tilts
  const surfaces = [
    { x0: -13, x1: -2.2, y: (x: number, z: number) => 0.25 + (-x - 2.2) * 0.17 + 0.12 * Math.sin(z * ((2 * Math.PI) / 24) + x) },
    { x0: 2.4, x1: 12, y: (x: number, z: number) => 0.2 + (x - 2.4) * 0.12 + 0.1 * Math.sin(z * ((2 * Math.PI) / 32) - x * 0.7) },
    { x0: -11, x1: -3.5, y: (x: number, z: number) => 2.6 + (-x - 3.5) * 0.12 + 0.15 * Math.sin(z * ((2 * Math.PI) / 48) + x * 0.5) },
  ];
  const SSP = 0.3;
  const sRows = Math.round(W / SSP);
  let NW = 0;
  for (const sf of surfaces) NW += sRows * Math.round((sf.x1 - sf.x0) / SSP);
  const allPos = new Float32Array((n + NW) * 3);
  const allKind = new Float32Array(n + NW);
  const allY = new Float32Array(n + NW);
  allPos.set(fPos.subarray(0, n * 3));
  allKind.set(fKind.subarray(0, n));
  let m = n;
  surfaces.forEach((sf) => {
    const cols2 = Math.round((sf.x1 - sf.x0) / SSP);
    for (let iz = 0; iz < sRows; iz++)
      for (let k2 = 0; k2 < cols2; k2++) {
        const x = sf.x0 + k2 * SSP;
        const z = iz * SSP;
        allPos[m * 3] = x;
        allPos[m * 3 + 2] = z;
        allY[m] = sf.y(x, z);
        allKind[m] = k2 % 6 === 0 ? 0.9 : iz % 14 === 0 ? 0.5 : 0;
        m++;
      }
  });
  const fg = new THREE.BufferGeometry();
  fg.setAttribute("position", new THREE.BufferAttribute(allPos, 3));
  fg.setAttribute("aKind", new THREE.BufferAttribute(allKind, 1));
  fg.setAttribute("aY", new THREE.BufferAttribute(allY, 1));
  const floor = new THREE.Points(fg, add(FLOOR_VERT, DOT_FRAG));
  floor.frustumCulled = false;
  scene.add(floor);

  // ---- panels
  const NPAN = 260;
  const pPos = new Float32Array(NPAN * 3),
    pSize = new Float32Array(NPAN * 2),
    pCell = new Float32Array(NPAN * 2),
    pYaw = new Float32Array(NPAN),
    pInt = new Float32Array(NPAN);
  for (let i = 0; i < NPAN; i++) {
    const label = i >= 140; // small frameless number labels
    const side = r() < 0.72 ? -1 : 1;
    let x = side * (1.2 + Math.pow(r(), 1.1) * 10);
    let y = 0.25 + Math.abs(gauss(r)) * 1.1 + (r() < 0.35 ? range(r, 1.0, 4.5) : 0);
    let cell = i % (COLS * ROWS);
    let s = range(r, 0.55, 1.15) * (r() < 0.08 ? 1.4 : 1);
    if (i % 15 === 0) {
      // ring-gauge panels near the vanishing line
      x = range(r, -0.5, 0.5);
      y = i % 30 === 0 ? range(r, 3.2, 4.2) : range(r, 0.35, 0.5);
      cell = 1 + 9 * Math.floor(r() * 7);
      s = 1.0;
    }
    if (label) {
      cell = 3 + 9 * Math.floor(r() * 7);
      s = range(r, 0.3, 0.55);
    }
    cell = cell % (COLS * ROWS);
    pPos.set([x, y, r() * W], i * 3);
    pSize.set([s * 1.6, s], i * 2);
    pCell.set([(cell % COLS) / COLS, 1 - (Math.floor(cell / COLS) + 1) / ROWS], i * 2);
    pYaw[i] = -side * range(r, 0.0, 0.35);
    pInt[i] = range(r, 0.55, 1.1) * (label ? 0.6 : 1) * (side < 0 ? 1.15 : 0.85) * (i % 15 === 0 ? 1.8 : 1);
  }
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  const pg = instanced(quadGeo(), NPAN, {
    aPos: { size: 3, data: pPos },
    aSize: { size: 2, data: pSize },
    aCell: { size: 2, data: pCell },
    aYaw: { size: 1, data: pYaw },
    aInt: { size: 1, data: pInt },
  });
  const panels = new THREE.Mesh(
    pg,
    add(PANEL_VERT, PANEL_FRAG, {
      tAtlas: { value: tex },
      uCellUv: { value: new THREE.Vector2(1 / COLS, 1 / ROWS) },
      uPadUv: { value: new THREE.Vector2(14 / ATLAS_W, 14 / ATLAS_H) },
    }),
  );
  panels.frustumCulled = false;
  scene.add(panels);
  void CELL_W;
  void CELL_H;

  // ---- streaks (along z) and vertical shafts
  const NST = 320;
  const sPos = new Float32Array(NST * 3),
    sLWS = new Float32Array(NST * 3),
    sCol = new Float32Array(NST * 4),
    sVert = new Float32Array(NST);
  for (let i = 0; i < NST; i++) {
    const vert = i < 9;
    const side = r() < 0.62 ? -1 : 1;
    sPos.set([side * (0.3 + Math.pow(r(), 1.4) * 14), vert ? 0 : r() < 0.35 ? range(r, 0.02, 0.12) : 0.1 + Math.pow(r(), 2) * 4, r() * W], i * 3);
    sLWS.set([vert ? range(r, 2, 9) : range(r, 2, 7), vert ? range(r, 0.003, 0.008) : range(r, 0.003, 0.01), vert ? 0 : 1 + Math.floor(r() * 3)], i * 3);
    const c = teal.clone().lerp(blue, r() * 0.3).lerp(new THREE.Color(1, 1, 1), r() * 0.2);
    sCol.set([c.r, c.g, c.b, range(r, 1.0, 4) * (vert ? 0.5 : 1)], i * 4);
    sVert[i] = vert ? 1 : 0;
  }
  const sg = instanced(quadGeo(), NST, {
    aPos: { size: 3, data: sPos },
    aLenWSpeed: { size: 3, data: sLWS },
    aCol: { size: 4, data: sCol },
    aVert: { size: 1, data: sVert },
  });
  const streaks = new THREE.Mesh(sg, add(STREAK_VERT, STREAK_FRAG));
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---- bokeh specks
  const NB = 700;
  const bPos = new Float32Array(NB * 3),
    bSize = new Float32Array(NB),
    bCol = new Float32Array(NB * 4),
    bDrift = new Float32Array(NB * 2);
  for (let i = 0; i < NB; i++) {
    bPos.set([range(r, -11, 11), 0.1 + Math.pow(r(), 1.5) * 6, r() * W], i * 3);
    bSize[i] = range(r, 0.005, 0.016);
    const c = teal.clone().lerp(new THREE.Color(1, 1, 1), r() * 0.5).lerp(blue, r() * 0.3);
    bCol.set([c.r, c.g, c.b, range(r, 0.8, 3.5)], i * 4);
    bDrift.set([1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2)], i * 2);
  }
  const bg2 = new THREE.BufferGeometry();
  bg2.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  bg2.setAttribute("aSize", new THREE.BufferAttribute(bSize, 1));
  bg2.setAttribute("aCol", new THREE.BufferAttribute(bCol, 4));
  bg2.setAttribute("aDrift", new THREE.BufferAttribute(bDrift, 2));
  const bokeh = new THREE.Points(bg2, add(BOKEH_VERT, DOT_FRAG));
  bokeh.frustumCulled = false;
  scene.add(bokeh);

  let drawnStep = -1;
  const far = new THREE.Vector3();
  return {
    scene,
    camera,
    clear: linColor(v.bgBottom),
    grainPeriod: CF_DURATION,
    post: { ...defaultPost, exposure: 1.0, bloomStrength: 0.6, bloomRadius: 0.65, bloomThreshold: 0.5, toneMap: "aces", vignette: 0.4, grain: 0.02, saturation: 1.1 },
    update: (frame, info) => {
      const f = ((frame % CF_DURATION) + CF_DURATION) % CF_DURATION;
      const t = f / CF_DURATION;
      const step = Math.floor(f / STEP_FRAMES);
      if (step !== drawnStep) {
        drawAtlas(ctx, step, { teal: v.teal, blue: v.blue });
        tex.needsUpdate = true;
        drawnStep = step;
      }
      uni.uCamD.value = t * N * W;
      uni.uT.value = t;
      uni.uPx.value = info.pxScale;
      uni.uFocal.value = info.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
      const sx = Math.sin(TAU * t) * 0.6 + Math.sin(TAU * t * 3 + 1) * 0.15;
      camera.position.set(sx, 1.05 + Math.sin(TAU * t * 2) * 0.12, 0);
      camera.up.set(Math.sin(TAU * t + 0.5) * 0.03, 1, 0).normalize();
      camera.lookAt(sx * 0.4, 0.62, -20);
      uni.uCamPos.value.copy(camera.position);
      camera.aspect = info.width / info.height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      far.set(camera.position.x, camera.position.y, -1e4).project(camera);
      bgMat.uniforms.uHorizon.value = far.y;
      bgMat.uniforms.uAspect.value = info.width / info.height;
    },
  };
};

export const CyberFlythrough: React.FC<{ version: CyberFlythroughVersion }> = ({ version }) => {
  const build = useCallback(() => buildScene(version), [version]);
  return (
    <FontGate>
      <ThreeStage build={build} />
    </FontGate>
  );
};
