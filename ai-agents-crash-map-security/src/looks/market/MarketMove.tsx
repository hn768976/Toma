import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { easeInOutCubic, range, TAU } from "../../lib/anim";
import { loadFonts } from "../../lib/fonts";
import { GLStage, LookFactory } from "../../lib/gl/Stage";
import { canvasTexture, hexToVec3, makeCanvas, premulBlend, rgba } from "../../lib/gl/tex";
import { hash, mulberry32 } from "../../lib/random";
import { useAssets } from "../../lib/useAssets";
import { getLandMask, loadLandMask } from "../../lib/worldmap";
import type { MarketRow } from "../../versions";

const LOOP = 600;

// ---------------------------------------------------------------------------
// Module-level, seeded data (never Math.random at render time)
// ---------------------------------------------------------------------------
const NSTR = 24;
const BLUR_LEVELS = [0, 2.5, 6, 11, 18, 27]; // px sigma at atlas scale
const CELL_W = 640;
const CELL_H = 160;
const ATLAS_COLS = 8;

const STRINGS: string[] = (() => {
  const r = mulberry32(90210);
  const out: string[] = [];
  while (out.length < NSTR) {
    const v = (100 + r() * 899.99).toFixed(2);
    const s = `${v} %`;
    if (!out.includes(s)) out.push(s);
  }
  return out;
})();

type Label = {
  x: number;
  y: number;
  z: number;
  h: number;
  tinted: boolean;
  bright: number;
  period: number;
  offset: number;
  flickers: boolean;
  sx: number;
  sy: number;
  ph: number;
};

const CAM_Z = 10;
const TAN = Math.tan((40 / 2) * (Math.PI / 180));

const LABELS: Label[] = (() => {
  const r = mulberry32(4242);
  const out: Label[] = [];
  const periods = [60, 75, 100, 120, 150, 200];
  // Depth layers from far to near, each a jittered grid filling the view.
  // far layers, ONE focal plane (z = 0, laid out as a staggered grid), near layers
  const layers = [-36, -27, -19, -12, -6.5, 0, 3.9, 5.4, 6.6];
  const counts = [80, 70, 58, 46, 38, 60, 14, 9, 5];
  layers.forEach((z, li) => {
    const n = counts[li];
    const focal = z === 0;
    const rows = focal ? 12 : Math.max(2, Math.round(Math.sqrt(n / 2.2)));
    const cols = Math.ceil(n / rows);
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / cols);
      const col = k % cols;
      // jittered grid in screen space (0..1, y down), slightly overscanned
      const u = focal
        ? ((col + 0.35 + (row % 2) * 0.45 + (r() - 0.5) * 0.2) / cols - 0.5) * 1.1 + 0.5
        : ((col + 0.15 + r() * 0.7) / cols - 0.5) * 1.12 + 0.5;
      const v = focal
        ? ((row + 0.5 + (r() - 0.5) * 0.15) / rows - 0.5) * 1.08 + 0.5
        : ((row + 0.2 + r() * 0.6) / rows - 0.5) * 1.12 + 0.5;
      // the field leans back: rows higher in frame sit further away
      const d0 = CAM_Z - (z + (r() - 0.5) * (focal ? 0.3 : 1.4));
      const dist = d0 * (1 + 0.65 * (0.5 - v));
      const zz = CAM_Z - dist;
      const x = (u - 0.5) * 2 * dist * TAN * (16 / 9);
      const y = (0.5 - v) * 2 * dist * TAN;
      out.push({
        x,
        y,
        z: zz,
        h: 0.05 * (CAM_Z - zz) * (0.75 + r() * 0.6) * (focal ? 1.45 : 1),
        tinted: z < -12 ? r() < 0.6 : r() < (focal ? 0.12 : 0.36),
        bright: 0.7 + r() * 0.3,
        period: periods[Math.floor(r() * periods.length)],
        offset: Math.floor(r() * 600),
        flickers: r() < 0.45,
        sx: (r() - 0.5) * 0.25,
        sy: (r() - 0.5) * 0.15,
        ph: r(),
      });
    }
  });
  out.sort((a, b) => a.z - b.z); // back to front
  return out;
})();

// Numbers atlas: every string at every blur level. Static content: drawn once.
let atlasCanvas: HTMLCanvasElement | null = null;
const getAtlas = () => {
  if (atlasCanvas) return atlasCanvas;
  const rows = Math.ceil((NSTR * BLUR_LEVELS.length) / ATLAS_COLS);
  const c = makeCanvas(CELL_W * ATLAS_COLS, CELL_H * rows);
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 64px Inter`;
  ctx.fillStyle = "#fff";
  BLUR_LEVELS.forEach((b, li) => {
    STRINGS.forEach((s, si) => {
      const idx = li * NSTR + si;
      const cx = (idx % ATLAS_COLS) * CELL_W + CELL_W / 2;
      const cy = Math.floor(idx / ATLAS_COLS) * CELL_H + CELL_H / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - CELL_W / 2 + 2, cy - CELL_H / 2 + 2, CELL_W - 4, CELL_H - 4);
      ctx.clip();
      ctx.filter = b > 0 ? `blur(${b}px)` : "none";
      // letter-spaced like a terminal readout
      const spaced = s.replace(" %", String.fromCharCode(0x2009) + "%").split("").join(String.fromCharCode(0x200a));
      ctx.fillText(spaced, cx, cy + 2);
      ctx.restore();
    });
  });
  atlasCanvas = c;
  return c;
};

// ---------------------------------------------------------------------------
// Arrow geometry (rebuilt per frame from the draw-on progress)
// ---------------------------------------------------------------------------
const screenToWorld = (sx: number, sy: number, z: number, aspect: number): THREE.Vector2 => {
  const d = CAM_Z - z;
  const vh = 2 * d * TAN;
  return new THREE.Vector2((sx - 0.5) * vh * aspect, (0.5 - sy) * vh);
};

const arrowPath = (dir: "down" | "up", aspect: number): THREE.Vector2[] => {
  const pts: [number, number][] = [
    [-0.05, 0.24],
    [0.05, 0.44],
    [0.38, 0.16],
    [0.78, 0.83],
  ];
  return pts.map(([x, y]) => screenToWorld(x, dir === "down" ? y : 1 - y, ARROW_Z, aspect));
};
const ARROW_Z = -1.3; // behind the sharp number plane, so white numbers sit over it

const buildArrowShape = (path: THREE.Vector2[], progress: number, shaftW: number, headW: number, headL: number) => {
  const lens: number[] = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = lens[lens.length - 1];
  const L = Math.max(0.0001, total * progress);
  const scale = Math.min(1, L / (headL * 1.6));
  const hl = headL * scale;
  const hw = headW * Math.max(0.35, scale);
  const sw = shaftW * Math.max(0.5, scale);
  const at = (s: number) => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < s) i++;
    const t = (s - lens[i - 1]) / (lens[i] - lens[i - 1]);
    return { p: path[i - 1].clone().lerp(path[i], Math.min(1, Math.max(0, t))), seg: i };
  };
  const tip = at(L);
  const shaftEnd = Math.max(0, L - hl);
  const base = at(shaftEnd);
  // shaft polyline: path points before shaftEnd, then base point
  const pl: THREE.Vector2[] = [path[0].clone()];
  for (let i = 1; i < path.length - 1; i++) if (lens[i] < shaftEnd) pl.push(path[i].clone());
  pl.push(base.p.clone());
  const dirTip = tip.p.clone().sub(base.p).normalize();
  if (!isFinite(dirTip.x)) dirTip.set(1, 0);
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  for (let i = 0; i < pl.length; i++) {
    const dPrev = i > 0 ? pl[i].clone().sub(pl[i - 1]).normalize() : null;
    const dNext = i < pl.length - 1 ? pl[i + 1].clone().sub(pl[i]).normalize() : dirTip;
    let n: THREE.Vector2;
    let m = 1;
    const nNext = new THREE.Vector2(-dNext.y, dNext.x);
    if (dPrev) {
      const nPrev = new THREE.Vector2(-dPrev.y, dPrev.x);
      n = nPrev.clone().add(nNext).normalize();
      m = 1 / Math.max(0.35, n.dot(nNext));
    } else n = nNext;
    left.push(pl[i].clone().addScaledVector(n, (sw / 2) * m));
    right.push(pl[i].clone().addScaledVector(n, (-sw / 2) * m));
  }
  const nT = new THREE.Vector2(-dirTip.y, dirTip.x);
  const shape = new THREE.Shape();
  shape.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) shape.lineTo(left[i].x, left[i].y);
  const b = base.p;
  shape.lineTo(b.x + nT.x * hw * 0.5, b.y + nT.y * hw * 0.5);
  shape.lineTo(tip.p.x, tip.p.y);
  shape.lineTo(b.x - nT.x * hw * 0.5, b.y - nT.y * hw * 0.5);
  for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, right[i].y);
  shape.closePath();
  return shape;
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const makeLook = (row: MarketRow): LookFactory => ({ renderer, aspect, pixelHeight }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 200);
  const tint = hexToVec3(row.tint);
  const dark = hexToVec3(row.dark);

  // Background: dark tinted gradient with soft out-of-focus vertical bars.
  {
    const c = makeCanvas(2048, 1152);
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(1024, 520, 50, 1024, 576, 1250);
    g.addColorStop(0, rgba(row.tint, 0.17));
    g.addColorStop(0.45, rgba(row.tint, 0.06));
    g.addColorStop(1, rgba(row.dark, 1));
    ctx.fillStyle = row.dark;
    ctx.fillRect(0, 0, 2048, 1152);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2048, 1152);
    const r = mulberry32(row.seed * 31 + 7);
    ctx.filter = "blur(10px)";
    for (let i = 0; i < 46; i++) {
      const x = r() * 2048;
      const w = 14 + r() * 40;
      const h = 150 + r() * 700;
      ctx.fillStyle = rgba(r() < 0.5 ? row.tint : "#ffffff", 0.025 + r() * 0.05);
      ctx.fillRect(x, 1152 - h - r() * 200, w, h);
    }
    // faint out-of-focus arrows echoing the main one
    ctx.filter = "blur(14px)";
    for (let i = 0; i < 7; i++) {
      const x = 120 + r() * 1800;
      const y = 150 + r() * 700;
      const sz = 90 + r() * 140;
      const dir = row.direction === "down" ? 1 : -1;
      ctx.fillStyle = rgba(row.tint, 0.28 + r() * 0.16);
      ctx.beginPath();
      ctx.moveTo(x - sz * 0.18, y - dir * sz);
      ctx.lineTo(x + sz * 0.18, y - dir * sz);
      ctx.lineTo(x + sz * 0.18, y);
      ctx.lineTo(x + sz * 0.45, y);
      ctx.lineTo(x, y + dir * sz * 0.55);
      ctx.lineTo(x - sz * 0.45, y);
      ctx.lineTo(x - sz * 0.18, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.filter = "blur(1px)";
    ctx.strokeStyle = rgba(row.tint, 0.11);
    ctx.lineWidth = 2;
    for (let x = 0; x < 2048; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1152);
      ctx.stroke();
    }
    for (let y = 0; y < 1152; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }
    const tex = canvasTexture(c, renderer);
    const z = -60;
    const d = CAM_Z - z;
    const vh = 2 * d * TAN * 1.25;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(vh * aspect, vh),
      new THREE.MeshBasicMaterial({ map: tex, depthWrite: false }),
    );
    m.position.z = z;
    m.renderOrder = -10;
    scene.add(m);
  }

  // Globe: Natural Earth land as dots on a sphere + faint ocean grid + rim.
  const globe = new THREE.Group();
  const GLOBE_R = 3.9;
  globe.position.set(-0.7, 0.05, -6.5);
  scene.add(globe);
  const globeSpin = new THREE.Group();
  globe.add(globeSpin);
  globe.rotation.x = 0.32;
  globe.rotation.z = -0.12;
  {
    const { isLand } = getLandMask();
    const N = 26000;
    const pos: number[] = [];
    const bright: number[] = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = ga * i;
      const x = Math.cos(th) * rad;
      const z = Math.sin(th) * rad;
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lon = (Math.atan2(x, z) * 180) / Math.PI;
      const land = isLand(lon, lat);
      if (!land && i % 5 !== 0) continue;
      pos.push(x * GLOBE_R, y * GLOBE_R, z * GLOBE_R);
      bright.push(land ? 0.8 + hash(i, 3) * 0.4 : 0.06);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aBright", new THREE.Float32BufferAttribute(bright, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTint: { value: tint }, uPx: { value: pixelHeight }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        in float aBright;
        uniform float uPx;
        out float vB;
        out float vFace;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normalize(position));
          vFace = clamp(dot(n, normalize(-mv.xyz)), 0.0, 1.0);
          vB = aBright;
          gl_PointSize = 0.03 * uPx / -mv.z * 3.2;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        in float vB;
        in float vFace;
        uniform vec3 uTint;
        uniform float uFade;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float d = dot(q, q);
          float a = smoothstep(1.0, 0.55, d);
          float face = 0.25 + 0.75 * pow(vFace, 0.7);
          vec3 c = uTint * vB * face * 0.75 + vec3(1.0, 0.8, 0.8) * vB * face * 0.04;
          gl_FragColor = vec4(c * uFade, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    globeSpin.add(pts);
    // body + rim
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 0.995, 96, 64),
      new THREE.ShaderMaterial({
        uniforms: { uTint: { value: tint }, uDark: { value: dark } },
        vertexShader: /* glsl */ `
          out vec3 vN; out vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          in vec3 vN; in vec3 vV;
          uniform vec3 uTint; uniform vec3 uDark;
          void main() {
            float f = 1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
            float rim = pow(f, 2.6);
            float lit = clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.5, 0.75))), 0.0, 1.0);
            vec3 c = uTint * (0.05 + 0.1 * lit) + uTint * rim * 0.3;
            gl_FragColor = vec4(c, 1.0);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    globe.add(body);
  }

  // Numbers: one instanced quad per label, atlas-sampled with baked blur.
  const atlas = canvasTexture(getAtlas(), renderer);
  const NL = LABELS.length;
  const iOffset = new THREE.InstancedBufferAttribute(new Float32Array(NL * 3), 3);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(NL * 2), 2);
  const iCell = new THREE.InstancedBufferAttribute(new Float32Array(NL * 3), 3); // str, blur, alpha
  const iTintMix = new THREE.InstancedBufferAttribute(new Float32Array(NL), 1);
  iOffset.setUsage(THREE.DynamicDrawUsage);
  iCell.setUsage(THREE.DynamicDrawUsage);
  const qGeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  qGeo.index = base.index;
  qGeo.setAttribute("position", base.getAttribute("position"));
  qGeo.setAttribute("uv", base.getAttribute("uv"));
  qGeo.setAttribute("iOffset", iOffset);
  qGeo.setAttribute("iSize", iSize);
  qGeo.setAttribute("iCell", iCell);
  qGeo.setAttribute("iTint", iTintMix);
  qGeo.instanceCount = NL;
  const atlasRows = Math.ceil((NSTR * BLUR_LEVELS.length) / ATLAS_COLS);
  const labelMat = premulBlend(
    new THREE.ShaderMaterial({
      uniforms: {
        tAtlas: { value: atlas },
        uTint: { value: tint.clone().multiplyScalar(1.15) },
        uWhite: { value: new THREE.Vector3(0.95, 0.93, 0.93) },
        uGrid: { value: new THREE.Vector3(ATLAS_COLS, atlasRows, NSTR) },
      },
      vertexShader: /* glsl */ `
        in vec3 iOffset; in vec2 iSize; in vec3 iCell; in float iTint;
        out vec2 vUv; out vec3 vCell; out float vTint;
        void main() {
          vUv = uv; vCell = iCell; vTint = iTint;
          // quads lie on the receding plane: top edge tilted away from camera
          vec3 p = iOffset + vec3(position.x * iSize.x, position.y * iSize.y * 0.9, -position.y * iSize.y * 0.45);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        in vec2 vUv; in vec3 vCell; in float vTint;
        uniform sampler2D tAtlas; uniform vec3 uTint; uniform vec3 uWhite; uniform vec3 uGrid;
        float cellA(float level) {
          float idx = level * uGrid.z + vCell.x;
          vec2 cr = vec2(mod(idx, uGrid.x), floor(idx / uGrid.x));
          vec2 uv = (cr + vec2(vUv.x, 1.0 - vUv.y)) / uGrid.xy;
          return texture(tAtlas, vec2(uv.x, 1.0 - uv.y)).a;
        }
        void main() {
          float b = vCell.y;
          float l0 = floor(b);
          float l1 = min(l0 + 1.0, 5.0);
          float a = mix(cellA(l0), cellA(l1), b - l0) * vCell.z;
          vec3 col = mix(uWhite, uTint * 1.15, vTint);
          gl_FragColor = vec4(col * a, a);
        }`,
    }),
  );
  const labels = new THREE.Mesh(qGeo, labelMat);
  labels.frustumCulled = false;
  labels.renderOrder = 5;
  scene.add(labels);
  LABELS.forEach((l, i) => {
    iSize.setXY(i, l.h * 4, l.h);
    iTintMix.setX(i, l.tinted ? 1 : 0);
  });

  // Arrow
  const path = arrowPath(row.direction, aspect);
  const arrowMat = new THREE.ShaderMaterial({
    uniforms: { uTint: { value: tint }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `
      out vec3 vN; out vec3 vV; out vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      in vec3 vN; in vec3 vV; in vec3 vP;
      uniform vec3 uTint; uniform float uAlpha;
      void main() {
        vec3 n = normalize(vN);
        vec3 l = normalize(vec3(-0.35, 0.7, 0.62));
        float diff = clamp(dot(n, l), 0.0, 1.0);
        vec3 h = normalize(l + normalize(vV));
        float spec = pow(clamp(dot(n, h), 0.0, 1.0), 40.0);
        float fres = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 3.0);
        float front = smoothstep(0.85, 0.99, n.z);
        vec3 c = uTint * (0.7 + 0.55 * diff);
        c = mix(c * 0.55, c, front);
        c += mix(uTint, vec3(1.0), 0.3) * (spec * 0.3 + fres * 0.15);
        c *= 0.95;
        gl_FragColor = vec4(c * uAlpha, uAlpha);
      }`,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthWrite: true,
  });
  const arrowGroup = new THREE.Group();
  arrowGroup.position.z = ARROW_Z;
  arrowGroup.rotation.x = row.direction === "down" ? -0.08 : 0.08;
  arrowGroup.rotation.y = 0.04;
  scene.add(arrowGroup);
  const arrowMesh = new THREE.Mesh(new THREE.BufferGeometry(), arrowMat);
  arrowMesh.renderOrder = 4;
  arrowGroup.add(arrowMesh);
  const vh0 = 2 * (CAM_Z - ARROW_Z) * TAN;
  const SHAFT = vh0 * 0.075;
  const HEAD_W = vh0 * 0.24;
  const HEAD_L = vh0 * 0.17;
  let lastKey = -1;

  const update = (frameIn: number) => {
    const f = frameIn % LOOP;
    const ph = f / LOOP;

    // camera: slow drift and gentle push, whole cycles over the loop
    camera.position.set(
      0.45 * Math.sin(TAU * ph),
      0.22 * Math.sin(TAU * 2 * ph + 0.6),
      CAM_Z - 0.55 * (0.5 - 0.5 * Math.cos(TAU * ph)),
    );
    camera.lookAt(0.25 * Math.sin(TAU * ph + 1.1), 0.1 * Math.sin(TAU * ph), -4);
    camera.rotateZ(0.02 * Math.sin(TAU * ph + 0.3));
    camera.updateMatrixWorld();

    globeSpin.rotation.y = TAU * ph; // one full turn per loop

    // labels
    const camZ = camera.position.z;
    const focus = camZ; // sharp plane at z = 0
    LABELS.forEach((l, i) => {
      const x = l.x + l.sx * Math.sin(TAU * (ph + l.ph));
      const y = l.y + l.sy * Math.sin(TAU * (2 * ph + l.ph));
      iOffset.setXYZ(i, x, y, l.z);
      const local = (f + l.offset) % l.period;
      const epoch = Math.floor(((f + l.offset) % LOOP) / l.period);
      const str = l.flickers
        ? Math.floor(hash(i, epoch, 77) * NSTR)
        : Math.floor(hash(i, 5) * NSTR);
      const flick = l.flickers && local < 3 ? (local === 1 ? 0.15 : 0.5) : 1;
      // circle of confusion → atlas blur level
      const dist = camZ - l.z;
      const k = Math.abs(1 - focus / dist);
      const cocFrac = Math.min(0.03, k * (l.z > 0 ? 0.04 : 0.018)); // fraction of frame height
      const screenH = l.h / (2 * dist * TAN);
      const blurAtlas = (cocFrac / screenH) * CELL_H * 0.42;
      let lv = 0;
      while (lv < BLUR_LEVELS.length - 1 && BLUR_LEVELS[lv + 1] < blurAtlas) lv++;
      const lvf =
        lv >= BLUR_LEVELS.length - 1
          ? BLUR_LEVELS.length - 1
          : lv + (blurAtlas - BLUR_LEVELS[lv]) / (BLUR_LEVELS[lv + 1] - BLUR_LEVELS[lv]);
      const depthFade = dist > 13 ? Math.max(0.12, 0.6 - (dist - 13) / 45) : 1;
      const hazeCut = 1 - 0.45 * Math.min(1, Math.max(0, lvf - 1.5) / 2.5);
      const tintDim = l.tinted ? 0.6 : 1;
      iCell.setXYZ(i, str, Math.min(5, Math.max(0, lvf)), l.bright * depthFade * hazeCut * flick * tintDim);
    });
    iOffset.needsUpdate = true;
    iCell.needsUpdate = true;

    // arrow: 3 draw cycles per loop (200 frames each)
    const c = f % 200;
    const draw = easeInOutCubic(range(c, 4, 62));
    const out = range(c, 178, 198);
    const prog = Math.max(0.0001, draw);
    const key = Math.round(prog * 10000);
    if (key !== lastKey) {
      lastKey = key;
      const shape = buildArrowShape(path, prog, SHAFT, HEAD_W, HEAD_L);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: SHAFT * 0.18,
        bevelEnabled: true,
        bevelThickness: SHAFT * 0.06,
        bevelSize: SHAFT * 0.06,
        bevelSegments: 3,
        curveSegments: 1,
      });
      arrowMesh.geometry.dispose();
      arrowMesh.geometry = geo;
    }
    arrowMat.uniforms.uAlpha.value = (1 - out) * (draw > 0.001 ? 1 : 0);
    arrowGroup.position.z = ARROW_Z + out * 1.2;

    return {
      frame: f,
      bloom: { strength: 0.7, threshold: 0.68, knee: 0.35, radius: 1.0 },
      exposure: 1.0,
      vignette: 0.8,
      grain: 0.015,
    };
  };

  return { scene, camera, update };
};

export const MarketMove: React.FC<{ row: MarketRow }> = ({ row }) => {
  const ready = useAssets(() => Promise.all([loadFonts(), loadLandMask()]), "market assets");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeLook(row), [row.id]);
  return (
    <AbsoluteFill style={{ backgroundColor: row.dark }}>{ready ? <GLStage create={create} /> : null}</AbsoluteFill>
  );
};
