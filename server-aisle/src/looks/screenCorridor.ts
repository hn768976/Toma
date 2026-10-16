import {
  BoxGeometry,
  Color,
  Fog,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  RectAreaLight,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { canvasTexture, makeCanvas } from "../lib/canvasTex";
import { loadMonoFont, monoFont } from "../lib/fonts";
import { GradeParams, makePipeline } from "../lib/post";
import { LOOP_PERIODS, mod, mulberry32, pick } from "../lib/random";
import { makeReflectiveFloorMaterial, PlanarReflection } from "../lib/reflection";
import type { LookRuntime } from "../lib/GLStage";

export type ScreenCorridorParams = {
  bars: string;
  panels: string;
  icons: string;
  floor: string;
  grade: GradeParams;
  loop: number;
};

const BAY = 0.6;
const TYPES = 5; // layout repeats every 5 bays = camera travel per loop
const HALF_AISLE = 1.45;
const RACK_H = 2.62;
const CEIL_Y = 2.9;
const N_BEHIND = 4;
const N_AHEAD = 116;

// ---- Screen atlas -----------------------------------------------------------
// 6 x 4 cells of 256 x 128. Channels: R = main colour amount, G = white
// highlight, B = accent colour. The shader maps them to the palette, so one
// atlas serves every colourway.
const CW = 256;
const CH = 128;
const ACOLS = 6;
const AROWS = 4;
const PAD = 10;

const drawAtlas = () => {
  const { canvas, ctx } = makeCanvas(CW * ACOLS, CH * AROWS);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const r = mulberry32(0xa71a5);
  const R = (a = 1) => `rgba(255,0,0,${a})`;
  const G = (a = 1) => `rgba(0,255,0,${a})`;
  const B = (a = 1) => `rgba(0,0,255,${a})`;
  ctx.globalCompositeOperation = "lighter";
  const cell = (i: number, draw: (x: number, y: number, w: number, h: number) => void) => {
    const x = (i % ACOLS) * CW + PAD;
    const y = Math.floor(i / ACOLS) * CH + PAD;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, CW - 2 * PAD, CH - 2 * PAD);
    ctx.clip();
    draw(x, y, CW - 2 * PAD, CH - 2 * PAD);
    ctx.restore();
  };
  // Row 0: bars.
  cell(0, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = G(0.12); ctx.fillRect(x, y + 4, w, h * 0.14);
  });
  cell(1, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = G(0.1); ctx.fillRect(x, y + h * 0.78, w, h * 0.12);
    ctx.fillStyle = G(0.55); ctx.fillRect(x + w - 34, y + 10, 22, h - 20);
  });
  cell(2, (x, y, w, h) => {
    for (let k = 0; k < 8; k++) { ctx.fillStyle = R(); ctx.fillRect(x + k * (w / 8), y, w / 8 - 5, h); }
    ctx.fillStyle = G(0.1); ctx.fillRect(x, y + 5, w, 10);
  });
  cell(3, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = G(0.6);
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 12 + k * 22, y + h * 0.3, 14, h * 0.4);
  });
  cell(4, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w * 0.72, h);
    ctx.strokeStyle = R(0.8); ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = G(0.3); ctx.fillRect(x, y + 4, w * 0.72, 12);
  });
  cell(5, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h * 0.42); ctx.fillRect(x, y + h * 0.56, w * 0.8, h * 0.44);
    ctx.fillStyle = G(0.3); ctx.fillRect(x, y + 3, w, 8);
  });
  // Row 1: panels with mini charts (graphs drawn periodic across the width so
  // they can scroll seamlessly).
  const lineGraph = (x: number, y: number, w: number, h: number, seed: number, alpha: number) => {
    ctx.strokeStyle = G(alpha);
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) {
      const t = k / 64;
      const v = 0.5 + 0.22 * Math.sin(2 * Math.PI * (t * 2 + seed)) + 0.14 * Math.sin(2 * Math.PI * (t * 5 + seed * 3));
      const px = x + t * w;
      const py = y + h * (1 - v);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  cell(6, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    for (let k = 0; k < 7; k++) { ctx.fillStyle = B(0.95); const bh = h * (0.2 + 0.6 * r()); ctx.fillRect(x + w * 0.52 + k * 15, y + h - bh - 6, 9, bh); }
    ctx.fillStyle = G(0.5); ctx.fillRect(x + 8, y + 8, w * 0.3, 8);
  });
  cell(7, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    lineGraph(x, y + 10, w, h - 20, 0.13, 0.5);
  });
  cell(8, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    for (let k = 0; k < 12; k++) { ctx.fillStyle = B(0.9); const bh = h * (0.15 + 0.65 * r()); ctx.fillRect(x + 8 + k * 19, y + h - bh - 6, 11, bh); }
  });
  cell(9, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = G(0.15);
    ctx.beginPath(); ctx.moveTo(x, y + h);
    for (let k = 0; k <= 64; k++) {
      const t = k / 64;
      const v = 0.45 + 0.2 * Math.sin(2 * Math.PI * (t * 3 + 0.3)) + 0.1 * Math.sin(2 * Math.PI * t * 7);
      ctx.lineTo(x + t * w, y + h * (1 - v));
    }
    ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    lineGraph(x, y + 6, w, h * 0.5, 0.6, 0.35);
  });
  cell(10, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = G(0.45); ctx.fillRect(x, y, w, h * 0.2);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = B(); ctx.fillRect(x + w - 30 - k * 26, y + h * 0.5, 16, 16); }
  });
  cell(11, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w * 0.6, h);
    ctx.fillStyle = R(0.35); ctx.fillRect(x + w * 0.62, y, w * 0.38, h);
    ctx.fillStyle = B(); ctx.beginPath();
    ctx.moveTo(x + w * 0.7, y + h / 2); ctx.lineTo(x + w * 0.9, y + h * 0.25); ctx.lineTo(x + w * 0.9, y + h * 0.75); ctx.fill();
  });
  // Row 2: icons (accent outlines on black).
  const arrow = (x: number, y: number, s: number, dir: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * s, y - s * 0.6);
    ctx.lineTo(x + dir * s, y - s * 0.25);
    ctx.lineTo(x + dir * s * 2, y - s * 0.25);
    ctx.lineTo(x + dir * s * 2, y + s * 0.25);
    ctx.lineTo(x + dir * s, y + s * 0.25);
    ctx.lineTo(x + dir * s, y + s * 0.6);
    ctx.closePath();
    ctx.stroke();
  };
  cell(12, (x, y, w, h) => {
    ctx.strokeStyle = B(); ctx.lineWidth = 4;
    arrow(x + 14, y + h / 2, 26, 1);
    arrow(x + w - 14, y + h / 2, 26, -1);
  });
  cell(13, (x, y, w, h) => {
    ctx.strokeStyle = B(); ctx.lineWidth = 4;
    arrow(x + 12, y + h / 2, 24, 1);
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 90, y + h * (0.3 + k * 0.2)); ctx.lineTo(x + w - 12, y + h * (0.3 + k * 0.2)); ctx.stroke(); }
  });
  cell(14, (x, y, w, h) => {
    ctx.strokeStyle = B(); ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 12, y + h * (0.3 + k * 0.2)); ctx.lineTo(x + w - 100, y + h * (0.3 + k * 0.2)); ctx.stroke(); }
    arrow(x + w - 12, y + h / 2, 24, -1);
  });
  cell(15, (x, y, w, h) => {
    ctx.fillStyle = B();
    for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) if (r() < 0.7) ctx.fillRect(x + 10 + i * 22, y + 12 + j * 24, 10, 10);
  });
  cell(16, (x, y, w, h) => {
    ctx.strokeStyle = B(); ctx.lineWidth = 4;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    arrow(x + w / 2 - 50, y + h / 2, 22, 1);
    arrow(x + w / 2 + 50, y + h / 2, 22, -1);
  });
  cell(17, (x, y, w, h) => {
    ctx.strokeStyle = B(); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 30, y + 14); ctx.lineTo(x + 14, y + h / 2); ctx.lineTo(x + 30, y + h - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - 30, y + 14); ctx.lineTo(x + w - 14, y + h / 2); ctx.lineTo(x + w - 30, y + h - 14); ctx.stroke();
    ctx.fillStyle = G(0.4); ctx.fillRect(x + 50, y + h / 2 - 5, w - 100, 10);
  });
  // Row 3: digit readouts in JetBrains Mono. 18-21 are four states of one
  // readout (the "ticking" screens cycle through them).
  const digits = ["0427", "0431", "0436", "0442"];
  for (let s = 0; s < 4; s++)
    cell(18 + s, (x, y, w, h) => {
      ctx.fillStyle = R(0.25); ctx.fillRect(x, y, w, h);
      ctx.font = monoFont(h * 0.72);
      ctx.textBaseline = "middle";
      ctx.fillStyle = G(0.95);
      ctx.fillText(digits[s], x + 16, y + h * 0.54);
      ctx.fillStyle = R(); ctx.fillRect(x + w - 40, y + 10, 26, h - 20);
    });
  cell(22, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w * 0.55, h);
    ctx.font = monoFont(h * 0.7);
    ctx.textBaseline = "middle";
    ctx.fillStyle = G(0.9);
    ctx.fillText("87", x + w * 0.6, y + h * 0.54);
  });
  cell(23, (x, y, w, h) => {
    ctx.fillStyle = R(); ctx.fillRect(x, y, w, h);
    ctx.font = monoFont(h * 0.62);
    ctx.textBaseline = "middle";
    ctx.fillStyle = B(1);
    ctx.fillText("312", x + 18, y + h * 0.54);
    ctx.fillStyle = G(0.4); ctx.fillRect(x + w * 0.62, y + h * 0.35, w * 0.3, h * 0.3);
  });
  ctx.globalCompositeOperation = "source-over";
  return canvas;
};

// ---- Bay layouts (module level, seeded) -------------------------------------
type Screen = { cell: number; role: 0 | 1 | 2; x: number; y: number; w: number; h: number; anim: number; period: number; phase: number };
const layoutRng = mulberry32(0x5c4ee7);
const makeBay = (r: typeof layoutRng): Screen[] => {
  // Regular shelf rows, as in the reference: every row carries one lit screen
  // (bar, chart panel or readout) and most rows a magenta-style glyph beside
  // it. 6-9 screens per bay (an occasional row is left dark).
  const out: Screen[] = [];
  const rows = [0.34, 0.6, 0.86, 1.12, 1.38, 1.64, 1.9, 2.16, 2.42];
  const dark = new Set<number>();
  while (dark.size < Math.floor(r() * 3)) dark.add(Math.floor(r() * rows.length));
  rows.forEach((y, i) => {
    if (dark.has(i)) return;
    const kind = r();
    if (kind < 0.45) {
      const anim = r() < 0.18 ? 1 : 0;
      out.push({ cell: Math.floor(r() * 6), role: 0, x: -0.06, y, w: 0.42, h: 0.13, anim, period: pick(r, LOOP_PERIODS), phase: Math.floor(r() * 200) });
    } else if (kind < 0.9) {
      const cell = 6 + Math.floor(r() * 6);
      const anim = (cell === 7 || cell === 9) && r() < 0.4 ? 2 : 0;
      out.push({ cell, role: 1, x: -0.06, y, w: 0.42, h: 0.15, anim, period: pick(r, [150, 200, 300, 600]), phase: Math.floor(r() * 200) });
    } else {
      const tick = r() < 0.6;
      out.push({ cell: tick ? 18 : 22 + Math.floor(r() * 2), role: 1, x: -0.1, y, w: 0.3, h: 0.11, anim: tick ? 3 : 0, period: pick(r, [60, 75, 100, 120]), phase: Math.floor(r() * 200) });
    }
    if (r() < 0.8)
      out.push({ cell: 12 + Math.floor(r() * 6), role: 2, x: 0.215, y, w: 0.15, h: 0.1, anim: r() < 0.1 ? 4 : 0, period: pick(r, LOOP_PERIODS), phase: Math.floor(r() * 200) });
  });
  return out;
};
// Separate layouts for the left and right walls; each repeats every 5 bays.
const BAYS_L: Screen[][] = Array.from({ length: TYPES }, () => makeBay(layoutRng));
const BAYS_R: Screen[][] = Array.from({ length: TYPES }, () => makeBay(layoutRng));

const screenVert = /* glsl */ `
attribute vec4 aCell;  // cell index, role, anim type, unused
attribute vec4 aAnim;  // period, phase, unused, unused
varying vec2 vUv;
varying vec4 vCell;
varying vec4 vAnim;
varying float vDist;
void main() {
  vUv = uv;
  vCell = aCell;
  vAnim = aAnim;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vDist = length(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const screenFrag = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uBars;
uniform vec3 uPanels;
uniform vec3 uIcons;
uniform float uFrame;
uniform float uGain;
uniform vec2 uFogRange;
varying vec2 vUv;
varying vec4 vCell;
varying vec4 vAnim;
varying float vDist;
const vec2 GRID = vec2(6.0, 4.0);
void main() {
  // Varyings are interpolated: round the per-instance integers back.
  float cell = floor(vCell.x + 0.5);
  float anim = floor(vCell.z + 0.5);
  float period = floor(vAnim.x + 0.5);
  float t = mod(uFrame + floor(vAnim.y + 0.5), period) / period; // exact: period divides 600
  if (anim > 2.5 && anim < 3.5) cell += floor(t * 4.0); // digits tick
  vec2 uv = vUv;
  vec2 uvRaw = uv;
  if (anim > 1.5 && anim < 2.5) uv.x = fract(uv.x + t); // graph scrolls
  vec2 c = vec2(mod(cell, GRID.x), floor(cell / GRID.x));
  vec2 inset = vec2(${PAD}.0 / ${CW}.0, ${PAD}.0 / ${CH}.0);
  vec2 cuv = inset + uv * (1.0 - 2.0 * inset);
  // Canvas rows run top-down; CanvasTexture is flipped, so map back.
  vec2 auv = (c + vec2(cuv.x, 1.0 - cuv.y)) / GRID;
  auv.y = 1.0 - auv.y;
  vec2 g = (1.0 - 2.0 * inset) / GRID;
  vec3 s = textureGrad(uAtlas, auv, dFdx(uvRaw) * g, dFdy(uvRaw) * g).rgb;
  vec3 main = vCell.y < 0.5 ? uBars : (vCell.y < 1.5 ? uPanels : uIcons);
  vec3 accent = vCell.y < 1.5 ? uIcons : uIcons;
  if (anim > 0.5 && anim < 1.5) {
    // Bar grows and shrinks.
    float level = 0.35 + 0.65 * (0.5 - 0.5 * cos(6.28318530718 * t));
    float fw = fwidth(uvRaw.x) * 1.5;
    s.rg *= 1.0 - smoothstep(level - fw, level + fw, uvRaw.x);
  }
  float blink = (anim > 3.5) ? (0.35 + 0.65 * step(0.5, t)) : 1.0;
  vec3 col = (s.r * main + s.g * vec3(1.0) * 0.9 + s.b * accent) * uGain * blink;
  float fog = 1.0 - smoothstep(uFogRange.x, uFogRange.y, vDist);
  gl_FragColor = vec4(col * fog, 1.0);
}
`;

const drawRackFace = (seed: number) => {
  // Charcoal rack front: unit bezels, perforated mesh grilles and tiny
  // red / green status LEDs (emissive canvas).
  const W = 300;
  const H = 1310;
  const alb = makeCanvas(W, H);
  const emi = makeCanvas(W, H);
  const ctx = alb.ctx;
  const r = mulberry32(seed);
  ctx.fillStyle = "#0c0e11";
  ctx.fillRect(0, 0, W, H);
  emi.ctx.fillStyle = "#000";
  emi.ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 50) {
    ctx.fillStyle = "#15181c";
    ctx.fillRect(6, y + 2, W - 12, 46);
    if (r() < 0.7) {
      ctx.fillStyle = "#050607";
      for (let vy = y + 7; vy < y + 44; vy += 5) for (let vx = 12 + ((vy / 5) % 2) * 2.5; vx < W - 12; vx += 5) ctx.fillRect(vx, vy, 2.5, 2.5);
    }
    ctx.fillStyle = "#0b0c0e";
    ctx.fillRect(0, y, W, 2);
    // A row of tiny LEDs on some units.
    if (r() < 0.15) {
      const n = 3 + Math.floor(r() * 6);
      const x0 = 14 + r() * 60;
      for (let k = 0; k < n; k++) {
        emi.ctx.fillStyle = r() < 0.55 ? "#ff3040" : r() < 0.6 ? "#40ff60" : "#ff40c0";
        emi.ctx.fillRect(x0 + k * 9, y + 40, 4, 3);
      }
    }
  }
  return { alb: alb.canvas, emi: emi.canvas };
};

export const buildScreenCorridor = async (gl: WebGLRenderer, p: ScreenCorridorParams): Promise<LookRuntime> => {
  await loadMonoFont();
  RectAreaLightUniformsLib.init();
  const size = gl.getDrawingBufferSize(new Vector2());
  const scene = new Scene();
  scene.background = new Color(0x0b1a26);
  scene.fog = new Fog(0x0b1a26, 26, 90);
  const pmrem = new PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.35;

  const camera = new PerspectiveCamera(66, 16 / 9, 0.15, 100);
  const camY = 1.3;

  const nBay = N_BEHIND + N_AHEAD;
  const zOf = (i: number) => -(i - N_BEHIND) * BAY;
  const zNear = zOf(0) + BAY;
  const zFar = zOf(nBay);
  const len = zNear - zFar;
  const zMid = (zNear + zFar) / 2;

  // Rack fronts: one textured plane per bay type and side (5 x 2 textures).
  const faceGeo = new PlaneGeometry(BAY, RACK_H);
  faceGeo.translate(0, RACK_H / 2, 0);
  const sideRot = (side: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), side < 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const side of [-1, 1])
    for (let t = 0; t < TYPES; t++) {
      const face = drawRackFace(0x900 + t * 17 + (side > 0 ? 1000 : 0));
      const mat = new MeshStandardMaterial({
        map: canvasTexture(gl, face.alb, true),
        emissiveMap: canvasTexture(gl, face.emi, true),
        emissive: new Color(1, 1, 1),
        emissiveIntensity: 1.6,
        roughness: 0.5,
        metalness: 0.35,
      });
      const idx: number[] = [];
      for (let i = 0; i < nBay; i++) if (mod(i, TYPES) === t) idx.push(i);
      const im = new InstancedMesh(faceGeo, mat, idx.length);
      idx.forEach((i, k) =>
        im.setMatrixAt(k, new Matrix4().compose(new Vector3(side * HALF_AISLE, 0, zOf(i)), sideRot(side), new Vector3(1, 1, 1))),
      );
      im.frustumCulled = false;
      scene.add(im);
    }
  // Posts between bays and a top fascia.
  const postMat = new MeshStandardMaterial({ color: 0x030304, roughness: 0.4, metalness: 0.6 });
  const posts = new InstancedMesh(new BoxGeometry(0.05, RACK_H + 0.3, 0.045), postMat, nBay * 2);
  let k = 0;
  for (let i = 0; i < nBay; i++)
    for (const side of [-1, 1]) posts.setMatrixAt(k++, new Matrix4().makeTranslation(side * (HALF_AISLE - 0.005), (RACK_H + 0.3) / 2, zOf(i) + BAY / 2));
  posts.frustumCulled = false;
  scene.add(posts);
  for (const side of [-1, 1]) {
    const fascia = new Mesh(new BoxGeometry(0.06, CEIL_Y - RACK_H, len), postMat);
    fascia.position.set(side * (HALF_AISLE + 0.02), (CEIL_Y + RACK_H) / 2, zMid);
    scene.add(fascia);
  }

  // ---- Screens --------------------------------------------------------------
  const atlas: Texture = canvasTexture(gl, drawAtlas(), false);
  const screens: { m: Matrix4; s: Screen }[] = [];
  for (let i = 0; i < nBay; i++)
    for (const side of [-1, 1]) {
      const lay = (side < 0 ? BAYS_L : BAYS_R)[mod(i, TYPES)];
      for (const s of lay) {
        // Local x across the bay (toward +z on the left wall).
        const zc = zOf(i) + (side < 0 ? s.x : -s.x);
        const m = new Matrix4().compose(
          new Vector3(side * (HALF_AISLE - 0.015), s.y, zc),
          sideRot(side),
          new Vector3(s.w, s.h, 1),
        );
        screens.push({ m, s });
      }
    }
  const quad = new PlaneGeometry(1, 1);
  const aCell = new Float32Array(screens.length * 4);
  const aAnim = new Float32Array(screens.length * 4);
  screens.forEach(({ s }, n) => {
    aCell.set([s.cell, s.role, s.anim, 0], n * 4);
    aAnim.set([s.period, s.phase, 0, 0], n * 4);
  });
  quad.setAttribute("aCell", new InstancedBufferAttribute(aCell, 4));
  quad.setAttribute("aAnim", new InstancedBufferAttribute(aAnim, 4));
  const screenMat = new ShaderMaterial({
    vertexShader: screenVert,
    fragmentShader: screenFrag,
    uniforms: {
      uAtlas: { value: atlas },
      uBars: { value: new Color(p.bars) },
      uPanels: { value: new Color(p.panels) },
      uIcons: { value: new Color(p.icons) },
      uFrame: { value: 0 },
      uGain: { value: 1.15 },
      uFogRange: { value: new Vector2(30, 95) },
    },
  });
  const screenMesh = new InstancedMesh(quad, screenMat, screens.length);
  screens.forEach(({ m }, n) => screenMesh.setMatrixAt(n, m));
  screenMesh.frustumCulled = false;
  scene.add(screenMesh);

  // ---- Ceiling and tubes ------------------------------------------------------
  const ceilMat = new MeshStandardMaterial({ color: 0x15191d, roughness: 0.6, metalness: 0.2 });
  const ceil = new Mesh(new PlaneGeometry(2 * HALF_AISLE + 0.2, len), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL_Y, zMid);
  scene.add(ceil);
  const ribs = new InstancedMesh(new BoxGeometry(2 * HALF_AISLE, 0.04, 0.04), postMat, Math.ceil(len / 1.2));
  for (let n = 0; n < ribs.count; n++) ribs.setMatrixAt(n, new Matrix4().makeTranslation(0, CEIL_Y - 0.02, zNear - n * 1.2));
  ribs.frustumCulled = false;
  scene.add(ribs);
  const tubeMat = new MeshBasicMaterial({ color: new Color(1, 1, 1).multiplyScalar(4), fog: false });
  for (const x of [-0.9, 0.9]) {
    const tube = new Mesh(new BoxGeometry(0.03, 0.02, len), tubeMat);
    tube.position.set(x, CEIL_Y - 0.08, zMid);
    scene.add(tube);
    const l = new RectAreaLight(0xffffff, 4.0, 0.06, 70);
    l.position.set(x, CEIL_Y - 0.05, -30);
    l.lookAt(x, 0, -30);
    scene.add(l);
  }

  // ---- Lit end of the corridor --------------------------------------------
  // Far enough (52 m) that it shows no parallax; it travels with the camera so
  // the loop stays exact.
  const endC = makeCanvas(512, 512);
  {
    const g = endC.ctx;
    const r = mulberry32(0xe7d);
    g.fillStyle = "#0a0c10";
    g.fillRect(0, 0, 512, 512);
    for (let y = 30; y < 500; y += 26)
      for (let x = 20; x < 490; x += 70) {
        if (r() < 0.25) continue;
        g.fillStyle = r() < 0.55 ? p.bars : r() < 0.7 ? p.panels : p.icons;
        g.globalAlpha = 0.85;
        g.fillRect(x, y, 40 + r() * 20, 10);
      }
    g.globalAlpha = 1;
  }
  const endMat = new MeshBasicMaterial({ map: canvasTexture(gl, endC.canvas, true), fog: true });
  endMat.color.setScalar(0.9);
  const endWall = new Mesh(new PlaneGeometry(2 * HALF_AISLE, CEIL_Y), endMat);
  scene.add(endWall);

  // ---- Floor ----------------------------------------------------------------
  const refl = new PlanarReflection(size.x / 2, size.y / 2, 0);
  const floorColor = new Color(p.floor);
  const { material: floorMat, uniforms: floorU } = makeReflectiveFloorMaterial({
    color: floorColor.clone().multiplyScalar(0.55),
    roughness: 0.35,
    metalness: 0.1,
    reflection: refl,
    reflectStrength: 0.9,
    blur: 0.01,
    lod: 2.6,
    tile: [0.6, 0.6],
    seamDarken: 0.18,
    tileVariation: 0.03,
    aoX: HALF_AISLE,
    aoWidth: 0.15,
    aoStrength: 0.35,
  });
  const floor = new Mesh(new PlaneGeometry(2 * HALF_AISLE, len), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zMid);
  scene.add(floor);
  refl.hide(floor);

  const pipe = makePipeline(gl, scene, camera, {
    grade: p.grade,
    bloom: { threshold: 0.7, smoothing: 0.35, intensity: 0.85, radius: 0.72 },
  });

  return {
    render: (frame) => {
      const f = mod(frame, p.loop);
      const camZ = -(f / p.loop) * TYPES * BAY; // exactly 5 bays per loop, no sway
      camera.position.set(0, camY, camZ);
      camera.lookAt(0, camY - 0.5, camZ - 10); // slight down tilt: vanishing point above centre
      camera.updateMatrixWorld();
      endWall.position.set(0, CEIL_Y / 2, camZ - 52);
      screenMat.uniforms.uFrame.value = f;
      floorU.uTileOffset.value.set(0, 0);
      pipe.final.set("seed", f);
      refl.update(gl, scene, camera);
      pipe.render();
    },
    dispose: () => {
      pipe.dispose();
      refl.dispose();
      pmrem.dispose();
    },
  };
};

