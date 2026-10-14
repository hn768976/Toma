import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { ChipRevealRow } from "../colorways";
import { makeBokeh, BokehSpec } from "../kit/bokeh";
import { buildBoardBackdrop, buildBoardFloor } from "../kit/board";
import { CameraRig } from "../kit/Camera";
import { CHIP, drawChipFace } from "../kit/chip";
import { FONT_AI, FONT_HEAD, FONT_MONO } from "../kit/fonts";
import { digits } from "../kit/hudText";
import { DofSettings, makeHudMaterial, makeTexMaterial } from "../kit/materials";
import { canvasTexture, LiveLabel, makeCanvas, Painter } from "../kit/painter";
import { Pipeline } from "../kit/Pipeline";
import { hash2, mulberry32, tickDigits } from "../kit/random";
import { Stage } from "../kit/Stage";

// ---------------------------------------------------------------------------
// Look 3 — AI Chip Reveal. A chip on a circuit board; its centre letters
// scramble and lock on "AI", then HUD callouts draw out to the left. 10 s.
// ---------------------------------------------------------------------------

const FPS = 30;
const LOCK_FRAME = 75; // 2.5 s
const SCRAMBLE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&?";

// chip placement (world)
const CHIP_X = 0.62;
const CHIP_Y = -0.22;
const CHIP_SIZE = 2.7;
const CHIP_DEPTH = 0.24;
const FACE_Z = CHIP_DEPTH / 2;
const DIE_SIZE = (CHIP_SIZE / 2) * CHIP.DIE; // half size
const DIE_H = 0.07;
const FLOOR_Y = CHIP_Y - CHIP_SIZE / 2 - 0.01;
const CAM_Z = 7.6;

// in-material DoF: thin lens focused on the chip face
const DOF: DofSettings = { mode: 1, a: CAM_Z - FACE_Z, b: 16, c: 0, max: 56, min: 0 };

const mono = (px: number, w = 500) => `${w} ${px}px "${FONT_MONO}"`;
const head = (px: number, w = 700) => `${w} ${px}px "${FONT_HEAD}"`;

// ------------------------------------------------------------- chip textures
const buildFace = (row: ChipRevealRow) => {
  const S = 2048;
  const { cv, ctx } = makeCanvas(S, S);
  const hud = new THREE.Color(row.hud);
  const pad = `rgb(${Math.round(hud.r * 175)},${Math.round(hud.g * 195)},${Math.round(hud.b * 215)})`;
  drawChipFace(ctx, S, {
    body: "#070d18",
    pad,
    tick: row.ticks,
    rim: `#${new THREE.Color(row.hud).multiplyScalar(0.45).getHexString()}`,
    die: row.die,
    grid: "rgba(90,140,220,0.10)",
  });
  // fine orange tick marks scattered across the pads (as in the reference)
  const rng = mulberry32(0x7a11);
  ctx.strokeStyle = row.ticks;
  ctx.lineWidth = 3;
  for (let i = 0; i < 60; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const m = Math.max(Math.abs(x / S - 0.5), Math.abs(y / S - 0.5)) * 2;
    // a few, mostly towards the package edges
    if (m < 0.78 || m > CHIP.RING_OUT) continue;
    ctx.globalAlpha = 0.5 + 0.5 * rng();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10 + rng() * 40, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return canvasTexture(cv, 8);
};

const buildDie = (row: ChipRevealRow) => {
  const S = 1024;
  const { cv, ctx } = makeCanvas(S, S);
  const die = new THREE.Color(row.die);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, `#${die.clone().multiplyScalar(4.2).getHexString()}`);
  g.addColorStop(1, `#${die.getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // fine circuit grid
  ctx.strokeStyle = "rgba(140,190,255,0.12)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 40; i++) {
    const p = (i / 40) * S;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  const rng = mulberry32(0xd1e);
  ctx.strokeStyle = "rgba(160,210,255,0.22)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    let x = Math.round(rng() * 40) * (S / 40);
    let y = Math.round(rng() * 40) * (S / 40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (rng() < 0.5) x += (Math.round(rng() * 8) - 4) * (S / 40);
      else y += (Math.round(rng() * 8) - 4) * (S / 40);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // soft inner glow, brighter vertical core (no hard frame)
  const gl = ctx.createLinearGradient(0, 0, S, 0);
  gl.addColorStop(0.3, "rgba(80,150,255,0)");
  gl.addColorStop(0.5, "rgba(110,180,255,0.22)");
  gl.addColorStop(0.7, "rgba(80,150,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, S, S);
  return canvasTexture(cv, 8);
};

/** HUD frames layered on the chip face (squares, ring, ticks). Timeline 0..1 = 0..2.5 s */
const buildFaceHud = () => {
  const D = 1024;
  const p = new Painter(D * 2, D * 2);
  p.setScale(2);
  const c = D / 2;
  const U = (u: number) => c + u * (D / 2);
  // big square frame (double), drawn on from top-left
  p.frame(U(-0.66), U(-0.66), U(0.66) - U(-0.66), U(0.66) - U(-0.66), 0.05, 0.5, { width: 4.6, ticks: 26 });
  p.frame(U(-0.6), U(-0.6), U(0.6) - U(-0.6), U(0.6) - U(-0.6), 0.15, 0.6, { width: 2.4, alpha: 0.7, corner: 2 });
  // inner squares (partial)
  p.path([[U(-0.48), U(-0.3)], [U(-0.48), U(-0.48)], [U(0.2), U(-0.48)]], 0.3, 0.6, 2.2, 0.85);
  p.path([[U(0.48), U(0.3)], [U(0.48), U(0.48)], [U(-0.2), U(0.48)]], 0.3, 0.6, 2.2, 0.85);
  // ring
  p.arc(c, c, D * 0.29, -Math.PI / 2, Math.PI * 1.5, 0.2, 0.75, 4.8, 1);
  p.arc(c, c, D * 0.31, 0.3, 1.9, 0.4, 0.7, 2.4, 0.8);
  p.arc(c, c, D * 0.31, 3.4, 5.0, 0.45, 0.75, 2.4, 0.8);
  for (const a of [0.3, 1.9, 3.4, 5.0, 2.62]) p.dot(c + Math.cos(a) * D * 0.29, c + Math.sin(a) * D * 0.29, 7, 0.75, 1);
  // tick marks between frame and ring
  p.line(U(0), U(-0.66), U(0), U(-0.58), 0.6, 0.65, 2.4);
  p.line(U(0.1), U(-0.75), U(0.04), U(-0.62), 0.6, 0.65, 2.4);
  p.line(U(-0.66), U(0), U(-0.58), U(0), 0.6, 0.65, 2.4);
  p.line(U(0.66), U(0), U(0.58), U(0), 0.6, 0.65, 2.4);
  p.line(U(0), U(0.66), U(0), U(0.58), 0.6, 0.65, 2.4);
  // diagonal guide lines (thin)
  p.line(U(-0.66), U(-0.66), U(-0.3), U(-0.3), 0.5, 0.7, 1.2, 0.5);
  p.line(U(0.66), U(0.66), U(0.3), U(0.3), 0.5, 0.7, 1.2, 0.5);
  return p.pack(8);
};

// ------------------------------------------------------------- callouts
// Design space 2560×2560 px on a plane 4.4×4.4 world, centre (CO_X, CO_Y).
const CO_SIZE = 4.4;
const CO_X = -1.75;
const CO_Y = 0.1;
const CO_D = 2560;
const W2D = (x: number) => ((x - (CO_X - CO_SIZE / 2)) / CO_SIZE) * CO_D;
const H2D = (y: number) => ((CO_Y + CO_SIZE / 2 - y) / CO_SIZE) * CO_D;

/** Callout timeline 0..1 = 3.5..6.5 s */
const buildCallouts = (row: ChipRevealRow) => {
  const p = new Painter(CO_D, CO_D);
  const rng = mulberry32(0xca11);
  const chipL = CHIP_X - CHIP_SIZE / 2;
  const pt = (x: number, y: number): [number, number] => [W2D(x), H2D(y)];

  // --- DATA box (top-left), connector from chip's upper left
  const dataBox = { x: W2D(-3.25), y: H2D(1.28), w: 210, h: 160 };
  p.bezier(pt(chipL + 0.1, 1.05), pt(-0.6, 1.25), pt(-2.0, 1.3), [dataBox.x + dataBox.w, dataBox.y + 60], 0.0, 0.32, 2.4, 0.85);
  p.dot(...pt(chipL + 0.1, 1.05), 7, 0.0, 1);
  p.frame(dataBox.x, dataBox.y, dataBox.w, dataBox.h, 0.28, 0.42, { width: 2.6, bevel: 26, ticks: 12, corner: 1 });
  p.text(row.labels.data, dataBox.x + 22, dataBox.y + 50, head(42), 0.42, 0.5, 1);
  p.text(digits(rng, 7), dataBox.x + 22, dataBox.y + 116, mono(32, 600), 0.48, 0.6, 0.9);

  // --- CHATBOT: triangle badge + label + underline bars
  const cbY = H2D(0.5);
  const cbX = W2D(-2.42);
  p.line(...pt(chipL, 0.5), W2D(-0.98), cbY + 30, 0.05, 0.25, 2.6, 0.9);
  p.dot(...pt(chipL, 0.5), 7, 0.05, 1);
  // generic triangle badge
  const tri = (x: number, y: number, r: number, t: number) =>
    p.path([[x - r, y + r * 0.6], [x, y - r * 0.85], [x + r, y + r * 0.6], [x - r, y + r * 0.6]], t, t + 0.12, 6, 1);
  tri(cbX + 20, cbY + 4, 58, 0.3);
  tri(cbX + 118, cbY + 4, 58, 0.34);
  p.line(cbX + 50, cbY + 20, cbX + 88, cbY + 20, 0.38, 0.42, 6, 1);
  p.path([[cbX - 50, cbY + 60], [cbX + 180, cbY + 60], [cbX + 200, cbY + 40]], 0.36, 0.44, 4, 1);
  p.dot(cbX + 75, cbY - 30, 6, 0.4, 1);
  p.text(row.labels.chatbot, cbX + 215, cbY + 32, head(104), 0.5, 0.66, 1, { spacing: 3 });
  p.bar(cbX + 215, cbY + 54, 480, 12, 0.4, 0.6, 1);
  p.bar(cbX + 185, cbY - 44, 300, 5, 0.42, 0.6, 0.7);
  p.bar(cbX + 500, cbY - 44, 110, 5, 0.5, 0.62, 0.7);

  // --- COMMAND PROMPT box, fed by a curve from the chatbot line
  const pr = { x: W2D(-3.62), y: H2D(-0.02), w: 660, h: 84 };
  p.bezier([W2D(-1.2), cbY + 30], [W2D(-1.6), cbY + 220], [pr.x + pr.w + 160, pr.y], [pr.x + pr.w, pr.y + pr.h / 2], 0.18, 0.4, 2.2, 0.8);
  p.frame(pr.x, pr.y, pr.w, pr.h, 0.38, 0.52, { width: 4.5, ticks: 14 });
  p.fill(pr.x + 10, pr.y + 10, pr.w - 20, pr.h - 20, 0.5, 0.22);
  p.frame(pr.x - 12, pr.y - 12, pr.w + 24, pr.h + 24, 0.45, 0.6, { width: 1.2, alpha: 0.5, corner: 2 });
  p.text(row.labels.prompt, pr.x + 22, pr.y + 56, mono(36, 600), 0.55, 0.78, 1);
  for (let i = 0; i < 5; i++) p.fill(pr.x + pr.w - 150 + i * 26, pr.y + 18, 18, 38, 0.8 + i * 0.03, 0.9);

  // --- block widget below, fed by a curve from the prompt box
  const bw = { x: W2D(-2.35), y: H2D(-0.78), cols: 5, rows: 3, cs: 56, gap: 22 };
  p.bezier([pr.x + 20, pr.y + pr.h], [pr.x - 40, pr.y + 360], [bw.x - 260, bw.y + 70], [bw.x - 10, bw.y + 70], 0.35, 0.6, 2.2, 0.8);
  for (let r = 0; r < bw.rows; r++)
    for (let c = 0; c < bw.cols; c++) {
      const x = bw.x + c * (bw.cs + bw.gap);
      const y = bw.y + r * (bw.cs + bw.gap);
      const t = 0.55 + (r * bw.cols + c) * 0.015;
      p.frame(x, y, bw.cs, bw.cs, t, t + 0.04, { width: 2 });
      if (hash2(r * 7 + c, 3) < 0.3) p.fill(x + 6, y + 6, bw.cs - 12, bw.cs - 12, t + 0.06, 0.5);
      if (hash2(r * 7 + c, 9) < 0.18) p.dot(x + bw.cs / 2, y + bw.cs / 2, 9, t + 0.06, 1, true);
    }
  p.text(digits(rng, 3), bw.x - 64, bw.y + 32, mono(24), 0.6, 0.66, 0.8);
  p.text(digits(rng, 3), bw.x - 64, bw.y + 84, mono(24), 0.62, 0.68, 0.8);

  // --- MODEL box (bottom-left), off the block widget
  const md = { x: W2D(-3.55), y: H2D(-1.05), w: 250, h: 190 };
  p.bezier([bw.x, bw.y + 140], [bw.x - 80, bw.y + 260], [md.x + md.w + 80, md.y + 90], [md.x + md.w, md.y + 90], 0.55, 0.72, 2.2, 0.8);
  p.frame(md.x, md.y, md.w, md.h, 0.7, 0.82, { width: 2.6, bevel: 26, ticks: 12, corner: 1 });
  p.text(row.labels.model, md.x + 24, md.y + 56, head(48), 0.82, 0.88, 1);
  p.text(digits(rng, 7), md.x + 24, md.y + 130, mono(38, 600), 0.85, 0.95, 0.9);
  return p.pack(8);
};

// ------------------------------------------------------------- board & bg
const buildFloor = (row: ChipRevealRow) => buildBoardFloor(row.board);
const buildBackdrop = (row: ChipRevealRow) => buildBoardBackdrop(row.board, [row.bokeh[0], row.bokeh[3]], 16);

const buildBokeh = (row: ChipRevealRow) => {
  const rng = mulberry32(0xb0ce);
  const specs: BokehSpec[] = [];
  for (let i = 0; i < 10; i++) {
    const z = -2.5 - rng() * 7;
    const spread = (CAM_Z - z) * 0.5;
    let x = (rng() * 2 - 1) * spread * 1.0;
    const y = -0.4 + rng() * spread * 0.55;
    // keep most lights away from the chip's silhouette
    if (Math.abs(x - CHIP_X) < 1.0 && y < 1.6) x += x < CHIP_X ? -1.4 : 1.4;
    const color = new THREE.Color(row.bokeh[Math.floor(rng() * row.bokeh.length)]);
    specs.push({ x, y, z, size: 30 + rng() * 120, color, gain: 0.05 + rng() * 0.2 });
  }
  // a few big warm/cool discs at the sides (reference has them right and left)
  for (let i = 0; i < 5; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    specs.push({
      x: side * (2.5 + rng() * 2.5) + 0.6,
      y: -0.3 + rng() * 2.2,
      z: -1 - rng() * 3,
      size: 90 + rng() * 110,
      color: new THREE.Color(row.bokeh[row.bokeh.length - 1 - (i % 2)]),
      gain: 0.12 + rng() * 0.16,
    });
  }
  // warm (or accent) lights, soft and large
  const warm = new THREE.Color(row.bokeh[row.bokeh.length - 1]).lerp(new THREE.Color("#fff6e8"), 0.65);
  for (const [x, y, z, sz] of [[-3.6, 1.6, -3, 120], [-0.2, 2.3, -5, 90], [4.4, 1.3, -3, 150], [4.7, 0.4, -2.5, 120], [3.2, 2.2, -6, 80], [-4.6, 0.2, -4, 90]])
    specs.push({ x, y, z, size: sz, color: warm.clone(), gain: 0.22 + rng() * 0.15 });
  // a saturated glow patch bottom-right
  specs.push({ x: 4.3, y: -1.9, z: 2.2, size: 420, color: new THREE.Color(row.bokeh[0]), gain: 0.35 });
  // fine floating specks
  for (let i = 0; i < 130; i++)
    specs.push({ x: (rng() * 2 - 1) * 5, y: -1.2 + rng() * 4, z: -2 + rng() * 4, size: 3 + rng() * 6, color: new THREE.Color(row.hud), gain: 0.25 + rng() * 0.5 });
  return makeBokeh(specs, 0xb0cf);
};

// ------------------------------------------------------------- scene
const NUMS = [
  { u: 0.0, v: 0.76, base: 10, rate: 4, slot: 21 },
  { u: -0.8, v: 0.0, base: 452, rate: 11, slot: 22 },
  { u: 0.8, v: 0.0, base: 34, rate: 3, slot: 23 },
  { u: 0.0, v: -0.76, base: 884, rate: 17, slot: 24 },
];

const Scene: React.FC<{ row: ChipRevealRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sec = frame / FPS;

  const a = useMemo(() => {
    const face = makeTexMaterial({ map: buildFace(row), dof: DOF, depthTest: true, depthWrite: true });
    face.transparent = false;
    const die = makeTexMaterial({ map: buildDie(row), dof: DOF, depthTest: true, depthWrite: true });
    die.transparent = false;
    const side = new THREE.MeshBasicMaterial({ color: "#0b1424" });
    const faceHud = makeHudMaterial({ map: buildFaceHud(), line: row.hud, dof: DOF, flash: 1.5 });
    const callouts = makeHudMaterial({ map: buildCallouts(row), line: row.hud, fill: row.hud, dof: DOF, fillOpacity: 0.8, flash: 1.6 });
    const floor = makeTexMaterial({ map: buildFloor(row), dof: { ...DOF, b: 22, min: 0 }, depthTest: true, depthWrite: true });
    floor.transparent = false;
    const backdrop = makeTexMaterial({ map: buildBackdrop(row), dof: { ...DOF, max: 0 }, depthTest: false });
    backdrop.transparent = false;
    const letters = new LiveLabel(1024, 512, `600 360px "${FONT_AI}"`, "center", 50);
    const lettersMat = makeHudMaterial({ map: letters.draw("AI"), line: row.hud, dof: DOF, flash: 0 });
    lettersMat.uniforms.uNow.value = 2;
    const nums = NUMS.map((n) => {
      const label = new LiveLabel(256, 72, mono(48, 600), "center");
      const mat = makeHudMaterial({ map: label.draw("000"), line: row.hud, dof: DOF, flash: 0 });
      mat.uniforms.uNow.value = 2;
      return { ...n, label, mat };
    });
    const bokeh = buildBokeh(row);
    const lc = new THREE.Color(row.bokeh[3]).multiplyScalar(0.022);
    const lift: [number, number, number] = [lc.r, lc.g, lc.b];
    return { face, die, side, faceHud, callouts, floor, backdrop, letters, lettersMat, nums, bokeh, lift };
  }, [row]);

  // ---- per-frame values (pure functions of frame)
  const soft = interpolate(sec, [0, 2.3], [14, 1.4], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  for (const m of [a.face, a.die, a.faceHud, a.lettersMat, ...a.nums.map((n) => n.mat)]) m.uniforms.uDofMin.value = soft;

  // letters: scramble every 2 frames, lock on the centre text with a flash
  let str = row.centre;
  if (frame < LOCK_FRAME) {
    const bucket = Math.floor(frame / 2);
    str = "";
    for (let slot = 0; slot < row.centre.length; slot++) {
      str += SCRAMBLE_CHARS[Math.floor(hash2(slot + 1, bucket) * SCRAMBLE_CHARS.length)];
    }
  }
  a.lettersMat.uniforms.uMap.value = a.letters.draw(str);
  const sinceLock = frame - LOCK_FRAME;
  const flash = sinceLock >= 0 ? 1.6 * Math.exp(-sinceLock / 5) : 0;
  const pulse = sec > 6.5 ? 0.1 * Math.sin(((frame - 195) / 30) * Math.PI * 2 * 0.6) : 0;
  a.lettersMat.uniforms.uOpacity.value = (frame < LOCK_FRAME ? 0.75 : 1.05) * (1 + flash + pulse) * interpolate(sec, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

  // chip-face HUD: draws on dimly 0–2.5 s, brightens at the lock
  a.faceHud.uniforms.uNow.value = sec / 2.5;
  a.faceHud.uniforms.uOpacity.value = interpolate(sec, [0, 2.5, 2.5 + 1 / 30, 3.5], [0.45, 0.5, 1.6, 1.25], { extrapolateRight: "clamp" });

  // callouts draw out 3.5–6.5 s
  a.callouts.uniforms.uNow.value = (sec - 3.5) / 3.0;
  a.callouts.uniforms.uOpacity.value = 1.45;

  // tick numbers count up from 3.5 s, then tick on seeded holds
  a.nums.forEach((n) => {
    const t = Math.max(0, frame - 105);
    const counting = Math.min(t, 90);
    let v = n.base + Math.floor(counting * n.rate * 0.33);
    if (t > 90) v += Number(tickDigits(n.slot, frame, 1, [6, 10, 15], durationInFrames));
    n.mat.uniforms.uMap.value = n.label.draw(String(v));
    n.mat.uniforms.uOpacity.value = interpolate(sec, [3.4, 3.7], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  });

  a.bokeh.material.uniforms.uPhase.value = frame / 300;

  // camera: almost face-on, slight push in on the hold
  const push = interpolate(sec, [0, 6.5, 10], [0, 0.15, 0.55], { easing: Easing.inOut(Easing.sin) });
  const camZ = CAM_Z - push;
  const driftX = 0.05 * Math.sin((frame / 300) * Math.PI * 2);
  a.face.uniforms.uDof.value.y = camZ - FACE_Z; // keep focus on the chip face
  [a.die, a.faceHud, a.callouts, a.floor, a.backdrop, a.lettersMat, ...a.nums.map((n) => n.mat)].forEach((m) => (m.uniforms.uDof.value.y = camZ - FACE_Z));

  const unit = CHIP_SIZE / 2;
  return (
    <>
      <CameraRig position={[driftX, 1.25, camZ]} target={[driftX * 0.5, 0.05, 0]} fov={32} />
      {/* blurred board far behind */}
      <mesh renderOrder={-5} position={[0, 2.0, -12]} material={a.backdrop}>
        <planeGeometry args={[34, 19]} />
      </mesh>
      <primitive object={a.bokeh} renderOrder={-4} />
      {/* board floor */}
      <mesh renderOrder={0} position={[CHIP_X, FLOOR_Y, -4]} rotation={[-Math.PI / 2, 0, 0]} material={a.floor}>
        <planeGeometry args={[26, 26]} />
      </mesh>
      {/* chip package */}
      <group position={[CHIP_X, CHIP_Y, 0]} rotation={[0, -0.12, 0]}>
        <mesh renderOrder={1} material={a.side}>
          <boxGeometry args={[CHIP_SIZE, CHIP_SIZE, CHIP_DEPTH]} />
        </mesh>
        <mesh renderOrder={2} position={[0, 0, FACE_Z + 0.001]} material={a.face}>
          <planeGeometry args={[CHIP_SIZE, CHIP_SIZE]} />
        </mesh>
        <mesh renderOrder={2} position={[0, 0, FACE_Z + DIE_H / 2]} material={a.side}>
          <boxGeometry args={[DIE_SIZE * 2, DIE_SIZE * 2, DIE_H]} />
        </mesh>
        <mesh renderOrder={3} position={[0, 0, FACE_Z + DIE_H + 0.001]} material={a.die}>
          <planeGeometry args={[DIE_SIZE * 2, DIE_SIZE * 2]} />
        </mesh>
        <mesh renderOrder={5} position={[0, 0, FACE_Z + DIE_H + 0.01]} material={a.faceHud}>
          <planeGeometry args={[CHIP_SIZE, CHIP_SIZE]} />
        </mesh>
        <mesh renderOrder={6} position={[0, -0.01, FACE_Z + DIE_H + 0.02]} material={a.lettersMat}>
          <planeGeometry args={[DIE_SIZE * 3.0, DIE_SIZE * 1.5]} />
        </mesh>
        {a.nums.map((n, i) => (
          <mesh key={i} renderOrder={6} position={[n.u * unit, n.v * unit, FACE_Z + DIE_H + 0.02]} material={n.mat}>
            <planeGeometry args={[0.5, 0.14]} />
          </mesh>
        ))}
      </group>
      {/* callouts, at the chip's depth so they stay in focus */}
      <mesh renderOrder={7} position={[CO_X, CO_Y, FACE_Z + 0.05]} material={a.callouts}>
        <planeGeometry args={[CO_SIZE, CO_SIZE]} />
      </mesh>
      <Pipeline frame={frame} period={durationInFrames} bloomStrength={1.35} bloomThreshold={0.22} vignette={0.55} grain={0.015} saturation={0.85} chroma={4} lift={a.lift} />
    </>
  );
};

export const AIChipReveal: React.FC<{ row: ChipRevealRow }> = ({ row }) => (
  <Stage fov={32}>
    <Scene row={row} />
  </Stage>
);
