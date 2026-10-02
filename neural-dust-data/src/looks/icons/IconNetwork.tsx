import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeLook, WorldFactory } from "../../lib/three/ThreeLook";
import { DOF_GLSL, PostPipeline } from "../../lib/three/post";
import { LineBuilder, makeLineMaterial, makeLineMesh } from "../../lib/three/lines";
import { mulberry32 } from "../../lib/random";
import { bakeInstances } from "../../lib/three/bake";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hexToRgb } from "../../lib/color";
import { CHECK_PATH, ICON_PATHS } from "./icons";
import { IconVersion } from "./versions";

export const ICON_FRAMES = 450;

// ---------------------------------------------------------------------------
// Tile field, built once at module level from a fixed seed.
// ---------------------------------------------------------------------------
const SP = 2.9; // lattice spacing
const NX = 84;
const NZ = 96;
const Z0 = 22; // nearest row z
type Tile = { x: number; z: number; i: number; j: number; icon: number; act: number; house: boolean };

const FIELD = (() => {
  const rnd = mulberry32(4069127725);
  const tiles: Tile[] = [];
  const index: number[][] = [];
  for (let j = 0; j < NZ; j++) {
    index.push([]);
    for (let i = 0; i < NX; i++) {
      const x = (i - NX / 2) * SP + (rnd() - 0.5) * 1.5;
      const z = Z0 - j * SP + (rnd() - 0.5) * 1.5;
      // activation: spreads outward from the tile nearest the origin, + seeded jitter
      const d = Math.hypot(x, z) / SP;
      const willAct = d < 0.8 || rnd() < 0.2;
      const act = willAct ? 18 + d * 2.6 + rnd() * 34 : 1e6;
      index[j].push(tiles.length);
      tiles.push({ x, z, i, j, icon: Math.floor(rnd() * ICON_PATHS.length), act, house: rnd() < 0.08 });
    }
  }
  // links between neighbours (right, forward, some diagonals)
  const links: [number, number][] = [];
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const a = index[j][i];
      if (i + 1 < NX && rnd() < 0.82) links.push([a, index[j][i + 1]]);
      if (j + 1 < NZ && rnd() < 0.82) links.push([a, index[j + 1][i]]);
      if (i + 1 < NX && j + 1 < NZ && rnd() < 0.22) links.push([a, index[j + 1][i + 1]]);
      if (i > 0 && j + 1 < NZ && rnd() < 0.12) links.push([a, index[j + 1][i - 1]]);
    }
  const specks: number[] = [];
  for (let k = 0; k < 4000; k++) specks.push((rnd() - 0.5) * 140, 0.3 + rnd() * 5, Z0 + 10 - rnd() * 160, rnd());
  return { tiles, links, specks };
})();

// ---------------------------------------------------------------------------
// Camera: 0-90 close, 90-360 pull back and rise, 360-450 slow drift.
// ---------------------------------------------------------------------------
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);
const CLOSE_POS = [3.4, 6.6, 4.4];
const CLOSE_TGT = [0.4, 0, -0.6];
const WIDE_POS = [20, 60, 22];
const WIDE_TGT = [-2, 0, -20];
export const cameraAt = (f: number) => {
  let pos: number[];
  let tgt: number[];
  if (f <= 90) {
    const t = f / 90;
    pos = [CLOSE_POS[0] - 0.9 * t, CLOSE_POS[1] + 0.25 * t, CLOSE_POS[2] + 0.5 * t];
    tgt = [CLOSE_TGT[0] - 0.4 * t, 0, CLOSE_TGT[2] - 0.1 * t];
  } else if (f <= 360) {
    const t = ease((f - 90) / 270);
    const p0 = [CLOSE_POS[0] - 0.9, CLOSE_POS[1] + 0.25, CLOSE_POS[2] + 0.5];
    const t0 = [CLOSE_TGT[0] - 0.4, 0, CLOSE_TGT[2] - 0.1];
    // rise a little faster than we pull back, so the reveal reads as "up and out"
    const tp = Math.pow(t, 0.85);
    pos = lerp3(p0, WIDE_POS, tp);
    tgt = lerp3(t0, WIDE_TGT, t);
  } else {
    const t = (f - 360) / 90;
    pos = [WIDE_POS[0] - 3 * t, WIDE_POS[1] + 1.2 * t, WIDE_POS[2] - 2 * t];
    tgt = [WIDE_TGT[0] - 2.5 * t, 0, WIDE_TGT[2] - 2 * t];
  }
  return { pos, tgt };
};

// ---------------------------------------------------------------------------
const drawIconAtlas = (v: IconVersion) => {
  const cell = 128;
  const c = document.createElement("canvas");
  c.width = cell * 4;
  c.height = cell * 4;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  const draw = (d: string, k: number, color: string, lw: number) => {
    g.save();
    g.translate((k % 4) * cell + cell * 0.18, Math.floor(k / 4) * cell + cell * 0.18);
    g.scale((cell * 0.64) / 24, (cell * 0.64) / 24);
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke(new Path2D(d));
    g.restore();
  };
  ICON_PATHS.forEach((p, k) => draw(p.d, k, "#FFFFFF", 1.7));
  // cell 10: check mark badge (green circle + check)
  const k = 10;
  g.save();
  g.translate((k % 4) * cell, Math.floor(k / 4) * cell);
  g.fillStyle = v.active;
  g.globalAlpha = 0.28;
  g.beginPath();
  g.arc(cell / 2, cell / 2, cell * 0.42, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = v.active;
  g.lineWidth = cell * 0.055;
  g.stroke();
  g.scale(cell / 24, cell / 24);
  g.strokeStyle = "#FFFFFF";
  g.lineWidth = 2.4;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke(new Path2D(CHECK_PATH));
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

const FOG_GLSL = /* glsl */ `
uniform float uFogNear; uniform float uFogFar;
float fogOf(float d) { return clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0); }
`;
const fogUniforms = () => ({ uFogNear: { value: 30 }, uFogFar: { value: 220 } });

const tileGeometry = () => {
  const s = 0.5;
  const r = 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  // two stacked glass plates: the icon plate on top, a thinner ghost plate under it
  const top = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 4 });
  top.rotateX(-Math.PI / 2);
  top.translate(0, 0.1, 0);
  const under = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 4 });
  under.rotateX(-Math.PI / 2);
  under.scale(0.97, 1, 0.97);
  return mergeGeometries([top, under])!;
};

const houseGeometry = () => {
  const body = new THREE.BoxGeometry(0.34, 0.26, 0.3);
  body.translate(0, 0.13, 0);
  const tri = new THREE.Shape();
  tri.moveTo(-0.21, 0);
  tri.lineTo(0.21, 0);
  tri.lineTo(0, 0.17);
  tri.lineTo(-0.21, 0);
  const roof = new THREE.ExtrudeGeometry(tri, { depth: 0.36, bevelEnabled: false });
  roof.translate(0, 0.26, -0.18);
  const merged = new THREE.BufferGeometry();
  const parts = [body.toNonIndexed(), roof.toNonIndexed()];
  const pos: number[] = [];
  const nrm: number[] = [];
  for (const p of parts) {
    p.computeVertexNormals();
    pos.push(...(p.attributes.position.array as Float32Array));
    nrm.push(...(p.attributes.normal.array as Float32Array));
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return merged;
};

export const createIconNetwork =
  (version: IconVersion): WorldFactory =>
  (gl, w, h) => {
    const v = version;
    const post = new PostPipeline(gl, w, h, {
      slices: [0, 5, 12, 24, 42],
      bloomWeights: [0.25, 0.2, 0.14, 0.08, 0.05, 0.03],
      bloomThreshold: 0.1,
      exposure: 1.0,
      vignette: 0.4,
      grain: 0.02,
      loop: ICON_FRAMES,
    });
    const fog = fogUniforms();
    const frameU = { value: 0 };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 900);
    const atlas = drawIconAtlas(v);
    const C = (hex: string) => new THREE.Color(...hexToRgb(hex));

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.ShaderMaterial({
        uniforms: { ...post.dof, ...fog, uFloor: { value: C(v.floor) }, uHorizon: { value: C(v.horizon) } },
        vertexShader: /* glsl */ `
          varying vec2 vW; varying float vDepth;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vW = wp.xz;
            vec4 vp = viewMatrix * wp;
            vDepth = -vp.z;
            gl_Position = projectionMatrix * vp;
          }`,
        fragmentShader: /* glsl */ `
          ${DOF_GLSL}
          ${FOG_GLSL}
          uniform vec3 uFloor, uHorizon;
          varying vec2 vW; varying float vDepth;
          float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p) {
            vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
          }
          void main() {
            float w = sliceWeight(vDepth);
            if (w <= 0.0) discard;
            float n = vn(vW * 0.35) * 0.6 + vn(vW * 1.3) * 0.4;
            vec3 c = uFloor * (0.75 + 0.5 * n);
            // small clusters of tiny dots scattered over the floor
            vec2 cell = floor(vW / 1.45);
            float on = step(0.82, h21(cell + 7.0));
            vec2 dg = fract(vW / 0.16) - 0.5;
            vec2 inCell = fract(vW / 1.45);
            float inBox = step(0.25, inCell.x) * step(inCell.x, 0.65) * step(0.3, inCell.y) * step(inCell.y, 0.55);
            c += vec3(0.35, 0.6, 1.0) * 0.35 * on * inBox * smoothstep(0.2, 0.08, length(dg)) * (1.0 - fogOf(vDepth));
            // soft light from the far upper right
            vec2 lp = vW - vec2(70.0, -90.0);
            c += uHorizon * 0.9 * exp(-dot(lp, lp) / 9000.0);
            c = mix(c, uHorizon, pow(fogOf(vDepth), 1.4));
            gl_FragColor = vec4(c * w, 1.0);
          }`,
        depthWrite: true,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -200);
    scene.add(floor);

    // tiles
    const tiles = FIELD.tiles;
    const tgeo = bakeInstances(
      tileGeometry(),
      tiles.map((t) => new THREE.Matrix4().makeTranslation(t.x, 0.06, t.z)),
      { aIcon: tiles.map((t) => t.icon), aAct: tiles.map((t) => t.act) },
    );
    const tileMat = new THREE.ShaderMaterial({
      uniforms: {
        ...post.dof,
        ...fog,
        uFrame: frameU,
        uAtlas: { value: atlas },
        uTile: { value: C(v.tile) },
        uIcon: { value: C(v.icon) },
        uActive: { value: C(v.active) },
      },
      vertexShader: /* glsl */ `
        attribute float aIcon; attribute float aAct; attribute vec3 aLocal;
        varying vec3 vLocal; varying vec3 vN; varying vec3 vView; varying float vDepth; varying float vIcon; varying float vAct;
        uniform float uFrame;
        void main() {
          vLocal = aLocal;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec4 vp = viewMatrix * wp;
          vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * normal);
          vView = normalize(-vp.xyz);
          vDepth = -vp.z;
          vIcon = aIcon;
          vAct = clamp((uFrame - aAct) / 10.0, 0.0, 1.0);
          gl_Position = projectionMatrix * vp;
        }`,
      fragmentShader: /* glsl */ `
        ${DOF_GLSL}
        ${FOG_GLSL}
        uniform sampler2D uAtlas; uniform vec3 uTile, uIcon, uActive;
        varying vec3 vLocal; varying vec3 vN; varying vec3 vView; varying float vDepth; varying float vIcon; varying float vAct;
        float sdRound(vec2 p, float b, float r) { vec2 q = abs(p) - vec2(b - r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main() {
          float w = sliceWeight(vDepth);
          if (w <= 0.0) discard;
          vec3 col = mix(uTile, uActive, vAct);
          float fres = pow(1.0 - abs(dot(vN, vView)), 2.0);
          vec2 p = vec2(vLocal.x, vLocal.z);
          float sd = sdRound(p, 0.5, 0.16);
          float edge = exp(-abs(sd) / 0.035);
          bool top = vLocal.y > 0.255;
          bool under = vLocal.y < 0.055;
          vec3 c;
          if (top) {
            vec2 uv = vec2(vLocal.x, vLocal.z) / 0.64 + 0.5;
            float ic = 0.0;
            if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
              vec2 cell = vec2(mod(vIcon, 4.0), floor(vIcon / 4.0));
              vec2 auv = (cell + vec2(0.18, 0.18) + uv * 0.64) / 4.0;
              ic = texture2D(uAtlas, vec2(auv.x, 1.0 - auv.y)).r;
            }
            // frosted top: brighter towards the far edge, icon lines on top
            float grad = 0.55 + 0.45 * smoothstep(0.5, -0.5, vLocal.z);
            c = col * (0.2 * grad + 0.18 * fres) + col * edge * 0.6 + mix(uIcon, vec3(1.0), 0.3 * vAct) * ic * 0.8;
          } else {
            // glass sides: thin, bright rim
            c = col * (0.32 + 0.4 * fres) + col * 0.4 * smoothstep(0.18, 0.26, vLocal.y);
            if (under) c = col * (0.12 + 0.3 * fres);
          }
          c *= 1.0 + 0.15 * vAct;
          c *= 1.0 - 0.75 * fogOf(vDepth);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const tmesh = new THREE.Mesh(tgeo, tileMat);
    tmesh.frustumCulled = false;
    scene.add(tmesh);

    // houses + their halos
    const houses = tiles.filter((t) => t.house);
    const hgeo = bakeInstances(
      houseGeometry(),
      houses.map((t) =>
        new THREE.Matrix4()
          .makeRotationY(((t.i * 7 + t.j * 3) % 8) * 0.25 - 1.0)
          .setPosition(t.x + 0.18, 0.28, t.z + 0.12),
      ),
    );
    const houseMat = new THREE.ShaderMaterial({
      uniforms: { ...post.dof, ...fog, uHouse: { value: C(v.house) } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying float vDepth; varying float vY;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec4 vp = viewMatrix * wp;
          vN = normal; vY = position.y;
          vDepth = -vp.z;
          gl_Position = projectionMatrix * vp;
        }`,
      fragmentShader: /* glsl */ `
        ${DOF_GLSL}
        ${FOG_GLSL}
        uniform vec3 uHouse;
        varying vec3 vN; varying float vDepth; varying float vY;
        void main() {
          float w = sliceWeight(vDepth);
          if (w <= 0.0) discard;
          vec3 n = normalize(vN);
          // light faces pale, side faces in the house colour
          float lit = clamp(0.5 + 0.5 * n.y + 0.35 * n.z, 0.0, 1.0);
          vec3 c = mix(uHouse * 0.8, vec3(0.94, 0.95, 1.0), lit * 0.9);
          c *= 1.0 - 0.75 * fogOf(vDepth);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
    });
    const hmesh = new THREE.Mesh(hgeo, houseMat);
    hmesh.frustumCulled = false;
    scene.add(hmesh);

    const haloBase = new THREE.PlaneGeometry(1.7, 1.7);
    haloBase.rotateX(-Math.PI / 2);
    const haloGeo = bakeInstances(
      haloBase,
      houses.map((t) => new THREE.Matrix4().makeTranslation(t.x + 0.18, 0.01, t.z + 0.12)),
    );
    const haloMat = new THREE.ShaderMaterial({
      uniforms: { ...post.dof, ...fog, uHalo: { value: C(v.halo) } },
      vertexShader: /* glsl */ `
        attribute vec3 aLocal;
        varying vec2 vP; varying float vDepth;
        void main() {
          vP = aLocal.xz;
          vec4 vp = viewMatrix * modelMatrix * vec4(position, 1.0);
          vDepth = -vp.z;
          gl_Position = projectionMatrix * vp;
        }`,
      fragmentShader: /* glsl */ `
        ${DOF_GLSL}
        ${FOG_GLSL}
        uniform vec3 uHalo;
        varying vec2 vP; varying float vDepth;
        void main() {
          float w = sliceWeight(vDepth);
          if (w <= 0.0) discard;
          float r = length(vP);
          // halftone dots on a fine grid, bigger towards a soft ring
          vec2 g = fract(vP / 0.075) - 0.5;
          float ring = exp(-pow((r - 0.36) / 0.28, 2.0));
          float dotR = 0.12 + 0.3 * ring;
          float d = smoothstep(dotR, dotR - 0.12, length(g));
          vec3 c = mix(uHalo, vec3(1.0, 0.45, 0.85), 0.25 * ring) * d * ring * 0.55;
          c *= 1.0 - 0.8 * fogOf(vDepth);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.frustumCulled = false;
    scene.add(halo);

    // check marks: camera-facing badges that pop above activated tiles
    const checkScale = { value: 1 };
    const actTiles = tiles.filter((t) => t.act < ICON_FRAMES + 20);
    const quad = new THREE.BufferGeometry();
    quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    // corners stay in aLocal; tile centre and activation time per vertex
    const cgeo = bakeInstances(quad, actTiles.map(() => new THREE.Matrix4()), {
      iX: actTiles.map((t) => t.x),
      iZ: actTiles.map((t) => t.z),
      iAct: actTiles.map((t) => t.act),
    });
    const checkMat = new THREE.ShaderMaterial({
      uniforms: { ...post.dof, ...fog, uFrame: frameU, uAtlas: { value: atlas }, uCheckScale: checkScale },
      vertexShader: /* glsl */ `
        attribute float iX; attribute float iZ; attribute float iAct; attribute vec3 aLocal;
        uniform float uFrame; uniform float uCheckScale;
        varying vec2 vUv; varying float vDepth; varying float vA;
        void main() {
          float k = clamp((uFrame - iAct) / 9.0, 0.0, 1.0);
          // pop: scale from 0.9 with a small overshoot, then settle
          float ob = 1.0 + 2.2 * pow(k - 1.0, 3.0) + 1.2 * pow(k - 1.0, 2.0);
          float s = (0.9 + 0.1 * ob) * 0.62 * uCheckScale;
          vec4 vp = viewMatrix * vec4(iX, 0.62 + 0.4 * uCheckScale + 0.18 * (1.0 - k), iZ, 1.0);
          vp.xy += aLocal.xy * s;
          vUv = aLocal.xy + 0.5;
          vDepth = -vp.z;
          vA = k;
          gl_Position = k <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * vp;
        }`,
      fragmentShader: /* glsl */ `
        ${DOF_GLSL}
        ${FOG_GLSL}
        uniform sampler2D uAtlas;
        varying vec2 vUv; varying float vDepth; varying float vA;
        void main() {
          float w = sliceWeight(vDepth);
          if (w <= 0.0) discard;
          vec2 cell = vec2(2.0, 2.0);
          vec3 t = texture2D(uAtlas, vec2((cell.x + vUv.x) / 4.0, 1.0 - (cell.y + 1.0 - vUv.y) / 4.0)).rgb;
          vec3 c = t * vA * 1.1 * (1.0 - 0.8 * fogOf(vDepth));
          gl_FragColor = vec4(c * w, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const checks = new THREE.Mesh(cgeo, checkMat);
    checks.frustumCulled = false;
    scene.add(checks);

    // links between neighbouring tiles
    const lb = new LineBuilder();
    const lc = hexToRgb(v.line);
    for (const [a, b] of FIELD.links) {
      const A = tiles[a];
      const B = tiles[b];
      lb.add([A.x, 0.05, A.z, B.x, 0.05, B.z], lc, 0.9, [0, 0, 0, 1]);
    }
    const lineMat = makeLineMaterial(post.dof, post.view, { width: 2.2, pulseColor: C(v.active), loop: ICON_FRAMES });
    // fade links into the haze like everything else
    lineMat.fragmentShader = lineMat.fragmentShader.replace(
      "gl_FragColor = vec4(col * prof * vAS * wgt * uGain, 1.0);",
      "gl_FragColor = vec4(col * prof * vAS * wgt * uGain * (1.0 - 0.8 * clamp((vDepth - 30.0) / 190.0, 0.0, 1.0)), 1.0);",
    );
    scene.add(makeLineMesh(lb.build(), lineMat));

    // floating specks
    const sgeo = new THREE.BufferGeometry();
    const sp = FIELD.specks;
    const spos = new Float32Array((sp.length / 4) * 3);
    const sb = new Float32Array(sp.length / 4);
    for (let k = 0; k < sp.length / 4; k++) {
      spos.set([sp[k * 4], sp[k * 4 + 1], sp[k * 4 + 2]], k * 3);
      sb[k] = sp[k * 4 + 3];
    }
    sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
    sgeo.setAttribute("aB", new THREE.BufferAttribute(sb, 1));
    const speckMat = new THREE.ShaderMaterial({
      uniforms: { ...post.dof, ...fog, uPx: post.view.uPxScale, uCol: { value: C(v.line) } },
      vertexShader: /* glsl */ `
        attribute float aB; uniform float uPx; varying float vDepth; varying float vB;
        void main() {
          vec4 vp = modelViewMatrix * vec4(position, 1.0);
          vDepth = -vp.z; vB = aB;
          gl_PointSize = max(1.5, 9.0 * uPx * 6.0 / max(vDepth, 1.0) * 3.0);
          gl_Position = projectionMatrix * vp;
        }`,
      fragmentShader: /* glsl */ `
        ${DOF_GLSL}
        ${FOG_GLSL}
        uniform vec3 uCol; varying float vDepth; varying float vB;
        void main() {
          float w = sliceWeight(vDepth);
          if (w <= 0.0) discard;
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(uCol * a * (0.25 + 0.6 * vB) * (1.0 - fogOf(vDepth)) * w, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const specks = new THREE.Points(sgeo, speckMat);
    specks.frustumCulled = false;
    scene.add(specks);

    const tgt = new THREE.Vector3();
    return {
      render(frame) {
        const f = Math.max(0, Math.min(ICON_FRAMES, frame));
        frameU.value = f;
        const cam = cameraAt(f);
        camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
        tgt.set(cam.tgt[0], cam.tgt[1], cam.tgt[2]);
        camera.lookAt(tgt);
        camera.updateMatrixWorld();
        const wide = ease(Math.min(1, Math.max(0, (f - 90) / 270)));
        post.dof.uFocus.value = camera.position.distanceTo(tgt) * (1 - 0.25 * wide);
        post.dof.uAperture.value = 20 - 14 * wide;
        checkScale.value = 1 + 0.5 * wide;
        lineMat.uniforms.uGain.value = 1 - 0.55 * wide;
        fog.uFogNear.value = 25 + 30 * wide;
        fog.uFogFar.value = 140 + 110 * wide;
        post.render(scene, camera, frame);
      },
      dispose() {
        post.dispose();
      },
    };
  };

export const IconNetwork: React.FC<{ version: IconVersion; durationOverride?: number }> = ({ version }) => {
  const create = useMemo(() => createIconNetwork(version), [version]);
  return <ThreeLook create={create} />;
};
