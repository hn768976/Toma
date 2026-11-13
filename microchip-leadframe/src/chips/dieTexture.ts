import * as THREE from "three";
import { makeRng } from "../engine/math";

/**
 * Floor plan of the silicon die, drawn once on a 2D canvas.
 *   R = block brightness, G = fine wiring, B = film-thickness variation
 * (drives the hue of the thin-film interference in the die shader).
 */
export const buildDieTexture = (): THREE.CanvasTexture => {
  const S = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const rng = makeRng(77123);
  const px = (r: number, g: number, b: number) =>
    `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;

  ctx.fillStyle = px(0.5, 0.0, 0.5);
  ctx.fillRect(0, 0, S, S);

  const block = (x: number, y: number, w: number, h: number, depth = 0) => {
    const tone = 0.28 + rng() * 0.5;
    const film = rng();
    ctx.fillStyle = px(tone, 0, film);
    ctx.fillRect(x, y, w, h);
    // internal structure: rows of cells or sub-blocks
    if (depth < 2 && w > 90 && h > 90 && rng() < 0.75) {
      const cols = 1 + Math.floor(rng() * 3);
      const rows = 1 + Math.floor(rng() * 4);
      const gap = 5;
      const cw = (w - gap * (cols + 1)) / cols;
      const ch = (h - gap * (rows + 1)) / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          block(x + gap + i * (cw + gap), y + gap + j * (ch + gap), cw, ch, depth + 1);
        }
      }
    } else {
      // memory-like stripes
      const horizontal = rng() < 0.5;
      const n = 6 + Math.floor(rng() * 18);
      ctx.fillStyle = px(Math.min(tone + 0.14, 1), 0.55, film);
      for (let i = 0; i < n; i++) {
        if (horizontal) {
          ctx.fillRect(x + 3, y + ((i + 0.3) * h) / n, w - 6, Math.max(1, (h / n) * 0.3));
        } else {
          ctx.fillRect(x + ((i + 0.3) * w) / n, y + 3, Math.max(1, (w / n) * 0.3), h - 6);
        }
      }
    }
    ctx.strokeStyle = px(0.92, 1, 0.5);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  };

  // Seal ring / pad frame
  const M = 34;
  ctx.fillStyle = px(0.42, 0.2, 0.5);
  ctx.fillRect(M, M, S - 2 * M, S - 2 * M);

  // Left third: a few large logic blocks. Right two thirds: memory array.
  const L = M + 14;
  const T = M + 14;
  const W = S - 2 * (M + 14);
  const H = W;
  const split = Math.round(W * 0.36);
  block(L, T, split - 10, Math.round(H * 0.3));
  block(L, T + Math.round(H * 0.3) + 10, split - 10, Math.round(H * 0.42));
  block(L, T + Math.round(H * 0.72) + 20, split - 10, H - Math.round(H * 0.72) - 20);
  // top strip above the array
  block(L + split, T, W - split, Math.round(H * 0.16));
  const cols = 3;
  const rows = 4;
  const gx = 10;
  const ax = L + split;
  const ay = T + Math.round(H * 0.16) + gx;
  const aw = (W - split - gx * (cols - 1)) / cols;
  const ah = (H - Math.round(H * 0.16) - gx * rows) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      block(ax + i * (aw + gx), ay + j * (ah + gx), aw, ah, 1);
    }
  }

  // bond-pad dots around the edge
  ctx.fillStyle = px(1, 1, 0.5);
  for (let i = 0; i < 44; i++) {
    const u = M * 0.3 + ((S - M * 0.6) * (i + 0.5)) / 44;
    ctx.fillRect(u - 4, 8, 8, 14);
    ctx.fillRect(u - 4, S - 22, 8, 14);
    ctx.fillRect(8, u - 4, 14, 8);
    ctx.fillRect(S - 22, u - 4, 14, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

/** Brushed-metal micro roughness (tileable-ish noise). */
export const buildBrushedTexture = (): THREE.CanvasTexture => {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const rng = makeRng(4242);
  const img = ctx.createImageData(S, S);
  // streaky noise: strong correlation along x
  const row = new Float32Array(S);
  for (let y = 0; y < S; y++) {
    let v = rng();
    for (let x = 0; x < S; x++) {
      v = v * 0.9 + rng() * 0.1;
      row[x] = v;
    }
    const base = rng() * 0.25;
    for (let x = 0; x < S; x++) {
      const g = Math.max(0, Math.min(1, 0.5 + (row[x] - 0.5) * 2.4 + base - 0.125 + (rng() - 0.5) * 0.12));
      const k = (y * S + x) * 4;
      // glTF convention: roughness in G, metalness in B
      img.data[k] = 255;
      img.data[k + 1] = Math.round(255 * (0.74 + 0.26 * g));
      img.data[k + 2] = 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};
