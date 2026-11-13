import * as THREE from "three";
import { rand, randInt } from "../lib/random";

// Procedural HUD "data sheet" textures for the holographic floor / wall
// layers. Drawn once per browser tab with Canvas 2D, uploaded as textures.

const WORDS = [
  "SECTOR",
  "DATA",
  "ANALYSIS",
  "SEQUENCE",
  "GENOME",
  "CODE",
  "SCAN",
  "NODE",
  "ALLELE",
  "BASE PAIR",
  "MATRIX",
  "LOCUS",
];

export type HudTextureOptions = {
  seed: number;
  size?: number;
  /** Fraction of big labels ("SECTOR 07", "78"). */
  bigLabels?: number;
  /** Density of data blocks (0..1). */
  density?: number;
  accent?: string;
  accent2?: string;
};

export const makeHudCanvas = (opts: HudTextureOptions): HTMLCanvasElement => {
  const S = opts.size ?? 2048;
  const seed = opts.seed;
  const accent = opts.accent ?? "#ffa040";
  const accent2 = opts.accent2 ?? "#7fe6ff";
  const density = opts.density ?? 1;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, S, S);
  const r = (...k: number[]) => rand(seed, ...k);
  const grey = (a: number) => `rgba(235,240,245,${a})`;

  // 1. faint fine grid
  ctx.strokeStyle = grey(0.07);
  ctx.lineWidth = 1;
  for (let i = 0; i <= S; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  // 2. data blocks: rows of tiny numbers
  const blocks = Math.round(70 * density);
  for (let b = 0; b < blocks; b++) {
    const x = r(b, 1) * S;
    const y = r(b, 2) * S;
    const rows = 3 + randInt(12, seed, b, 3);
    const cols = 1 + randInt(4, seed, b, 4);
    const fs = 12 + randInt(14, seed, b, 5);
    const a = 0.25 + r(b, 6) * 0.65;
    ctx.font = `600 ${fs}px ${r(b, 7) < 0.5 ? "ShareTechMono" : "Rajdhani"}`;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let s = "";
        const len = 3 + randInt(8, seed, b, row, col);
        for (let k = 0; k < len; k++) s += randInt(10, seed, b, row, col, k);
        const hot = r(b, row, col, 9) < 0.06;
        ctx.fillStyle = hot ? accent : grey(a * (0.5 + r(b, row, col, 8) * 0.5));
        ctx.fillText(s, x + col * fs * 6, y + row * fs * 1.35);
      }
    }
    // header bar over some blocks
    if (r(b, 10) < 0.5) {
      ctx.fillStyle = grey(a * 0.45);
      ctx.fillRect(x, y - fs * 1.7, cols * fs * 5.2, fs * 0.9);
    }
  }

  // 3. labels
  const labels = Math.round(18 * (opts.bigLabels ?? 1));
  for (let l = 0; l < labels; l++) {
    const x = r(l, 20) * S;
    const y = r(l, 21) * S;
    const big = r(l, 22) < 0.3;
    const fs = big ? 70 + r(l, 23) * 70 : 26 + r(l, 23) * 22;
    ctx.font = `${big ? 500 : 600} ${fs}px Rajdhani`;
    ctx.fillStyle = grey(0.5 + r(l, 24) * 0.45);
    const word = WORDS[randInt(WORDS.length, seed, l, 25)];
    const s = big && r(l, 26) < 0.5 ? String(10 + randInt(90, seed, l, 27)) : `${word} ${String(randInt(100, seed, l, 28)).padStart(2, "0")}`;
    ctx.fillText(s, x, y);
  }

  // 4. long bright lines (light streaks) - horizontal and vertical
  for (let i = 0; i < 18; i++) {
    const horizontal = r(i, 30) < 0.62;
    const pos = r(i, 31) * S;
    const start = r(i, 32) * S * 0.6;
    const len = S * (0.25 + r(i, 33) * 0.9);
    const w = 1 + r(i, 34) * 3;
    const a = 0.15 + r(i, 35) * 0.5;
    ctx.fillStyle = grey(a);
    if (horizontal) ctx.fillRect(start, pos, len, w);
    else ctx.fillRect(pos, start, w, len);
    // tick marks along some lines
    if (r(i, 36) < 0.4) {
      for (let t = 0; t < len; t += 24) {
        if (horizontal) ctx.fillRect(start + t, pos - 6, 1.5, 12);
        else ctx.fillRect(pos - 6, start + t, 12, 1.5);
      }
    }
  }

  // 5. rings / crosshair targets
  for (let i = 0; i < 9; i++) {
    const x = r(i, 40) * S;
    const y = r(i, 41) * S;
    const rad = 30 + r(i, 42) * 110;
    ctx.strokeStyle = grey(0.35 + r(i, 43) * 0.5);
    ctx.lineWidth = 2 + r(i, 44) * 2;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.stroke();
    if (r(i, 45) < 0.6) {
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.7, r(i, 46) * 6, r(i, 46) * 6 + 2.5);
      ctx.stroke();
    }
  }

  // 6. tick-mark / barcode strips
  for (let i = 0; i < 18; i++) {
    const x = r(i, 50) * S;
    const y = r(i, 51) * S;
    const n = 20 + randInt(60, seed, i, 52);
    for (let k = 0; k < n; k++) {
      if (r(i, k, 53) < 0.35) continue;
      ctx.fillStyle = r(i, k, 55) < 0.08 ? accent2 : grey(0.2 + r(i, k, 54) * 0.6);
      ctx.fillRect(x + k * 9, y, 3 + r(i, k, 56) * 4, 14);
    }
  }

  // 7. orange accent squares / dots
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = accent;
    const s = 4 + r(i, 60) * 8;
    ctx.globalAlpha = 0.5 + r(i, 61) * 0.5;
    ctx.fillRect(r(i, 62) * S, r(i, 63) * S, s, s);
  }
  ctx.globalAlpha = 1;

  // 8. dot matrices
  for (let i = 0; i < 10; i++) {
    const x = r(i, 70) * S;
    const y = r(i, 71) * S;
    const cols = 8 + randInt(20, seed, i, 72);
    const rows = 4 + randInt(10, seed, i, 73);
    for (let a = 0; a < cols; a++) {
      for (let b = 0; b < rows; b++) {
        if (r(i, a, b, 74) < 0.3) continue;
        ctx.fillStyle = grey(0.2 + r(i, a, b, 75) * 0.6);
        ctx.fillRect(x + a * 14, y + b * 14, 4, 4);
      }
    }
  }
  return c;
};

export const makeHudTexture = (
  opts: HudTextureOptions,
  renderer: THREE.WebGLRenderer,
): THREE.CanvasTexture => {
  const tex = new THREE.CanvasTexture(makeHudCanvas(opts));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
};
