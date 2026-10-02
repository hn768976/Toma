import React, { useCallback } from "react";
import * as THREE from "three";
import { ThreeStage, BuiltScene } from "../../lib/three/ThreeStage";
import { defaultPost } from "../../lib/three/post";
import { gauss, mulberry32, range } from "../../lib/random";
import { instanced, linColor, quadGeo, stripGeo } from "../../lib/three/util";
import { LightStreamsVersion } from "../../versions";

// Look 3 — Light Streams. A curving tunnel of translucent additive panels,
// streaks and specks around a path. The path and the panel field repeat
// every L along the path; the camera travels exactly N·L over the loop.

export const LS_DURATION = 600;
const L = 120; // block length (path units)
const N = 4; // blocks travelled per loop
const BACK = 12; // keep items this far behind the camera before wrapping
const FAR = 104; // fade-out distance (< L - BACK so wrapping is invisible)
const TAU = Math.PI * 2;

// Path: x,y are periodic in L; z is the (camera-relative) arc parameter.
const PATH_GLSL = /* glsl */ `
uniform float uCamS; uniform float uL; uniform vec3 uCamPos;
vec3 pathOff(float s){ float a = 6.28318530718*s/uL;
  return vec3(3.75*sin(a) + 1.5*sin(2.0*a + 1.3), 0.35*sin(a + 0.7) + 0.15*sin(3.0*a + 2.1), 0.0); }
vec3 pathD(float s){ float a = 6.28318530718*s/uL; float k = 6.28318530718/uL;
  return vec3(3.75*k*cos(a) + 3.0*k*cos(2.0*a + 1.3), 0.35*k*cos(a + 0.7) + 0.45*k*cos(3.0*a + 2.1), -1.0); }
// world position (camera at origin in z) of a point at path parameter sRel ahead of the camera
void frameAt(float sRel, out vec3 P, out vec3 T, out vec3 Nn, out vec3 U){
  float s = uCamS + sRel;
  P = pathOff(s) + vec3(0.0, 0.0, -sRel);
  T = normalize(pathD(s));
  Nn = normalize(cross(T, vec3(0.0, 1.0, 0.0)));
  U = cross(Nn, T);
}
float wrapRel(float s0, float back){ return mod(s0 - uCamS + back, uL) - back; }
`;
const pathOffJS = (s: number) => {
  const a = (TAU * s) / L;
  return new THREE.Vector3(3.75 * Math.sin(a) + 1.5 * Math.sin(2 * a + 1.3), 0.35 * Math.sin(a + 0.7) + 0.15 * Math.sin(3 * a + 2.1), 0);
};

const PANEL_VERT = /* glsl */ `
${PATH_GLSL}
uniform float uBack, uFar, uFocus, uCocK, uPx;
attribute float aS; attribute vec2 aLatH; attribute vec2 aSize; attribute float aType; attribute vec4 aCol;
varying vec2 vUv; varying vec4 vCol; varying float vCoc;
void main(){
  float sRel = wrapRel(aS, uBack);
  vec3 P,T,Nn,U; frameAt(sRel, P,T,Nn,U);
  vec3 c = P + Nn*aLatH.x + U*aLatH.y;
  vec2 q = (uv - 0.5) * aSize;
  vec3 wp;
  if (aType < 0.5) wp = c + T*q.x + U*q.y;        // wall
  else if (aType < 1.5) wp = c + Nn*q.x + U*q.y;  // facing
  else wp = c + T*q.x + Nn*q.y;                    // floor / ceiling
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float z = -mv.z;
  vUv = uv;
  float fade = smoothstep(uFar*0.85, uFar*0.35, sRel) * smoothstep(0.25, 1.2, z);
  vCol = vec4(aCol.rgb, aCol.a * fade);
  vCoc = uCocK * abs(1.0/max(z,0.2) - 1.0/uFocus) * uPx;
  gl_Position = projectionMatrix * mv;
}`;
const PANEL_FRAG = /* glsl */ `
varying vec2 vUv; varying vec4 vCol; varying float vCoc;
void main(){
  vec2 d = min(vUv, 1.0 - vUv);
  vec2 fw = max(fwidth(vUv), vec2(1e-5));
  vec2 soft = min(fw * (1.2 + vCoc), vec2(0.5));
  float a = smoothstep(0.0, soft.x, d.x) * smoothstep(0.0, soft.y, d.y);
  // brighter rim, a little brighter towards one end
  float rim = 1.0 - smoothstep(0.0, 2.5, min(d.x/fw.x, d.y/fw.y));
  float body = 0.6 + 0.4*vUv.x;
  float energy = 1.0 / (1.0 + 0.04*vCoc);
  gl_FragColor = vec4(vCol.rgb * (body + rim*0.9*energy) * a * vCol.a * energy, 1.0);
}`;

const STREAK_VERT = /* glsl */ `
${PATH_GLSL}
uniform float uBack, uFar, uPx, uFocal, uT;
attribute float aS; attribute vec2 aLatH; attribute vec2 aLenW; attribute vec4 aCol; attribute float aSpeed;
varying vec2 vUv; varying vec4 vCol;
void main(){
  float s0 = aS - uT * aSpeed * uL;
  float sRel = wrapRel(s0, uBack + aLenW.x) + uv.x * aLenW.x;
  vec3 P,T,Nn,U; frameAt(sRel, P,T,Nn,U);
  vec3 c = P + Nn*aLatH.x + U*aLatH.y;
  vec3 vd = normalize(c - uCamPos);
  vec3 side = normalize(cross(T, vd));
  vec4 mv0 = modelViewMatrix * vec4(c, 1.0);
  float z = max(-mv0.z, 0.1);
  float minW = 1.3 * uPx * z / uFocal;
  float w = max(aLenW.y, minW);
  vec3 wp = c + side * uv.y * w;
  vUv = uv;
  float fade = smoothstep(uFar, uFar*0.6, sRel) * smoothstep(0.3, 2.5, z);
  vCol = vec4(aCol.rgb, aCol.a * fade * (aLenW.y / w));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
}`;
const STREAK_FRAG = /* glsl */ `
varying vec2 vUv; varying vec4 vCol;
void main(){
  float across = exp(-vUv.y*vUv.y*3.0);
  float along = smoothstep(0.0, 0.85, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
  gl_FragColor = vec4(vCol.rgb * vCol.a * across * along, 1.0);
}`;

const SPECK_VERT = /* glsl */ `
${PATH_GLSL}
uniform float uBack, uFar, uPx, uFocal, uFocus, uCocK;
attribute float aS; attribute vec2 aLatH; attribute float aSize; attribute vec4 aCol;
varying vec4 vCol; varying float vSoft;
void main(){
  float sRel = wrapRel(aS, uBack);
  vec3 P,T,Nn,U; frameAt(sRel, P,T,Nn,U);
  vec3 c = P + Nn*aLatH.x + U*aLatH.y;
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float z = max(-mv.z, 0.1);
  float core = aSize * uFocal / z;
  float coc = uCocK * abs(1.0/z - 1.0/uFocus) * uPx;
  float sz = max(core + coc, 1.5*uPx) * 3.0;
  gl_PointSize = sz;
  vSoft = clamp(coc / (core + coc + 1e-3), 0.0, 1.0);
  float fade = smoothstep(uFar, uFar*0.6, sRel) * smoothstep(0.4, 2.0, z);
  float area = (core + 1.0) / (core + coc + 1.0);
  vCol = vec4(aCol.rgb, aCol.a * fade * area * area);
  gl_Position = projectionMatrix * mv;
}`;
const SPECK_FRAG = /* glsl */ `
varying vec4 vCol; varying float vSoft;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0 * 3.0;
  float hard = 1.0 - smoothstep(0.7, 1.0, r);
  float glow = exp(-r*r*1.2);
  float disc = 1.0 - smoothstep(0.75, 1.0, r);
  float a = mix(hard + glow*0.6, disc*0.7, vSoft);
  gl_FragColor = vec4(vCol.rgb * vCol.a * a, 1.0);
}`;

const buildData = (v: LightStreamsVersion) => {
  const r = mulberry32(0x15f3a2);
  const cA = linColor(v.panel);
  const cB = linColor(v.panelBright);
  const mix = (t: number) => cA.clone().lerp(cB, t);

  // ---- panels
  const NP = 1600;
  const aS = new Float32Array(NP),
    aLatH = new Float32Array(NP * 2),
    aSize = new Float32Array(NP * 2),
    aType = new Float32Array(NP),
    aCol = new Float32Array(NP * 4);
  for (let i = 0; i < NP; i++) {
    aS[i] = r() * L;
    const roll = r();
    let lat: number, h: number;
    if (roll < 0.62) {
      // the dense mosaic wall beside the camera (mostly on the left)
      const side = r() < 0.78 ? -1 : 1;
      lat = side * (side < 0 ? range(r, 1.1, 3.2) : range(r, 2.0, 4.5));
      h = gauss(r) * 0.85;
    } else {
      // the field further out that converges into the band
      const side = r() < 0.5 ? -1 : 1;
      lat = side * (3 + Math.pow(r(), 1.3) * 20);
      h = gauss(r) * (0.25 + Math.abs(lat) * 0.012);
    }
    aLatH[i * 2] = lat;
    aLatH[i * 2 + 1] = h;
    const tRoll = r();
    const wall = roll < 0.62;
    // the mosaic wall is made of tiles facing the camera; the far field mixes orientations
    const type = wall ? (tRoll < 0.8 ? 1 : 0) : tRoll < 0.7 ? 0 : tRoll < 0.93 ? 1 : 2;
    aType[i] = type;
    const len = type === 1 ? range(r, 0.35, 1.7) : range(r, 0.5, 3.6);
    const hh = type === 2 ? range(r, 0.3, 1.0) : range(r, 0.12, 0.6) * (r() < 0.12 ? 1.8 : 1);
    aSize[i * 2] = len;
    aSize[i * 2 + 1] = hh;
    const bright = Math.pow(r(), 4);
    const col = mix(bright * 0.9 + r() * 0.2);
    const inten = range(r, 0.13, 0.32) * (1 + bright * 3.5) * (wall ? 1.15 : 1);
    aCol.set([col.r, col.g, col.b, inten], i * 4);
  }

  // ---- streaks
  const NS = 340;
  const sS = new Float32Array(NS),
    sLatH = new Float32Array(NS * 2),
    sLenW = new Float32Array(NS * 2),
    sCol = new Float32Array(NS * 4),
    sSpeed = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    sS[i] = r() * L;
    const side = r() < 0.5 ? -1 : 1;
    sLatH[i * 2] = (r() < 0.55 ? -1 : side) * (0.9 + Math.pow(r(), 1.5) * 14);
    sLatH[i * 2 + 1] = gauss(r) * 0.5 + (r() < 0.2 ? range(r, -2.5, 2.5) : 0);
    sLenW[i * 2] = range(r, 5, 26);
    sLenW[i * 2 + 1] = range(r, 0.004, 0.016);
    const col = mix(0.55 + r() * 0.45);
    sCol.set([col.r, col.g, col.b, range(r, 1.2, 3.5) * (r() < 0.25 ? 2.2 : 1)], i * 4);
    // whole number of extra block passes per loop → seamless
    sSpeed[i] = Math.floor(r() * 3) * 1; // 0,1,2 blocks per loop
  }

  // ---- specks
  const NK = 900;
  const kS = new Float32Array(NK),
    kLatH = new Float32Array(NK * 2),
    kSize = new Float32Array(NK),
    kCol = new Float32Array(NK * 4);
  for (let i = 0; i < NK; i++) {
    kS[i] = r() * L;
    const side = r() < 0.5 ? -1 : 1;
    kLatH[i * 2] = side * (0.5 + Math.pow(r(), 1.2) * 24);
    kLatH[i * 2 + 1] = gauss(r) * 2.2;
    kSize[i] = range(r, 0.02, 0.06);
    const col = mix(0.6 + r() * 0.4).lerp(new THREE.Color(1, 1, 1), 0.35);
    kCol.set([col.r, col.g, col.b, range(r, 1.0, 4.0)], i * 4);
  }
  return {
    panels: { NP, aS, aLatH, aSize, aType, aCol },
    streaks: { NS, sS, sLatH, sLenW, sCol, sSpeed },
    specks: { NK, kS, kLatH, kSize, kCol },
  };
};

const buildScene = (v: LightStreamsVersion): BuiltScene => {
  const d = buildData(v);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.1, 400);
  const common = {
    uCamS: { value: 0 },
    uL: { value: L },
    uCamPos: { value: new THREE.Vector3() },
    uBack: { value: BACK },
    uFar: { value: FAR },
    uFocus: { value: 22 },
    uCocK: { value: 45 },
    uPx: { value: 1 },
    uFocal: { value: 1000 },
    uT: { value: 0 },
  };
  const addMat = (vs: string, fs: string) =>
    new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: common,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

  const p = d.panels;
  const pg = instanced(quadGeo(), p.NP, {
    aS: { size: 1, data: p.aS },
    aLatH: { size: 2, data: p.aLatH },
    aSize: { size: 2, data: p.aSize },
    aType: { size: 1, data: p.aType },
    aCol: { size: 4, data: p.aCol },
  });
  const panels = new THREE.Mesh(pg, addMat(PANEL_VERT, PANEL_FRAG));
  panels.frustumCulled = false;
  scene.add(panels);

  const s = d.streaks;
  const sg = instanced(stripGeo(24), s.NS, {
    aS: { size: 1, data: s.sS },
    aLatH: { size: 2, data: s.sLatH },
    aLenW: { size: 2, data: s.sLenW },
    aCol: { size: 4, data: s.sCol },
    aSpeed: { size: 1, data: s.sSpeed },
  });
  const streaks = new THREE.Mesh(sg, addMat(STREAK_VERT, STREAK_FRAG));
  streaks.frustumCulled = false;
  scene.add(streaks);

  const k = d.specks;
  const kg = new THREE.BufferGeometry();
  kg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(k.NK * 3), 3));
  kg.setAttribute("aS", new THREE.BufferAttribute(k.kS, 1));
  kg.setAttribute("aLatH", new THREE.BufferAttribute(k.kLatH, 2));
  kg.setAttribute("aSize", new THREE.BufferAttribute(k.kSize, 1));
  kg.setAttribute("aCol", new THREE.BufferAttribute(k.kCol, 4));
  const specks = new THREE.Points(kg, addMat(SPECK_VERT, SPECK_FRAG));
  specks.frustumCulled = false;
  scene.add(specks);

  const bg = linColor(v.bg);
  return {
    scene,
    camera,
    clear: bg,
    grainPeriod: LS_DURATION,
    post: { ...defaultPost, exposure: 1.0, bloomStrength: 0.6, bloomRadius: 0.55, bloomThreshold: 0.4, toneMap: "aces", vignette: 0.3, grain: 0.02, saturation: 1.15 },
    update: (frame, info) => {
      const t = (frame % LS_DURATION) / LS_DURATION; // 0..1, loop-exact
      const camS = t * N * L;
      const cam = pathOffJS(camS);
      const sway = Math.sin(TAU * t * 2) * 0.25;
      camera.position.set(cam.x - 0.4, cam.y + 0.05 + sway * 0.4, 0);
      const look = pathOffJS(camS + 18);
      look.x += 0.5;
      camera.up.set(Math.sin(TAU * t) * 0.04, 1, 0).normalize();
      camera.lookAt(look.x + 0.8, look.y * 0.6, -18);
      common.uCamS.value = camS;
      common.uCamPos.value.copy(camera.position);
      common.uPx.value = info.pxScale;
      common.uFocal.value = (info.height / 2) / Math.tan((camera.fov * Math.PI) / 360);
      common.uT.value = t;
    },
  };
};

export const LightStreams: React.FC<{ version: LightStreamsVersion }> = ({ version }) => {
  const build = useCallback(() => buildScene(version), [version]);
  return <ThreeStage build={build} />;
};
