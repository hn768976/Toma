// Look 1 — Data Space. A forward fly-through between a perspective grid floor
// and ceiling, past ~160 floating data strips, with warm light blooms.
//
// three.js (WebGL2) via @remotion/three. R3F only provides the canvas and GL
// context: the scene is drawn manually once per Remotion frame (no useFrame,
// no clock) into a half-float MSAA target, then a final pass adds grain and
// ±1/255 dither. Every value comes from frame % 600.

import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { GLSL_FINAL } from "../lib/glsl";
import { loopFrame, loopTheta } from "../lib/loop";
import { irange, mulberry32, range } from "../lib/random";
import { ATLAS_ROWS, drawStripAtlas } from "./atlas";

// Colours are authored and blended in display (sRGB) space, like the water
// looks; no linear conversion anywhere in this pipeline.
THREE.ColorManagement.enabled = false;

// ── Layout ───────────────────────────────────────────────────────────────────
const D = 40; // strip layout period in depth = distance flown per loop
const COPIES = 3; // periods kept alive ahead of the camera
const FLOOR_Y = -3.2;
const CEIL_Y = 3.6;
const FOG_START = 12;
const FOG_END = (COPIES - 1) * D - 2; // 78: everything is fully fogged before it could pop
const N_STRIPS = 160;
const FOV = 52;

const PALETTE = {
  fog: new THREE.Color("#0A121C"),
  horizon: new THREE.Color("#0E1B2C"),
  grid: new THREE.Color("#8AA0C0"),
  data: new THREE.Color("#C8D8F0"),
  bloom: new THREE.Color("#F0D8A0"),
};

type Strip = {
  x: number;
  y: number;
  b: number; // base depth in [0, D)
  w: number;
  h: number;
  row: number;
  uOff: number;
  uScale: number;
  opacity: number;
  panel: number;
  dashCycles: number; // whole cycles per loop → loops exactly
  dashPhase: number;
  dashDensity: number;
};

const buildStrips = (): Strip[] => {
  const rng = mulberry32(0x57a1b5);
  const out: Strip[] = [];
  for (let i = 0; i < N_STRIPS; i++) {
    // Heights cluster loosely around eye level (as in the reference), clear of floor/ceiling.
    // Spread over the whole height, a little denser around eye level.
    const yr = rng() * 2 - 1;
    const y = Math.sign(yr) * Math.pow(Math.abs(yr), 1.05) * 3.0 + 0.1;
    // Panels (faintly filled rectangles) build up a lit wall right of centre.
    const xr = rng();
    const x = -20 + 52 * Math.pow(xr, 0.75);
    const isPanel = rng() < (x > 2 ? 0.4 : 0.15);
    const w = isPanel ? range(rng, 3, 10) : range(rng, 5, 28);
    out.push({
      x,
      y,
      b: (i / N_STRIPS) * D + range(rng, 0, D / N_STRIPS),
      w,
      h: isPanel ? range(rng, 0.25, 0.8) : range(rng, 0.08, 0.22),
      row: irange(rng, 0, ATLAS_ROWS - 1),
      uOff: range(rng, 0, 0.6),
      uScale: Math.min(0.9, w / 24) * range(rng, 0.8, 1.2),
      opacity: range(rng, 0.3, 0.85),
      panel: isPanel ? range(rng, 0.06, 0.16) : 0,
      // Dash cells scrolled per loop (integer). The irregular dash pattern
      // repeats every |dashCycles| cells, so the scroll loops exactly.
      dashCycles: (rng() < 0.5 ? 1 : -1) * irange(rng, 7, 16),
      dashPhase: rng(),
      dashDensity: range(rng, 6, 24),
    });
  }
  return out;
};
const STRIPS = buildStrips();

// Free-floating specks and dot-matrix rows between the strips.
const N_DOTS = 6000;
type Dot = { x: number; y: number; b: number; size: number; bright: number };
const buildDots = (): Dot[] => {
  const rng = mulberry32(0xd075);
  const out: Dot[] = [];
  while (out.length < N_DOTS) {
    const x = range(rng, -24, 32);
    const y = range(rng, -3.0, 3.4);
    const b = range(rng, 0, D);
    if (rng() < 0.45) {
      // A dot-matrix row along x.
      const n = irange(rng, 6, 30);
      const step = range(rng, 0.08, 0.18);
      const bright = range(rng, 0.3, 0.9);
      for (let i = 0; i < n && out.length < N_DOTS; i++)
        if (rng() < 0.85) out.push({ x: x + i * step, y, b, size: 0.035, bright: bright * range(rng, 0.6, 1) });
    } else {
      out.push({ x, y, b, size: range(rng, 0.025, 0.07), bright: Math.pow(rng(), 2) * 0.9 + 0.1 });
    }
  }
  return out;
};
const DOTS = buildDots();

const BLOOMS = [
  { x: 7.0, y: 0.2, b: 6, r: 3.2, a: 0.55, n: 1, p: 0.3 },
  { x: 12.0, y: -2.5, b: 19, r: 4.0, a: 0.45, n: 2, p: 2.1 },
  { x: 4.5, y: 0.6, b: 27, r: 2.6, a: 0.5, n: 1, p: 4.0 },
  { x: 9.0, y: -2.7, b: 35, r: 3.5, a: 0.45, n: 3, p: 1.2 },
];

// ── Shaders ──────────────────────────────────────────────────────────────────
const FOG_GLSL = /* glsl */ `
uniform vec3 uFog;
uniform vec3 uHorizon;
float fogVis(float dist) { return 1.0 - smoothstep(${FOG_START.toFixed(1)}, ${FOG_END.toFixed(1)}, dist); }
`;

const GRID_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const GRID_FRAG = /* glsl */ `
precision highp float;
${FOG_GLSL}
uniform vec3 uCam;
uniform vec3 uGrid;
in vec3 vWorld;
out vec4 fragColor;
// Anti-aliased grid line with distance-based fade so lines never crawl or moiré.
float gridLine(float c, float width) {
  float fw = fwidth(c);
  float d = abs(fract(c - 0.5) - 0.5);
  float l = 1.0 - smoothstep(width * fw, (width + 1.0) * fw, d);
  // Fade out once the pattern gets finer than ~2 px.
  return l * (1.0 - smoothstep(0.18, 0.45, fw));
}
float h1(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
// Per-line brightness and broken segments, so the grid reads as scattered
// rays rather than a complete tiled floor. Line ids are integers in world
// space, so the pattern is fixed to the world and loops with the flight.
// idPeriod / alongPeriod wrap the hash inputs so the pattern repeats exactly
// every loop period along the flight axis (0 = no wrap, used across x).
float lineMod(float c, float along, float salt, float idPeriod, float alongPeriod) {
  float id = floor(c + 0.5);
  if (idPeriod > 0.0) id = mod(id, idPeriod);
  float segId = floor(along / 8.0);
  if (alongPeriod > 0.0) segId = mod(segId, alongPeriod);
  float b = h1(id + salt);
  float seg = h1(id * 7.0 + segId + salt * 3.0);
  return (b < 0.35 ? 0.15 : 0.35 + 0.65 * b) * (seg < 0.3 ? 0.25 : 1.0);
}
void main() {
  float dist = length(vWorld - uCam);
  // 0.5-unit cells: 80 lines per loop period, every 8th brighter (10 per period).
  vec2 g = vWorld.xz * 2.0;
  // Lines along the flight (rays from the vanishing point) read stronger than cross lines.
  // g.y runs along the flight: one loop = 2·D grid units = 2·D/8 segments.
  float minor = max(gridLine(g.x, 0.2) * lineMod(g.x, g.y, 0.0, 0.0, ${(2 * D) / 8}.0), 0.55 * gridLine(g.y, 0.18) * lineMod(g.y, g.x, 5.0, ${2 * D}.0, 0.0));
  float major = max(gridLine(g.x / 8.0, 0.4) * lineMod(g.x / 8.0, g.y, 9.0, 0.0, ${(2 * D) / 8}.0), 0.5 * gridLine(g.y / 8.0, 0.3));
  float a = max(minor * 0.25, major * 0.5);
  // Fine dot mesh between the lines (the floor and ceiling are never flat).
  vec2 q = vWorld.xz * 4.0;
  vec2 fq = abs(fract(q) - 0.5) / fwidth(q);
  float dotm = (1.0 - smoothstep(0.6, 1.4, max(fq.x, fq.y))) * (1.0 - smoothstep(0.08, 0.2, max(fwidth(q).x, fwidth(q).y)));
  a = max(a, dotm * 0.22);
  // The floor catches more light than the ceiling.
  a *= vWorld.y < uCam.y ? 1.35 : 0.85;
  float vis = fogVis(dist);
  // Additive: light lines over the fog.
  fragColor = vec4(uGrid * a * vis, 1.0);
}
`;

const STRIP_VERT = /* glsl */ `
in vec4 aPos;    // x, y, base depth, unused
in vec4 aSize;   // w, h, row, opacity
in vec4 aTex;    // uOff, uScale, panel, dashDensity
in vec4 aDash;   // dashCycles, dashPhase, copy index, unused
uniform float uU;       // loop progress 0..1
uniform vec3 uCam;
out vec2 vUv;
out float vDist;
out vec4 vSize;
out vec4 vTex;
out vec4 vDash;
void main() {
  // Depth ahead of the camera: base + copy·D − D·u (camera flies D per loop).
  float ahead = aPos.z + aDash.z * ${D.toFixed(1)} - ${D.toFixed(1)} * uU;
  vec3 world = vec3(aPos.x + position.x * aSize.x, aPos.y + position.y * aSize.y, uCam.z - ahead);
  vUv = position.xy + 0.5;
  vDist = ahead;
  vSize = aSize;
  vTex = aTex;
  vDash = aDash;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;
const STRIP_FRAG = /* glsl */ `
precision highp float;
${FOG_GLSL}
uniform sampler2D uAtlas;
uniform vec3 uData;
uniform float uU;
uniform float uRows;
in vec2 vUv;
in float vDist;
in vec4 vSize;
in vec4 vTex;
in vec4 vDash;
out vec4 fragColor;
void main() {
  if (vDist < 0.2) discard;
  // Depth of field: near strips soft (mip bias), middle sharp, far fades into fog.
  float blur = 3.0 * (1.0 - smoothstep(1.0, 6.0, vDist)) + 0.6 * smoothstep(45.0, 75.0, vDist);
  vec2 auv = vec2(vTex.x + vUv.x * vTex.y, (vSize.z + 1.0 - vUv.y) / uRows);
  float t = texture(uAtlas, auv, blur).a;
  // Dash streams sliding along the strip (whole cycles per loop).
  float dpos = vUv.x * vTex.w - vDash.x * uU + vDash.y;
  float dc = fract(dpos);
  float cell = mod(floor(dpos), abs(vDash.x));
  float keep = step(0.45, fract(sin(cell * 91.3458 + vSize.z * 7.13) * 47453.5453));
  float len = 0.15 + 0.5 * fract(sin(cell * 12.9898 + 3.0) * 43758.5453);
  float dashes = keep * smoothstep(0.0, 0.05, dc) * (1.0 - smoothstep(len, len + 0.06, dc));
  float band = smoothstep(0.02, 0.1, vUv.y) * (1.0 - smoothstep(0.1, 0.18, vUv.y));
  float dashA = dashes * band * 0.55;
  // Faint panel fill + edge.
  float edge = max(smoothstep(0.97, 1.0, abs(vUv.x * 2.0 - 1.0)), smoothstep(0.9, 1.0, abs(vUv.y * 2.0 - 1.0)));
  float panel = vTex.z * (1.0 + 2.5 * edge);
  // Soft ends so strips don't look cut.
  float ends = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
  float a = (t + dashA) * vSize.w + panel;
  float near = smoothstep(0.4, 4.0, vDist);
  a *= ends * near * fogVis(vDist);
  fragColor = vec4(uData * a, 1.0);
}
`;

const DOT_VERT = /* glsl */ `
in vec4 aDot;   // x, y, base depth, world size
in vec2 aDot2;  // brightness, copy index
uniform float uU;
uniform vec3 uCam;
uniform vec2 uRes;
out vec2 vUv;
out float vA;
void main() {
  float ahead = aDot.z + aDot2.y * ${D.toFixed(1)} - ${D.toFixed(1)} * uU;
  vec4 clip = projectionMatrix * viewMatrix * vec4(aDot.x, aDot.y, uCam.z - ahead, 1.0);
  // Screen-space sized quad: never smaller than 1.5 px (alpha-compensated),
  // so distant specks don't shimmer.
  float px = aDot.w * projectionMatrix[1][1] * uRes.y * 0.5 / max(clip.w, 0.01);
  float drawn = clamp(px, 1.5, 4.0 * uRes.y / 720.0);
  clip.xy += position.xy * drawn * 2.0 / uRes * clip.w;
  gl_Position = clip;
  vUv = position.xy * 2.0;
  float fog = 1.0 - smoothstep(${FOG_START.toFixed(1)}, ${FOG_END.toFixed(1)}, ahead);
  vA = 1.4 * aDot2.x * min(1.0, (px * px) / (drawn * drawn) * 2.5) * fog * smoothstep(2.0, 8.0, ahead) * step(0.2, ahead);
}
`;
const DOT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uData;
in vec2 vUv;
in float vA;
out vec4 fragColor;
void main() {
  float r2 = dot(vUv, vUv);
  float g = exp(-r2 * 3.0) * (1.0 - smoothstep(0.8, 1.0, r2));
  fragColor = vec4(uData * g * vA, 1.0);
}
`;

const BLOOM_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBloom;
uniform float uAlpha;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  float g = exp(-r2 * 3.2) * (1.0 - smoothstep(0.7, 1.0, r2));
  fragColor = vec4(uBloom * g * uAlpha, 1.0);
}
`;
const BLOOM_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
precision highp float;
${FOG_GLSL}
in vec2 vUv;
out vec4 fragColor;
uniform float uHorizonY;
void main() {
  // Slate fog with a soft lighter haze band at the horizon.
  float h = exp(-pow((vUv.y - uHorizonY) / 0.11, 2.0));
  float side = 1.0 - 0.35 * pow(abs(vUv.x - 0.5) * 2.0, 2.0);
  float away = smoothstep(0.08, 0.45, abs(vUv.y - uHorizonY));
  // Above the horizon the void darkens; below it the floor haze stays lit.
  float below = step(vUv.y, uHorizonY);
  vec3 c = mix(uFog * vec3(0.95, 1.0, 1.12), mix(uFog * 0.62, uFog * vec3(1.15, 1.3, 1.5), below), away);
  c = mix(c, uHorizon, h * side * 0.6);
  fragColor = vec4(c, 1.0);
}
`;
const QUAD_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uGlow;
uniform float uLoopFrame;
uniform float uGrain;
in vec2 vUv;
out vec4 fragColor;
${GLSL_FINAL}
void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uGlow, vUv).rgb * 0.4;
  // Gentle vignette.
  vec2 v = vUv - 0.5;
  c *= 1.0 - 0.35 * dot(v, v) * 2.0;
  c = softClip(c);
  c = grainAndDither(c, gl_FragCoord.xy, uLoopFrame, uGrain);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform float uThreshold;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    float w = exp(-float(i * i) / 18.0);
    vec3 s = texture(uSrc, vUv + uDir * float(i)).rgb;
    s = max(s - uThreshold, 0.0);
    acc += s * w;
    wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}
`;

// ── Scene runtime ────────────────────────────────────────────────────────────
type Runtime = { render: (frame: number) => void; dispose: () => void };

const createRuntime = (gl: THREE.WebGLRenderer, pw: number, ph: number, atlasCanvas: HTMLCanvasElement): Runtime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, pw / ph, 0.1, 400);

  const fogUniforms = {
    uFog: { value: PALETTE.fog.clone() },
    uHorizon: { value: PALETTE.horizon.clone() },
  };
  const camU = { value: new THREE.Vector3() };

  // Background (drawn first, no depth).
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: QUAD_VERT,
    fragmentShader: BG_FRAG,
    uniforms: { ...fogUniforms, uHorizonY: { value: 0.5 } },
    depthTest: false,
    depthWrite: false,
  });
  const bgScene = new THREE.Scene();
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  bgScene.add(new THREE.Mesh(quadGeo, bgMat));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Grid floor & ceiling: big planes that follow the camera; the line pattern
  // is in world space, so it scrolls exactly with the flight.
  const gridMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: GRID_VERT,
    fragmentShader: GRID_FRAG,
    uniforms: { ...fogUniforms, uCam: camU, uGrid: { value: PALETTE.grid.clone() } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const planeGeo = new THREE.PlaneGeometry(240, 120);
  const floor = new THREE.Mesh(planeGeo, gridMat);
  floor.rotation.x = -Math.PI / 2;
  const ceil = new THREE.Mesh(planeGeo, gridMat);
  ceil.rotation.x = Math.PI / 2;
  scene.add(floor, ceil);

  // Data strips: one instanced quad mesh, COPIES × N_STRIPS instances.
  const atlasTex = new THREE.CanvasTexture(atlasCanvas);
  atlasTex.generateMipmaps = true;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTex.magFilter = THREE.LinearFilter;
  atlasTex.anisotropy = 8;
  atlasTex.flipY = false;
  atlasTex.needsUpdate = true;

  const count = N_STRIPS * COPIES;
  const igeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  igeo.index = base.index;
  igeo.setAttribute("position", base.getAttribute("position"));
  const aPos = new Float32Array(count * 4);
  const aSize = new Float32Array(count * 4);
  const aTex = new Float32Array(count * 4);
  const aDash = new Float32Array(count * 4);
  let k = 0;
  for (let c = 0; c < COPIES; c++)
    for (const s of STRIPS) {
      aPos.set([s.x, s.y, s.b, 0], k * 4);
      aSize.set([s.w, s.h, s.row, s.opacity], k * 4);
      aTex.set([s.uOff, s.uScale, s.panel, s.dashDensity], k * 4);
      aDash.set([s.dashCycles, s.dashPhase, c, 0], k * 4);
      k++;
    }
  igeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(aPos, 4));
  igeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(aSize, 4));
  igeo.setAttribute("aTex", new THREE.InstancedBufferAttribute(aTex, 4));
  igeo.setAttribute("aDash", new THREE.InstancedBufferAttribute(aDash, 4));
  igeo.instanceCount = count;
  const uU = { value: 0 };
  const stripMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STRIP_VERT,
    fragmentShader: STRIP_FRAG,
    uniforms: {
      ...fogUniforms,
      uAtlas: { value: atlasTex },
      uData: { value: PALETTE.data.clone() },
      uU,
      uCam: camU,
      uRows: { value: ATLAS_ROWS },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const strips = new THREE.Mesh(igeo, stripMat);
  strips.frustumCulled = false;
  scene.add(strips);

  // Specks and dot-matrix rows.
  const dcount = DOTS.length * COPIES;
  const dgeo = new THREE.InstancedBufferGeometry();
  dgeo.index = base.index;
  dgeo.setAttribute("position", base.getAttribute("position"));
  const aDot = new Float32Array(dcount * 4);
  const aDot2 = new Float32Array(dcount * 2);
  let j = 0;
  for (let c = 0; c < COPIES; c++)
    for (const d of DOTS) {
      aDot.set([d.x, d.y, d.b, d.size], j * 4);
      aDot2.set([d.bright, c], j * 2);
      j++;
    }
  dgeo.setAttribute("aDot", new THREE.InstancedBufferAttribute(aDot, 4));
  dgeo.setAttribute("aDot2", new THREE.InstancedBufferAttribute(aDot2, 2));
  dgeo.instanceCount = dcount;
  const dotMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    uniforms: { uU, uCam: camU, uRes: { value: new THREE.Vector2(pw, ph) }, uData: { value: PALETTE.data.clone() } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const dots = new THREE.Mesh(dgeo, dotMat);
  dots.frustumCulled = false;
  scene.add(dots);

  // Warm light blooms (camera-facing quads), periodic in depth like the strips.
  const bloomGeo = new THREE.PlaneGeometry(1, 1);
  const blooms: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; def: (typeof BLOOMS)[number]; copy: number }[] = [];
  for (let c = 0; c < COPIES; c++)
    for (const def of BLOOMS) {
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: BLOOM_VERT,
        fragmentShader: BLOOM_FRAG,
        uniforms: { uBloom: { value: PALETTE.bloom.clone() }, uAlpha: { value: 0 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(bloomGeo, mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      blooms.push({ mesh, mat, def, copy: c });
    }

  // Targets: half-float MSAA scene, half-res glow ping-pong.
  const rt = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: 4, depthBuffer: false });
  const gw = Math.max(2, Math.round(pw / 2));
  const gh = Math.max(2, Math.round(ph / 2));
  const glowA = new THREE.WebGLRenderTarget(gw, gh, { type: THREE.HalfFloatType, depthBuffer: false });
  const glowB = new THREE.WebGLRenderTarget(gw, gh, { type: THREE.HalfFloatType, depthBuffer: false });
  const blurMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: QUAD_VERT,
    fragmentShader: BLUR_FRAG,
    uniforms: { uSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uThreshold: { value: 0 } },
    depthTest: false,
    depthWrite: false,
  });
  const blurScene = new THREE.Scene();
  blurScene.add(new THREE.Mesh(quadGeo, blurMat));
  const loopU = { value: 0 };
  const finalMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: QUAD_VERT,
    fragmentShader: FINAL_FRAG,
    uniforms: {
      uScene: { value: rt.texture },
      uGlow: { value: glowB.texture },
      uLoopFrame: loopU,
      uGrain: { value: 0.015 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const finalScene = new THREE.Scene();
  finalScene.add(new THREE.Mesh(quadGeo, finalMat));

  gl.autoClear = false;

  const render = (frame: number) => {
    const f = loopFrame(frame);
    const th = loopTheta(frame);
    const u = f / 600;
    uU.value = u;
    loopU.value = f;

    // Camera: forward D per loop + a slight closed sway.
    const camZ = -D * u;
    camera.position.set(0.35 * Math.sin(th + 0.4), 0.15 * Math.sin(2 * th + 1.1), camZ);
    camera.rotation.set(0.02 * Math.sin(th + 2.0), 0.03 * Math.sin(th + 0.9), 0.012 * Math.sin(2 * th + 0.3), "YXZ");
    camera.updateMatrixWorld();
    camU.value.copy(camera.position);
    floor.position.set(0, FLOOR_Y, camZ - 50);
    ceil.position.set(0, CEIL_Y, camZ - 50);

    // Horizon of the background follows the camera pitch.
    const horizon = new THREE.Vector3(camera.position.x, camera.position.y, camZ - 1000).project(camera);
    bgMat.uniforms.uHorizonY.value = horizon.y * 0.5 + 0.5;

    for (const bl of blooms) {
      const ahead = bl.def.b + bl.copy * D - D * u;
      const vis =
        (ahead > 0.5 ? 1 : 0) *
        Math.min(1, Math.max(0, (ahead - 4) / 10)) *
        (1 - Math.min(1, Math.max(0, (ahead - 35) / (FOG_END - 40))));
      const breathe = 0.7 + 0.3 * Math.sin(bl.def.n * th + bl.def.p);
      bl.mat.uniforms.uAlpha.value = bl.def.a * 0.8 * vis * breathe;
      bl.mesh.position.set(bl.def.x, bl.def.y, camZ - ahead);
      bl.mesh.quaternion.copy(camera.quaternion);
      bl.mesh.scale.setScalar(bl.def.r * 1.5);
      bl.mesh.visible = vis > 0;
    }

    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(bgScene, quadCam);
    gl.render(scene, camera);

    // Glow: threshold + separable blur at half res.
    blurMat.uniforms.uSrc.value = rt.texture;
    blurMat.uniforms.uThreshold.value = 0.28;
    blurMat.uniforms.uDir.value.set(2 / pw, 0);
    gl.setRenderTarget(glowA);
    gl.clear();
    gl.render(blurScene, quadCam);
    blurMat.uniforms.uSrc.value = glowA.texture;
    blurMat.uniforms.uThreshold.value = 0;
    blurMat.uniforms.uDir.value.set(0, 2 / ph);
    gl.setRenderTarget(glowB);
    gl.clear();
    gl.render(blurScene, quadCam);

    gl.setRenderTarget(null);
    gl.clear(true, true, true);
    gl.render(finalScene, quadCam);
  };

  const dispose = () => {
    rt.dispose();
    glowA.dispose();
    glowB.dispose();
    atlasTex.dispose();
    igeo.dispose();
    dgeo.dispose();
  };
  return { render, dispose };
};

const FONT_FAMILY = "JetBrains Mono DS";

const SceneDriver: React.FC<{ pw: number; ph: number }> = ({ pw, ph }) => {
  const frame = useCurrentFrame();
  const { gl } = useThree();
  const [handle] = useState(() => delayRender("Data Space: font + atlas"));
  const [atlas, setAtlas] = useState<HTMLCanvasElement | null>(null); // init only
  const rtRef = useRef<Runtime | null>(null);

  useEffect(() => {
    const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")})`);
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        setAtlas(drawStripAtlas(FONT_FAMILY));
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }, [handle]);

  const runtime = useMemo(() => (atlas ? createRuntime(gl, pw, ph, atlas) : null), [atlas, gl, pw, ph]);
  rtRef.current = runtime;
  useEffect(() => () => runtime?.dispose(), [runtime]);

  useLayoutEffect(() => {
    runtime?.render(frame);
  }, [frame, runtime]);
  return null;
};

export const DataSpace: React.FC = () => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.fog.getStyle() }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        gl={{ preserveDrawingBuffer: true, antialias: false, powerPreference: "high-performance" }}
        linear
        flat
      >
        <SceneDriver pw={pw} ph={ph} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

