import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeLook, WorldFactory } from "../../lib/three/ThreeLook";
import { DOF_GLSL, PostPipeline } from "../../lib/three/post";
import { LineBuilder, bezier, makeLineMaterial, makeLineMesh } from "../../lib/three/lines";
import { hash01, mulberry32 } from "../../lib/random";
import { hexToRgb } from "../../lib/color";
import { useFontsReady } from "../../lib/fonts";
import { DataVersion } from "./versions";

export const DATA_LOOP = 600;
// The layout repeats every L along x; the camera tracks exactly one L per loop.
const L = 18;
const COPIES = [-2, -1, 0, 1, 2, 3];
const CELL_W = 0.15; // world size of one digit cell
const CELL_D = 0.16;

type Panel = { x: number; z: number; w: number; d: number; seed: number };
const PANELS: Panel[] = [
  { x: 2.0, z: -1.2, w: 2.6, d: 4.4 },
  { x: 2.5, z: -7.6, w: 3.0, d: 4.8 },
  { x: 1.6, z: -14.0, w: 3.2, d: 4.6 },
  { x: 8.0, z: -0.4, w: 3.4, d: 3.6 },
  { x: 8.3, z: -5.4, w: 3.6, d: 4.2 },
  { x: 7.7, z: -11.0, w: 3.4, d: 4.4 },
  { x: 14.0, z: -2.2, w: 3.0, d: 5.0 },
  { x: 14.4, z: -8.4, w: 3.4, d: 4.6 },
  { x: 13.9, z: -14.6, w: 3.0, d: 4.4 },
].map((p, i) => ({ ...p, seed: 1000 + i * 77 }));

// bundles: [from, to (index, +period offset), colour B?]
const BUNDLES: { from: number; to: number; dk: number; red: boolean }[] = [
  { from: 0, to: 3, dk: 0, red: false },
  { from: 0, to: 4, dk: 0, red: true },
  { from: 1, to: 4, dk: 0, red: false },
  { from: 1, to: 5, dk: 0, red: false },
  { from: 2, to: 5, dk: 0, red: true },
  { from: 3, to: 6, dk: 0, red: false },
  { from: 4, to: 6, dk: 0, red: true },
  { from: 4, to: 7, dk: 0, red: false },
  { from: 5, to: 8, dk: 0, red: false },
  { from: 6, to: 0, dk: 1, red: false },
  { from: 7, to: 1, dk: 1, red: true },
  { from: 8, to: 2, dk: 1, red: false },
];

// ---------------------------------------------------------------------------
// Digit cells. Glyphs: 0, 1, ○, ●. Each cell flickers on its own whole-number
// period k (k divides 600): state = hash(cell, floor((frame + off) / k) mod (600 / k)).
// ---------------------------------------------------------------------------
const PERIODS = [6, 10, 12, 15, 20, 30, 50, 60, 100, 600];
const cellState = (seed: number, i: number, frame: number) => {
  const pk = PERIODS[Math.floor(hash01(seed, i, 1) * PERIODS.length)];
  const off = Math.floor(hash01(seed, i, 2) * pk);
  const step = Math.floor((frame + off) / pk) % (DATA_LOOP / pk);
  const h = hash01(seed, i, step + 11);
  const h2 = hash01(seed, i, step + 97);
  const empty = h < 0.14 || (hash01(seed, Math.floor(i / 7), 5) < 0.1 && h < 0.6);
  // glyph: favour 0 and ○ like the reference
  const glyph = h2 < 0.35 ? 0 : h2 < 0.55 ? 1 : h2 < 0.85 ? 2 : 3;
  const c = hash01(seed, i, step + 503);
  const color = c < 0.1 ? 1 : c < 0.16 ? 2 : c < 0.42 ? 3 : 0; // 0 teal, 1 red, 2 white, 3 dim teal
  return { empty, glyph, color };
};

type Atlas = { canvas: HTMLCanvasElement; cw: number; ch: number };
const makeGlyphAtlas = (cw: number, ch: number, v: DataVersion): Atlas => {
  const canvas = document.createElement("canvas");
  canvas.width = cw * 4;
  canvas.height = ch * 4;
  const g = canvas.getContext("2d")!;
  const cols = [v.teal, v.red, v.white, v.teal];
  const alphas = [1, 1, 1, 0.45];
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k < 4; k++) {
      const x = k * cw;
      const y = c * ch;
      g.globalAlpha = alphas[c];
      g.fillStyle = cols[c];
      g.strokeStyle = cols[c];
      const cx = x + cw / 2;
      const cy = y + ch / 2;
      if (k < 2) {
        g.font = `700 ${Math.round(ch * 0.78)}px "JetBrains Mono"`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(k === 0 ? "0" : "1", cx, cy + ch * 0.04);
      } else {
        const r = Math.min(cw, ch) * 0.3;
        g.lineWidth = Math.max(1, r * 0.42);
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        if (k === 3) g.fill();
        else g.stroke();
      }
    }
  }
  return { canvas, cw, ch };
};

/** Panel face texture: redrawn from scratch from the frame number. */
const drawPanel = (
  ctx: CanvasRenderingContext2D,
  p: Panel,
  cols: number,
  rows: number,
  atlas: Atlas,
  frame: number,
  v: DataVersion,
) => {
  const { cw, ch } = atlas;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#06191C";
  ctx.fillRect(0, 0, W, H);
  // faint cell grid
  ctx.fillStyle = v.grid;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ctx.fillRect(c * cw + cw * 0.15, r * ch + ch * 0.15, cw * 0.7, ch * 0.7);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = cellState(p.seed, r * cols + c, frame);
      if (s.empty) continue;
      ctx.drawImage(atlas.canvas, s.glyph * cw, s.color * ch, cw, ch, c * cw, r * ch, cw, ch);
    }
  }
  // thin bright border
  ctx.strokeStyle = v.teal;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, cw * 0.08);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.globalAlpha = 1;
};

const panelMaterial = (dof: PostPipeline["dof"], map: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { ...dof, uMap: { value: map } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDepth;
      void main() {
        vUv = uv;
        vec4 vp = modelViewMatrix * vec4(position, 1.0);
        vDepth = -vp.z;
        gl_Position = projectionMatrix * vp;
      }`,
    fragmentShader: /* glsl */ `
      ${DOF_GLSL}
      uniform sampler2D uMap;
      varying vec2 vUv; varying float vDepth;
      void main() {
        float w = sliceWeight(vDepth);
        if (w <= 0.0) discard;
        vec3 c = texture2D(uMap, vUv).rgb;
        c = c * c * 1.6 + c * 0.25; // emissive: punch the glyphs, keep the panel base dark
        gl_FragColor = vec4(c * w, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

const groundMaterial = (dof: PostPipeline["dof"], v: DataVersion) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...dof,
      uBg: { value: new THREE.Color(...hexToRgb(v.bg)) },
      uGrid: { value: new THREE.Color(...hexToRgb(v.grid)) },
    },
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
      uniform vec3 uBg, uGrid;
      varying vec2 vW; varying float vDepth;
      void main() {
        float w = sliceWeight(vDepth);
        if (w <= 0.0) discard;
        // faint grid of small squares, spacing 0.25 (divides the period L)
        vec2 f = abs(fract(vW / 0.25) - 0.5);
        float sq = step(max(f.x, f.y), 0.18);
        float fade = exp(-max(vDepth - 6.0, 0.0) / 22.0);
        vec3 c = uBg + uGrid * sq * 0.35 * fade;
        gl_FragColor = vec4(c * w, 1.0);
      }`,
    depthWrite: true,
  });

export const createDataPanels =
  (version: DataVersion): WorldFactory =>
  (gl, w, h) => {
    const v = version;
    const post = new PostPipeline(gl, w, h, {
      slices: [0, 5, 12, 24, 42, 66],
      bloomWeights: [0.3, 0.3, 0.22, 0.14, 0.08, 0.04],
      bloomThreshold: 0.12,
      exposure: 1.0,
      vignette: 0.45,
      grain: 0.02,
      loop: DATA_LOOP,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 300);

    // texture resolution: as large as a cell appears on screen at this render size
    const cellPx = Math.max(14, Math.round(40 * post.pxScale));
    const atlas = makeGlyphAtlas(cellPx, Math.round(cellPx * (CELL_D / CELL_W) * 0.92), v);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), groundMaterial(post.dof, v));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(L * 0.5, 0, -60);
    scene.add(ground);

    const faces = PANELS.map((p) => {
      const cols = Math.round(p.w / CELL_W);
      const rows = Math.round(p.d / CELL_D);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(2048, cols * atlas.cw);
      canvas.height = Math.min(2048, rows * atlas.ch);
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 4;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      const mat = panelMaterial(post.dof, tex);
      const geo = new THREE.PlaneGeometry(p.w, p.d);
      for (const k of COPIES) {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x + k * L, 0.06, p.z);
        scene.add(m);
      }
      return { p, cols, rows, ctx, tex };
    });

    // fibre bundles + ground data lines
    const rnd = mulberry32(3968318407);
    const lbA = new LineBuilder();
    const colA = hexToRgb(v.fibreA);
    const colB = hexToRgb(v.fibreB);
    const colT = hexToRgb(v.teal);
    for (const b of BUNDLES) {
      const P = PANELS[b.from];
      const Q = PANELS[b.to];
      const n = 20 + Math.floor(rnd() * 21);
      const zs = P.z + (rnd() - 0.5) * P.d * 0.5;
      const zMid = Q.z + (rnd() - 0.5) * Q.d * 0.3;
      for (let i = 0; i < n; i++) {
        const x0 = P.x + P.w / 2;
        const x3 = Q.x + b.dk * L - Q.w / 2;
        const dx = x3 - x0;
        const z0 = zs + (rnd() - 0.5) * 0.18;
        const z3 = zMid + ((i / (n - 1)) - 0.5) * Q.d * 0.75 + (rnd() - 0.5) * 0.1;
        const arch = 0.15 + rnd() * 0.5;
        const pts = bezier([x0, 0.08, z0], [x0 + dx * 0.4, 0.08 + arch, z0], [x3 - dx * 0.45, 0.08 + arch * 0.4, z3], [x3, 0.08, z3], 26);
        const red = b.red ? rnd() < 0.75 : rnd() < 0.08;
        const pulse: [number, number, number, number] = rnd() < 0.3 ? [rnd(), 1 + Math.floor(rnd() * 3), 1.6, 0.06] : [0, 0, 0, 1];
        for (const k of COPIES) {
          const sh = pts.map((val, j) => (j % 3 === 0 ? val + k * L : val));
          lbA.add(sh, red ? colB : colA, 0.55 + rnd() * 0.3, pulse);
        }
      }
    }
    // ground data lines leading into the first-column panels
    const strips: { x0: number; x1: number; z: number; seed: number }[] = [];
    for (const pi of [0, 1, 2]) {
      const P = PANELS[pi];
      for (let s = 0; s < 3; s++) {
        const z = P.z + (s - 1) * P.d * 0.28 + (rnd() - 0.5) * 0.3;
        const x1 = P.x - P.w / 2 - 0.9 - rnd() * 0.8;
        const x0 = x1 - 1.5 - rnd() * 2.5;
        strips.push({ x0, x1, z, seed: 5000 + pi * 10 + s });
        // short fibre from the strip end into the panel edge
        const zEnd = P.z + (s - 1) * P.d * 0.22;
        const pts = bezier([x1, 0.04, z], [x1 + 0.5, 0.04, z], [P.x - P.w / 2 - 0.4, 0.06, zEnd], [P.x - P.w / 2, 0.06, zEnd], 16);
        const red = rnd() < 0.3;
        for (const k of COPIES) {
          const sh = pts.map((val, j) => (j % 3 === 0 ? val + k * L : val));
          lbA.add(sh, red ? colB : colT, 0.9, [rnd(), 2, 1.2, 0.08]);
        }
      }
    }
    const lineMat = makeLineMaterial(post.dof, post.view, { width: 2.0, pulseColor: new THREE.Color(...hexToRgb(v.white)), loop: DATA_LOOP });
    scene.add(makeLineMesh(lbA.build(), lineMat));

    // strips: one shared texture holding every strip as a row
    const stripCols = 40;
    const stripCanvas = document.createElement("canvas");
    stripCanvas.width = stripCols * atlas.cw;
    stripCanvas.height = strips.length * atlas.ch;
    const sctx = stripCanvas.getContext("2d")!;
    const stripTex = new THREE.CanvasTexture(stripCanvas);
    stripTex.colorSpace = THREE.NoColorSpace;
    stripTex.anisotropy = 4;
    const stripMat = panelMaterial(post.dof, stripTex);
    strips.forEach((s, i) => {
      const len = s.x1 - s.x0;
      const n = Math.max(4, Math.round(len / CELL_W));
      const geo = new THREE.PlaneGeometry(len, CELL_D);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let j = 0; j < uv.count; j++) {
        uv.setXY(j, uv.getX(j) * (n / stripCols), (strips.length - 1 - i + uv.getY(j)) / strips.length);
      }
      for (const k of COPIES) {
        const m = new THREE.Mesh(geo, stripMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set((s.x0 + s.x1) / 2 + k * L, 0.03, s.z);
        scene.add(m);
      }
    });

    const target = new THREE.Vector3();
    const focusPt = new THREE.Vector3();
    return {
      render(frame) {
        const f = ((frame % DATA_LOOP) + DATA_LOOP) % DATA_LOOP;
        // digits: every panel texture redrawn from the frame
        for (const fc of faces) {
          drawPanel(fc.ctx, fc.p, fc.cols, fc.rows, atlas, f, v);
          fc.tex.needsUpdate = true;
        }
        sctx.fillStyle = "#000";
        sctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
        strips.forEach((s, i) => {
          for (let c = 0; c < stripCols; c++) {
            const st = cellState(s.seed, c, f);
            if (st.empty) continue;
            sctx.drawImage(atlas.canvas, st.glyph * atlas.cw, st.color * atlas.ch, atlas.cw, atlas.ch, c * atlas.cw, i * atlas.ch, atlas.cw, atlas.ch);
          }
        });
        stripTex.needsUpdate = true;

        // camera: track sideways exactly one period L per loop
        const cx = -1.0 + (L * f) / DATA_LOOP;
        camera.position.set(cx, 4.6, 5.2);
        target.set(cx + 5.2, 0, -4.2);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        focusPt.set(cx + 4.6, 0, -3.0);
        post.dof.uFocus.value = camera.position.distanceTo(focusPt);
        post.dof.uAperture.value = 34;
        lineMat.uniforms.uFrame.value = f;
        post.render(scene, camera, frame);
      },
      dispose() {
        post.dispose();
      },
    };
  };

export const DataPanels: React.FC<{ version: DataVersion; durationOverride?: number }> = ({ version }) => {
  const fontsReady = useFontsReady();
  const create = useMemo(() => createDataPanels(version), [version]);
  return fontsReady ? <ThreeLook create={create} /> : null;
};
