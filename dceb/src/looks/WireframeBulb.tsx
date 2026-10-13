/**
 * Look 4 — Wireframe Bulb (20s loop).
 * A light bulb built from glowing wireframe (jittered, triangulated lathe
 * glass, coiled filament, dense ribbed screw base) over a busy network
 * background with people icons, numbers, data boxes and bokeh. Pulses run
 * along random edge paths; every period divides 600; background layers drift
 * by whole tiles per loop.
 */
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FAT_LINE_FRAGMENT_HEADER, FAT_LINE_VERTEX_HEADER, buildFatLineGeometry, uniqueEdges } from "../lib/fatLines";
import { loadFonts } from "../lib/fonts";
import { PostSettings } from "../lib/Post";
import { mulberry32 } from "../lib/random";
import { Stage, useAssets, useBufferSize } from "../lib/Stage";
import { LayerSpec, drawLayer, layerTexture } from "./bulbBackground";

export type WireframeBulbProps = {
  /** wire colour (display sRGB hex) */
  line: string;
  /** filament colour */
  filament: string;
  /** background gradient: deep -> bright */
  bgDeep: string;
  bgBright: string;
  /** background network tint */
  network: string;
  exposure: number;
  grain: number;
};

const LOOP = 600;
const FOV = 35;
const CAM_Z = 7.2;
const BULB_TILT = (17 * Math.PI) / 180;
const GLASS_GAIN = 0.38;
const BASE_GAIN = 0.95;
const FIL_GAIN = 0.55;

const col = (hex: string) => new THREE.Color(hex);

// ------------------------------------------------------------------ geometry
const GLASS_PROFILE: [number, number][] = [
  // [radius, y]
  [0.44, 0.78],
  [0.46, 0.95],
  [0.55, 1.2],
  [0.76, 1.5],
  [0.91, 1.8],
  [0.97, 2.1],
  [0.92, 2.4],
  [0.72, 2.66],
  [0.42, 2.82],
  [0.0, 2.88],
];

type Seg = { a: number[]; b: number[]; bright: number[] };
const pushSeg = (s: Seg, p: THREE.Vector3, q: THREE.Vector3, br: number) => {
  s.a.push(p.x, p.y, p.z);
  s.b.push(q.x, q.y, q.z);
  s.bright.push(br);
};

const buildBulb = () => {
  const rng = mulberry32(1017464245);
  const curve = new THREE.CatmullRomCurve3(GLASS_PROFILE.map(([r, y]) => new THREE.Vector3(r, y, 0)));
  const RINGS = 20;
  const SEGS = 22;
  // jittered lathe vertices
  const rows: THREE.Vector3[][] = [];
  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS;
    const p = curve.getPointAt(Math.min(t, 0.999));
    const row: THREE.Vector3[] = [];
    if (j === RINGS) {
      row.push(new THREE.Vector3(0, 2.88, 0));
      rows.push(row);
      break;
    }
    for (let k = 0; k < SEGS; k++) {
      const jitA = j === 0 ? 0 : (rng() - 0.5) * 0.55;
      const jitY = j === 0 ? 0 : (rng() - 0.5) * 0.09;
      const jitR = j === 0 ? 1 : 1 + (rng() - 0.5) * 0.05;
      const ang = ((k + jitA + (j % 2) * 0.5) / SEGS) * Math.PI * 2;
      row.push(new THREE.Vector3(Math.cos(ang) * p.x * jitR, p.y + jitY, Math.sin(ang) * p.x * jitR));
    }
    rows.push(row);
  }
  // triangulate with random diagonals -> irregular triangles
  const tris: number[] = [];
  const verts: THREE.Vector3[] = [];
  const id = (j: number, k: number) => {
    let base = 0;
    for (let q = 0; q < j; q++) base += rows[q].length;
    return base + (k % rows[j].length);
  };
  rows.forEach((r) => verts.push(...r));
  for (let j = 0; j < rows.length - 1; j++) {
    if (rows[j + 1].length === 1) {
      for (let k = 0; k < SEGS; k++) tris.push(id(j, k), id(j, k + 1), id(j + 1, 0));
      continue;
    }
    for (let k = 0; k < SEGS; k++) {
      const a = id(j, k);
      const b = id(j, k + 1);
      const c = id(j + 1, k);
      const d = id(j + 1, k + 1);
      if (rng() < 0.5) tris.push(a, b, d, a, d, c);
      else tris.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts.flatMap((v) => v.toArray()), 3));
  g.setIndex(tris);
  const { verts: V, edges } = uniqueEdges(g);
  g.dispose();

  const glass: Seg = { a: [], b: [], bright: [] };
  edges.forEach(([i, j]) => pushSeg(glass, V[i], V[j], 0.55 + 0.45 * rng()));

  // ---- screw base: dense rings following a thread profile, plus a helix
  const base: Seg = { a: [], b: [], bright: [] };
  const R0 = 0.43;
  const thread = (y: number) => R0 + 0.035 * Math.abs(Math.sin((Math.PI * (y - 0.05)) / 0.11));
  const ringN = 48;
  for (let r = 0; r < 34; r++) {
    const y = 0.05 + (r / 33) * 0.72;
    const rad = thread(y);
    for (let k = 0; k < ringN; k++) {
      const a0 = (k / ringN) * Math.PI * 2;
      const a1 = ((k + 1) / ringN) * Math.PI * 2;
      pushSeg(base, new THREE.Vector3(Math.cos(a0) * rad, y, Math.sin(a0) * rad), new THREE.Vector3(Math.cos(a1) * rad, y, Math.sin(a1) * rad), 1);
    }
  }
  // vertical ribs
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    for (let s = 0; s < 12; s++) {
      const y0 = 0.05 + (s / 12) * 0.72;
      const y1 = 0.05 + ((s + 1) / 12) * 0.72;
      pushSeg(base, new THREE.Vector3(Math.cos(a) * thread(y0), y0, Math.sin(a) * thread(y0)), new THREE.Vector3(Math.cos(a) * thread(y1), y1, Math.sin(a) * thread(y1)), 0.7);
    }
  }
  // contact cone at the bottom
  for (let r = 0; r < 5; r++) {
    const y = -0.18 + r * 0.045;
    const rad = 0.16 + r * 0.06;
    for (let k = 0; k < 32; k++) {
      const a0 = (k / 32) * Math.PI * 2;
      const a1 = ((k + 1) / 32) * Math.PI * 2;
      pushSeg(base, new THREE.Vector3(Math.cos(a0) * rad, y, Math.sin(a0) * rad), new THREE.Vector3(Math.cos(a1) * rad, y, Math.sin(a1) * rad), 0.9);
    }
  }

  // ---- filament: two support wires + a coil along an upward arc
  const fil: Seg = { a: [], b: [], bright: [] };
  const support = (x: number) => {
    const pts = [new THREE.Vector3(x * 0.4, 0.95, 0), new THREE.Vector3(x * 0.6, 1.4, 0), new THREE.Vector3(x, 1.92, 0)];
    for (let i = 0; i < pts.length - 1; i++) pushSeg(fil, pts[i], pts[i + 1], 0.8);
  };
  support(-0.3);
  support(0.3);
  // glass stem
  pushSeg(fil, new THREE.Vector3(-0.12, 0.95, 0), new THREE.Vector3(-0.06, 1.45, 0), 0.5);
  pushSeg(fil, new THREE.Vector3(0.12, 0.95, 0), new THREE.Vector3(0.06, 1.45, 0), 0.5);
  pushSeg(fil, new THREE.Vector3(-0.06, 1.45, 0), new THREE.Vector3(0.06, 1.45, 0), 0.5);
  const arc = (t: number) => {
    // from (-0.3,1.92) up and over to (0.3,1.92)
    const a = Math.PI * (1 - t);
    return new THREE.Vector3(0.3 * Math.cos(a), 1.92 + 0.26 * Math.sin(a), 0);
  };
  const TURNS = 13;
  const STEPS = TURNS * 18;
  let prev: THREE.Vector3 | null = null;
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    const c = arc(t);
    const tan = arc(Math.min(1, t + 1e-3)).sub(arc(Math.max(0, t - 1e-3))).normalize();
    const n1 = new THREE.Vector3(0, 0, 1);
    const n2 = new THREE.Vector3().crossVectors(tan, n1).normalize();
    const th = t * TURNS * Math.PI * 2;
    const p = c.clone().addScaledVector(n1, Math.cos(th) * 0.055).addScaledVector(n2, Math.sin(th) * 0.055);
    if (prev) pushSeg(fil, prev, p, 1);
    prev = p;
  }

  // ---- pulse paths: random walks over the glass edges
  const adj = new Map<number, number[]>();
  edges.forEach(([i, j]) => {
    adj.set(i, [...(adj.get(i) ?? []), j]);
    adj.set(j, [...(adj.get(j) ?? []), i]);
  });
  const pulse = { a: [] as number[], b: [] as number[], ua: [] as number[], ub: [] as number[], data: [] as number[] };
  const periods = [100, 120, 150, 200, 300];
  for (let p = 0; p < 28; p++) {
    let cur = Math.floor(rng() * V.length);
    const L = 7 + Math.floor(rng() * 6);
    const path = [cur];
    for (let s = 0; s < L; s++) {
      const nb = adj.get(cur) ?? [];
      const next = nb.filter((x) => !path.includes(x));
      if (!next.length) break;
      cur = next[Math.floor(rng() * next.length)];
      path.push(cur);
    }
    const period = periods[Math.floor(rng() * periods.length)];
    const phase = rng();
    for (let s = 0; s < path.length - 1; s++) {
      const A = V[path[s]];
      const B = V[path[s + 1]];
      pulse.a.push(A.x, A.y, A.z);
      pulse.b.push(B.x, B.y, B.z);
      pulse.ua.push(s / (path.length - 1));
      pulse.ub.push((s + 1) / (path.length - 1));
      pulse.data.push(period, phase, 1);
    }
  }
  return { glass, base, fil, pulse, vertices: V };
};

// ------------------------------------------------------------------ shaders
const WIRE_VS = /* glsl */ `
${FAT_LINE_VERTEX_HEADER}
attribute float aBright;
varying float vBright;
void main() {
  vBright = aBright;
  gl_Position = fatLinePosition(projectionMatrix * modelViewMatrix, 1.0);
}`;
const WIRE_FS = /* glsl */ `
${FAT_LINE_FRAGMENT_HEADER}
uniform vec3 uColor;
uniform float uGain;
varying float vBright;
void main() {
  gl_FragColor = vec4(uColor * uGain * vBright * fatLineCoverage(), 1.0);
}`;

const PULSE_VS = /* glsl */ `
${FAT_LINE_VERTEX_HEADER}
attribute float aU;
attribute vec3 aPulse;
varying float vU;
varying vec3 vPulse;
void main() {
  vU = aU;
  vPulse = aPulse;
  gl_Position = fatLinePosition(projectionMatrix * modelViewMatrix, 1.6);
}`;
const PULSE_FS = /* glsl */ `
${FAT_LINE_FRAGMENT_HEADER}
uniform vec3 uColor;
uniform float uFrame;
varying float vU;
varying vec3 vPulse;
void main() {
  float p = fract(uFrame / vPulse.x + vPulse.y) * 1.4 - 0.2;
  float d = vU - p;
  float head = exp(-pow(d / 0.06, 2.0));
  float tail = d < 0.0 ? exp(d / 0.18) * 0.35 : 0.0;
  gl_FragColor = vec4(uColor * (head * 1.0 + tail * 0.4) * fatLineCoverage(), 1.0);
}`;

const PTS_VS = /* glsl */ `
uniform float uSize;
uniform vec2 uResolution;
attribute float aSize;
varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float s = uSize * aSize * uResolution.y / 1080.0;
  gl_PointSize = max(s, 1.5);
  vA = clamp(s / 1.5, 0.0, 1.0);
}`;
const PTS_FS = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  float a = exp(-r * 4.0) * smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(uColor * a * vA, 1.0);
}`;

const BG_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`;
const BG_FS = /* glsl */ `
uniform vec3 cDeep;
uniform vec3 cBright;
varying vec2 vUv;
void main() {
  // brighter toward the upper right, deep toward the lower left
  // patchy: a brighter haze upper-middle/right, dark pockets lower left
  float t = 0.6 * exp(-pow(length((vUv - vec2(0.62, 0.68)) * vec2(1.2, 1.6)), 2.0) * 2.2);
  gl_FragColor = vec4(mix(cDeep, cBright, t), 1.0);
}`;

const LAYER_VS = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRepeat;
uniform vec2 uOffset;
void main() {
  vUv = uv * uRepeat + uOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// Depth of field for the flat network layers: a resolution-independent mip
// blur (blur radius given as a fraction of the frame height, converted to
// texels), never less than the LOD needed for anti-aliasing.
const LAYER_FS = /* glsl */ `
uniform sampler2D tMap;
uniform vec3 uColor;
uniform float uGain;
uniform vec2 uTexSize;
uniform float uBlurTexels;
varying vec2 vUv;
void main() {
  vec2 t = vUv * uTexSize;
  float auto_ = log2(max(max(length(dFdx(t)), length(dFdy(t))), 1e-4));
  float lod = max(auto_, log2(max(uBlurTexels, 1.0)));
  float a = textureLod(tMap, vUv, lod).r;
  gl_FragColor = vec4(uColor * a * uGain, 1.0);
}`;

const BOKEH_VS = /* glsl */ `
uniform vec2 uResolution;
uniform float uFrame;
attribute vec4 aB; // size(px@1080), speed (tiles/loop), alpha, region width
varying float vAlpha;
void main() {
  vec3 p = position;
  // wrap horizontally inside a region wider than the view: whole regions per loop
  p.x = mod(p.x + aB.w * aB.y * uFrame / 600.0 + aB.w * 0.5, aB.w) - aB.w * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = aB.x * uResolution.y / 1080.0 * (6.0 / -mv.z);
  gl_PointSize = max(s, 1.0);
  vAlpha = aB.z * clamp(s, 0.0, 1.0);
}`;
const BOKEH_FS = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  float a = smoothstep(1.0, 0.82, r) * (0.65 + 0.35 * smoothstep(0.55, 0.95, r));
  gl_FragColor = vec4(uColor * a * vAlpha, 1.0);
}`;

const additive = { transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending } as const;

// background layers: depth, tile spec, repeat, drift tiles per loop
const LAYERS: { z: number; repeat: number; drift: [number, number]; gain: number; blur: number; spec: LayerSpec }[] = [
  {
    z: -16,
    repeat: 2,
    drift: [1, 0],
    gain: 0.55,
    blur: 0.012,
    spec: { w: 2048, h: 1152, seed: 11, nodes: 700, linkDist: 70, people: 48, numbers: 22, boxes: 8, lineAlpha: 0.8, hubs: 0, nodeSize: 2.2, iconSize: 22, fontSize: 15, },
  },
  {
    z: -9,
    repeat: 2,
    drift: [-1, 0],
    gain: 0.7,
    blur: 0.006,
    spec: { w: 2048, h: 1152, seed: 22, nodes: 500, linkDist: 85, people: 50, numbers: 28, boxes: 10, lineAlpha: 0.85, hubs: 3, nodeSize: 2.4, iconSize: 26, fontSize: 17 },
  },
  {
    z: -3.2,
    repeat: 2,
    drift: [1, 0],
    gain: 1.15,
    blur: 0.0012,
    spec: { w: 3072, h: 1728, seed: 33, nodes: 260, linkDist: 230, people: 22, numbers: 30, boxes: 12, hubs: 6, lineAlpha: 1.0, nodeSize: 4.2, iconSize: 58, fontSize: 34 },
  },
];

type Assets = { layers: THREE.Texture[] };

const Scene: React.FC<WireframeBulbProps & { assets: Assets }> = (p) => {
  const frame = useCurrentFrame();
  const { camera } = useThree();
  const buf = useBufferSize();
  const resolution = useMemo(() => new THREE.Vector2(1, 1), []);
  const data = useMemo(buildBulb, []);

  const objs = useMemo(() => {
    const root = new THREE.Group();
    const bulb = new THREE.Group();
    const lineColor = col(p.line);
    const mk = (s: Seg, color: THREE.Color, width: number, gain: number) => {
      const geo = buildFatLineGeometry(s.a, s.b, {}, { aBright: { size: 1, data: s.bright } });
      const mat = new THREE.ShaderMaterial({
        vertexShader: WIRE_VS,
        fragmentShader: WIRE_FS,
        uniforms: { uResolution: { value: resolution }, uWidth: { value: width }, uColor: { value: color }, uGain: { value: gain } },
        ...additive,
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      bulb.add(m);
      return mat;
    };
    const glassMat = mk(data.glass, lineColor, 1.5, GLASS_GAIN);
    const baseMat = mk(data.base, lineColor.clone().lerp(new THREE.Color(1, 1, 1), 0.05), 1.6, BASE_GAIN);
    const filMat = mk(data.fil, col(p.filament), 2.0, FIL_GAIN);

    const pulseGeo = buildFatLineGeometry(data.pulse.a, data.pulse.b, { aU: { size: 1, a: data.pulse.ua, b: data.pulse.ub } }, { aPulse: { size: 3, data: data.pulse.data } });
    const pulseMat = new THREE.ShaderMaterial({
      vertexShader: PULSE_VS,
      fragmentShader: PULSE_FS,
      uniforms: { uResolution: { value: resolution }, uWidth: { value: 1.5 }, uColor: { value: lineColor.clone().lerp(new THREE.Color(1, 1, 1), 0.3) }, uFrame: { value: 0 } },
      ...additive,
    });
    const pulses = new THREE.Mesh(pulseGeo, pulseMat);
    pulses.frustumCulled = false;
    bulb.add(pulses);

    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(data.vertices.flatMap((v) => v.toArray()), 3));
    pg.setAttribute("aSize", new THREE.Float32BufferAttribute(data.vertices.map((_, i) => 0.7 + ((i * 7919) % 10) / 12), 1));
    const ptsMat = new THREE.ShaderMaterial({
      vertexShader: PTS_VS,
      fragmentShader: PTS_FS,
      uniforms: { uSize: { value: 6 }, uResolution: { value: resolution }, uColor: { value: lineColor.clone().multiplyScalar(1.4) } },
      ...additive,
    });
    const pts = new THREE.Points(pg, ptsMat);
    pts.frustumCulled = false;
    bulb.add(pts);

    // bulb placement: left half, tilted, filling the frame height
    const bulbHolder = new THREE.Group();
    bulbHolder.position.set(-1.45, -1.75, 0);
    bulbHolder.rotation.set(0.12, 0, BULB_TILT);
    bulbHolder.scale.setScalar(1.24);
    bulbHolder.add(bulb);
    root.add(bulbHolder);

    // background gradient
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VS,
      fragmentShader: BG_FS,
      uniforms: { cDeep: { value: col(p.bgDeep) }, cBright: { value: col(p.bgBright) } },
      depthTest: false,
      depthWrite: false,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;

    // network layers
    const tanH = Math.tan(((FOV / 2) * Math.PI) / 180);
    const layerMats = LAYERS.map((L, i) => {
      const dist = CAM_Z - L.z;
      const hgt = 2 * dist * tanH * 1.3;
      const wid = hgt * (16 / 9);
      const mat = new THREE.ShaderMaterial({
        vertexShader: LAYER_VS,
        fragmentShader: LAYER_FS,
        uniforms: {
          tMap: { value: p.assets.layers[i] },
          uColor: { value: col(p.network) },
          uGain: { value: L.gain },
          uRepeat: { value: new THREE.Vector2(L.repeat, L.repeat) },
          uOffset: { value: new THREE.Vector2() },
          uTexSize: { value: new THREE.Vector2(L.spec.w, L.spec.h) },
          // frame height ≈ plane height / 1.3 = repeat * tile height / 1.3 texels
          uBlurTexels: { value: (L.blur * L.repeat * L.spec.h) / 1.3 },
        },
        ...additive,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), mat);
      m.position.z = L.z;
      m.frustumCulled = false;
      root.add(m);
      return mat;
    });

    // bokeh discs
    const rng = mulberry32(4044);
    const N = 400;
    const pos: number[] = [];
    const ab: number[] = [];
    for (let i = 0; i < N; i++) {
      const z = -1.5 - rng() * 20;
      const dist = CAM_Z - z;
      const hh = dist * tanH * 1.2;
      const region = hh * (16 / 9) * 2 * 1.5;
      pos.push((rng() - 0.5) * region, (rng() * 2 - 1) * hh, z);
      ab.push(12 + 70 * rng() * rng(), rng() < 0.5 ? 1 : -1, 0.04 + 0.16 * rng(), region);
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bgeo.setAttribute("aB", new THREE.Float32BufferAttribute(ab, 4));
    const bokehMat = new THREE.ShaderMaterial({
      vertexShader: BOKEH_VS,
      fragmentShader: BOKEH_FS,
      uniforms: { uResolution: { value: resolution }, uFrame: { value: 0 }, uColor: { value: col(p.line) } },
      ...additive,
    });
    const bokeh = new THREE.Points(bgeo, bokehMat);
    bokeh.frustumCulled = false;
    root.add(bokeh);

    return { root, bulb, bg, glassMat, baseMat, filMat, pulseMat, ptsMat, layerMats, bokehMat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, p.assets]);

  useLayoutEffect(() => {
    resolution.set(buf.w, buf.h);
    const ph = (2 * Math.PI * frame) / LOOP;
    const cam = camera as THREE.PerspectiveCamera;
    // slow closed drift ±3°
    const yaw = ((3 * Math.PI) / 180) * Math.sin(ph);
    const pitch = ((2 * Math.PI) / 180) * Math.sin(2 * ph + 0.6);
    cam.fov = FOV;
    cam.near = 0.1;
    cam.far = 60;
    cam.position.set(Math.sin(yaw) * CAM_Z, Math.sin(pitch) * CAM_Z, Math.cos(yaw) * Math.cos(pitch) * CAM_Z);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // bulb turns slightly about its own axis (±8°, cosine) and breathes ±10%
    objs.bulb.rotation.y = ((8 * Math.PI) / 180) * Math.cos(ph);
    const breathe = 1 + 0.1 * Math.sin(2 * ph);
    objs.glassMat.uniforms.uGain.value = GLASS_GAIN * breathe;
    objs.baseMat.uniforms.uGain.value = BASE_GAIN * breathe;
    objs.filMat.uniforms.uGain.value = FIL_GAIN * breathe;
    objs.pulseMat.uniforms.uFrame.value = frame % LOOP;
    objs.bokehMat.uniforms.uFrame.value = frame % LOOP;
    LAYERS.forEach((L, i) => {
      const t = (frame % LOOP) / LOOP;
      objs.layerMats[i].uniforms.uOffset.value.set(L.drift[0] * t, L.drift[1] * t);
    });
  }, [frame, camera, buf.w, buf.h, objs, resolution]);

  return (
    <>
      <primitive object={objs.bg} />
      <primitive object={objs.root} />
    </>
  );
};

export const WireframeBulb: React.FC<WireframeBulbProps> = (props) => {
  const assets = useAssets<Assets>("bulb background", async () => {
    await loadFonts();
    return { layers: LAYERS.map((L) => layerTexture(drawLayer(L.spec))) };
  });
  const post: PostSettings = useMemo(
    () => ({
      exposure: props.exposure,
      toneMap: "aces",
      bloom: { strength: 0.95, threshold: 0.4, knee: 0.35, radius: 0.9 },
      grain: props.grain,
      dither: true,
      vignette: 0.7,
      clear: [0, 0, 0],
      noisePeriod: LOOP,
    }),
    [props.exposure, props.grain],
  );
  if (!assets) return <AbsoluteFill style={{ backgroundColor: props.bgDeep }} />;
  return (
    <Stage background={props.bgDeep} post={post} camera={{ fov: FOV, near: 0.1, far: 60 }}>
      <Scene {...props} assets={assets} />
    </Stage>
  );
};
