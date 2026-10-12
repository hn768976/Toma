// Look 4 — World Connections (3D). A tilted dot-grid world map with city
// lights, arcs carrying light pulses, and flickering beams.

import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { fsMaterial, fullscreenMesh, vec3Of } from "../gl/fullscreen";
import { buildPointsGeometry, buildRibbonGeometry, dofUniforms, hexRGB, pointsMaterial, ribbonMaterial, RibbonLine } from "../gl/materials";
import { PostFX } from "../gl/post";
import { Stage, StageFactory } from "../gl/Stage";
import { LOOP, phase } from "../lib/loop";
import { mulberry32, range } from "../lib/random";
import { CITIES, gcAngle, isLand } from "../world/world";
import { WorldPalette } from "../versions";

export interface WorldConnectionsProps {
  seed: number;
  palette: WorldPalette;
}

const LAT_MIN = -57;
const LAT_MAX = 83;
const SX = 0.01; // map units per degree of longitude
const SY = 0.0112; // per degree of latitude (slightly stretched, Miller-like)
const TILT = (27 * Math.PI) / 180;
const PERIODS = [150, 200, 300, 600];

const toMap = (lat: number, lon: number) => new THREE.Vector3(lon * SX, (lat - (LAT_MIN + LAT_MAX) / 2) * SY, 0);

const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec3 uBg;
uniform vec3 uHaze;
uniform float uT;
uniform vec2 uRes;
float box(vec2 p, vec2 c, vec2 h, float soft) {
  vec2 d = abs(p - c) - h;
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  return 1.0 - smoothstep(-soft, soft, sd);
}
void main() {
  vec2 p = vUv;
  vec3 col = uBg;
  // lighter haze at the top
  col += uHaze * pow(smoothstep(0.2, 1.05, p.y), 1.3) * 1.0;
  col += uHaze * 0.18 * exp(-pow((p.y - 0.95) / 0.25, 2.0)) * (0.7 + 0.3 * sin(p.x * 3.0 + 1.0));
  // faint large translucent panels in the background, slowly drifting
  vec2 q = vec2(p.x * uRes.x / uRes.y, p.y);
  float d = 0.01 * sin(uT);
  float panels = 0.0;
  panels += box(q, vec2(0.30 + d, 0.70), vec2(0.20, 0.13), 0.02);
  panels += box(q, vec2(0.95 - d, 0.80), vec2(0.28, 0.10), 0.02);
  panels += box(q, vec2(1.45 + d, 0.62), vec2(0.18, 0.16), 0.02);
  panels += box(q, vec2(0.62, 0.28 + d), vec2(0.34, 0.06), 0.02);
  panels += box(q, vec2(1.35 - d, 0.22), vec2(0.22, 0.09), 0.02);
  col += vec3(0.55, 0.65, 0.8) * panels * 0.028;
  // faint circuit lines low in the frame
  float lw = 1.5 / uRes.y;
  float gl = 0.0;
  for (int i = 0; i < 5; i++) {
    float y = 0.06 + float(i) * 0.035;
    gl += (1.0 - smoothstep(0.0, lw, abs(p.y - y))) * step(0.1 + 0.13 * float(i), p.x) * step(p.x, 0.55 + 0.08 * float(i));
  }
  col += uHaze * gl * 0.12;
  fragColor = vec4(col, 1.0);
}`;

const makeFactory =
  (props: WorldConnectionsProps): StageFactory =>
  ({ renderer, width, height }) => {
    const pal = props.palette;
    const rng = mulberry32(props.seed * 977 + 13);
    const k = height / 720; // px scale relative to 720p
    const dof = dofUniforms(4.2, 40 * k, 12 * k);
    // world-up expressed in the tilted map's local frame
    const UP = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));

    const root = new THREE.Group();
    root.rotation.x = -TILT;
    const scene = new THREE.Scene();
    scene.add(root);

    // ---- land dots: 1° grid ----
    const cityPos = CITIES.map(([la, lo]) => toMap(la, lo));
    const dotPos: number[] = [];
    const dotCol: number[] = [];
    const dotSize: number[] = [];
    const dotPar: number[] = [];
    const dc = hexRGB(pal.dots);
    for (let la = LAT_MIN + 0.5; la < LAT_MAX; la += 1) {
      for (let lo = -179.5; lo < 180; lo += 1) {
        if (!isLand(lo, la)) continue;
        const p = toMap(la, lo);
        let near = 0;
        for (const c of cityPos) near += Math.exp(-p.distanceToSquared(c) / (2 * 0.05 * 0.05));
        const b = 0.95 + 0.3 * rng() + Math.min(1.2, near) * 0.9;
        dotPos.push(p.x, p.y, 0);
        dotCol.push(dc[0], dc[1], dc[2], Math.min(2.0, b));
        dotSize.push(1.7 + 0.4 * rng() + Math.min(1, near) * 0.6);
        dotPar.push(1 + Math.floor(rng() * 3), rng() * 6.283);
      }
    }
    const uPhase = { value: 0 };
    const dots = new THREE.Points(
      buildPointsGeometry(new Float32Array(dotPos), new Float32Array(dotCol), new Float32Array(dotSize), new Float32Array(dotPar)),
      pointsMaterial({
        basePx: k,
        dof,
        hard: 0.65,
        uniforms: { uPhase },
        vertMod: "amod = 0.72 + 0.28 * sin(uPhase * param.x + param.y);",
      }),
    );
    dots.frustumCulled = false;
    root.add(dots);

    // ---- city lights: glow sprites + cores ----
    const cc = hexRGB(pal.cities);
    const glowPos: number[] = [];
    const glowCol: number[] = [];
    const glowSize: number[] = [];
    const glowPar: number[] = [];
    cityPos.forEach((p) => {
      const big = 0.6 + 0.4 * rng();
      // wide soft glow
      glowPos.push(p.x, p.y, 0.001);
      glowCol.push(cc[0], cc[1], cc[2], 0.32 * big);
      glowSize.push(34 * big);
      glowPar.push(1 + Math.floor(rng() * 2), rng() * 6.283);
      // bright core
      glowPos.push(p.x, p.y, 0.002);
      glowCol.push(1, 1, 1, 1.4);
      glowSize.push(4.5 * big);
      glowPar.push(2, rng() * 6.283);
    });
    const glows = new THREE.Points(
      buildPointsGeometry(new Float32Array(glowPos), new Float32Array(glowCol), new Float32Array(glowSize), new Float32Array(glowPar)),
      pointsMaterial({ basePx: k, dof, hard: 0, uniforms: { uPhase }, vertMod: "amod = 0.8 + 0.2 * sin(uPhase * param.x + param.y);" }),
    );
    glows.frustumCulled = false;
    root.add(glows);

    // ---- arcs ----
    const pairs: [number, number][] = [];
    const used = new Set<string>();
    let guard = 0;
    while (pairs.length < 24 && guard++ < 5000) {
      const a = Math.floor(rng() * CITIES.length);
      const b = Math.floor(rng() * CITIES.length);
      if (a === b) continue;
      const ang = gcAngle(CITIES[a], CITIES[b]);
      if (ang < 0.55 || ang > 2.4) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (used.has(key)) continue;
      used.add(key);
      pairs.push([a, b]);
    }
    const ac = hexRGB(pal.arcs);
    const arcLines: RibbonLine[] = pairs.map(([a, b], i) => {
      const A = cityPos[a];
      const B = cityPos[b];
      const d = A.distanceTo(B);
      const C = A.clone().add(B).multiplyScalar(0.5);
      C.addScaledVector(UP, d * 0.45);
      const pts: number[] = [];
      for (let s = 0; s <= 80; s++) {
        const t = s / 80;
        const u = 1 - t;
        pts.push(u * u * A.x + 2 * u * t * C.x + t * t * B.x, u * u * A.y + 2 * u * t * C.y + t * t * B.y, u * u * A.z + 2 * u * t * C.z + t * t * B.z);
      }
      const period = i % PERIODS.length;
      return { pts, color: ac, alpha: 0.3, width: 1.1, seed: period + range(rng, 0, 0.999) };
    });
    const uF = { value: 0 };
    const pulseCol = new THREE.Vector3(...hexRGB(pal.pulse));
    const arcs = new THREE.Mesh(
      buildRibbonGeometry(arcLines),
      ribbonMaterial({
        basePx: k,
        resolution: [width, height],
        dof,
        uniforms: { uF, uPulseCol: { value: pulseCol } },
        fragMod: `
          float idx = floor(vParam.y);
          float per = idx < 0.5 ? ${PERIODS[0]}.0 : idx < 1.5 ? ${PERIODS[1]}.0 : idx < 2.5 ? ${PERIODS[2]}.0 : ${PERIODS[3]}.0;
          float head = fract(uF / per + fract(vParam.y));
          float dd = fract(head - vParam.x);          // distance behind the head
          float tail = exp(-dd / 0.045) * step(dd, 0.35);
          bmod = 1.0 + 6.0 * tail;
          // fade the very ends into the city glow
          bmod *= smoothstep(0.0, 0.04, vParam.x) * smoothstep(1.0, 0.96, vParam.x);
        `,
      }),
    );
    arcs.frustumCulled = false;
    root.add(arcs);

    // ---- vertical beams ----
    const bc = hexRGB(pal.beams);
    const beamCities = [...Array(CITIES.length).keys()].sort((x, y) => ((x * 7919 + props.seed) % 41) - ((y * 7919 + props.seed) % 41)).slice(0, 10);
    const beamLines: RibbonLine[] = beamCities.map((ci, i) => {
      const p = cityPos[ci];
      const h = 0.35 + 0.35 * rng();
      return { pts: [p.x, p.y, 0, p.x + UP.x * h, p.y + UP.y * h, UP.z * h], color: bc, alpha: 0.55, width: 1.1, seed: i * 7 + 1 };
    });
    const beams = new THREE.Mesh(
      buildRibbonGeometry(beamLines),
      ribbonMaterial({
        basePx: k,
        resolution: [width, height],
        dof,
        uniforms: { uF },
        fragMod: `
          uint h = uint(floor(uF / 3.0)) * 747796405u + uint(vParam.y) * 2891336453u;
          h = (h ^ (h >> 16u)) * 2246822519u; h ^= h >> 13u;
          float fl = float(h & 1023u) / 1023.0;
          bmod = (fl < 0.25 ? 0.15 : 0.6 + 0.4 * fl) * (1.0 - vParam.x) * step(0.45, fract(vParam.x * 26.0));
        `,
      }),
    );
    beams.frustumCulled = false;
    root.add(beams);

    // ---- background ----
    const bgMat = fsMaterial(BG_FRAG, {
      uBg: { value: vec3Of(pal.background) },
      uHaze: { value: vec3Of(pal.haze) },
      uT: { value: 0 },
      uRes: { value: new THREE.Vector2(width, height) },
    });
    const bgScene = new THREE.Scene();
    bgScene.add(fullscreenMesh(bgMat));
    const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const cam = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    const post = new PostFX(width, height, { bloom: { strength: 0.6, threshold: 0.5, knee: 0.4, radius: 1 }, vignette: 0.3, grain: 0.015 });
    return {
      render(r, f) {
        const ph = phase(f, 1);
        const push = 1 + 0.04 * Math.sin(ph);
        const dist = 3.8 / push;
        cam.position.set(0.12 * Math.sin(ph + 0.4), -0.05 + 0.06 * Math.cos(ph), dist);
        cam.lookAt(0.02 * Math.sin(ph + 1.3), 0.12, 0);
        cam.updateMatrixWorld(true);
        dof.uFocus.value = dist;
        uPhase.value = ph;
        uF.value = f;
        bgMat.uniforms.uT.value = ph;
        post.render(r, f, (rr) => {
          rr.render(bgScene, ocam);
          rr.render(scene, cam);
        });
      },
      dispose() {
        post.dispose();
      },
    };
  };

export const WorldConnections: React.FC<WorldConnectionsProps> = (props) => {
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useMemo(() => makeFactory(props), [key]);
  return (
    <AbsoluteFill style={{ background: props.palette.background }}>
      <Stage factory={factory} />
    </AbsoluteFill>
  );
};

export const WORLD_LOOP = LOOP;
