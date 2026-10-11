import * as THREE from "three";
import { mulberry32 } from "../lib/random";

// Kraft corrugated cardboard (colour + roughness), built once in Canvas 2D.
// The texture spans 2 x 2 world units; stripes run along canvas y.
export const KRAFT_SPAN = 2;

const finish = (cv: HTMLCanvasElement, srgb: boolean) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};

export const buildKraft = () => {
  const S = 1024;
  const rng = mulberry32(0xc4af7);
  const col = document.createElement("canvas");
  col.width = col.height = S;
  const rough = document.createElement("canvas");
  rough.width = rough.height = S;
  const c = col.getContext("2d")!;
  const r = rough.getContext("2d")!;
  const ci = c.createImageData(S, S);
  const ri = r.createImageData(S, S);
  // Low-frequency mottling (tileable value noise) + fibres + corrugation.
  const G = 16;
  const lat = new Float32Array(G * G).map(() => rng());
  const vn = (x: number, y: number) => {
    const gx = (x / S) * G, gy = (y / S) * G;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const a = lat[(y0 % G) * G + (x0 % G)], b = lat[(y0 % G) * G + ((x0 + 1) % G)];
    const cc = lat[((y0 + 1) % G) * G + (x0 % G)], d = lat[((y0 + 1) % G) * G + ((x0 + 1) % G)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (cc * (1 - sx) + d * sx) * sy;
  };
  const fib = new Float32Array(S * S);
  for (let i = 0; i < 2600; i++) {
    // short fibres
    let x = rng() * S, y = rng() * S;
    const ang = rng() * Math.PI, len = 6 + rng() * 22, v = (rng() - 0.5) * 0.12;
    for (let k = 0; k < len; k++) {
      const xi = ((Math.floor(x) % S) + S) % S, yi = ((Math.floor(y) % S) + S) % S;
      fib[yi * S + xi] += v;
      x += Math.cos(ang); y += Math.sin(ang);
    }
  }
  const period = S / 56; // ~0.036 world units per flute
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const m = vn(x, y) * 0.6 + vn((x * 3) % S, (y * 3) % S) * 0.4;
    const flute = 0.5 + 0.5 * Math.cos((2 * Math.PI * x) / period);
    const grain = (rng() - 0.5) * 0.05;
    const v = 1 + (m - 0.5) * 0.12 + fib[i] + grain - flute * 0.09;
    ci.data[i * 4] = Math.max(0, Math.min(255, 0xc8 * v));
    ci.data[i * 4 + 1] = Math.max(0, Math.min(255, 0x9a * v * (1 + (m - 0.5) * 0.03)));
    ci.data[i * 4 + 2] = Math.max(0, Math.min(255, 0x5a * v * (1 - (m - 0.5) * 0.05)));
    ci.data[i * 4 + 3] = 255;
    const rv = Math.max(0, Math.min(255, 255 * (0.82 + (m - 0.5) * 0.1 + flute * 0.04 + grain)));
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = rv;
    ri.data[i * 4 + 3] = 255;
  }
  c.putImageData(ci, 0, 0);
  r.putImageData(ri, 0, 0);
  return { color: finish(col, true), rough: finish(rough, false) };
};

// Decal atlas: 2 x 4 cells of 512 x 256. Cells 0-4: invented shipping labels.
// Cells 5-7: rows of generic handling pictograms (this way up, keep dry, fragile).
export const ATLAS_COLS = 2;
export const ATLAS_ROWS = 4;

const drawArrows = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  for (const off of [-0.2, 0.2]) {
    const cx = x + s * (0.5 + off);
    c.beginPath();
    c.moveTo(cx, y + s * 0.18);
    c.lineTo(cx - s * 0.14, y + s * 0.4);
    c.lineTo(cx - s * 0.05, y + s * 0.4);
    c.lineTo(cx - s * 0.05, y + s * 0.72);
    c.lineTo(cx + s * 0.05, y + s * 0.72);
    c.lineTo(cx + s * 0.05, y + s * 0.4);
    c.lineTo(cx + s * 0.14, y + s * 0.4);
    c.closePath();
    c.fill();
  }
  c.fillRect(x + s * 0.2, y + s * 0.78, s * 0.6, s * 0.06);
};
const drawUmbrella = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  const cx = x + s * 0.5, cy = y + s * 0.48;
  c.beginPath();
  c.moveTo(cx - s * 0.32, cy);
  c.quadraticCurveTo(cx, cy - s * 0.42, cx + s * 0.32, cy);
  c.closePath();
  c.fill();
  c.lineWidth = s * 0.05;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx, cy + s * 0.26);
  c.arc(cx - s * 0.07, cy + s * 0.26, s * 0.07, 0, Math.PI, false);
  c.stroke();
  for (const [dx, dy] of [[-0.25, -0.33], [0.0, -0.4], [0.25, -0.33]]) {
    c.fillRect(cx + dx * s - s * 0.015, cy + dy * s - s * 0.08, s * 0.03, s * 0.07);
  }
};
const drawGlass = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  const cx = x + s * 0.5;
  c.beginPath();
  c.moveTo(cx - s * 0.2, y + s * 0.15);
  c.lineTo(cx + s * 0.2, y + s * 0.15);
  c.quadraticCurveTo(cx + s * 0.2, y + s * 0.5, cx + s * 0.03, y + s * 0.52);
  c.lineTo(cx + s * 0.03, y + s * 0.75);
  c.lineTo(cx + s * 0.15, y + s * 0.8);
  c.lineTo(cx - s * 0.15, y + s * 0.8);
  c.lineTo(cx - s * 0.03, y + s * 0.75);
  c.lineTo(cx - s * 0.03, y + s * 0.52);
  c.quadraticCurveTo(cx - s * 0.2, y + s * 0.5, cx - s * 0.2, y + s * 0.15);
  c.fill();
  // crack mark
  c.strokeStyle = "#fff";
  c.lineWidth = s * 0.03;
  c.beginPath();
  c.moveTo(cx - s * 0.05, y + s * 0.17);
  c.lineTo(cx + s * 0.03, y + s * 0.27);
  c.lineTo(cx - s * 0.02, y + s * 0.33);
  c.stroke();
  c.strokeStyle = "#111";
};

export const buildDecalAtlas = () => {
  const CW = 512, CH = 256;
  const cv = document.createElement("canvas");
  cv.width = CW * ATLAS_COLS;
  cv.height = CH * ATLAS_ROWS;
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, cv.width, cv.height);
  const rng = mulberry32(0x1abe1);
  const chars = "0123456789";
  const rnd = (n: number) => Array.from({ length: n }, () => chars[Math.floor(rng() * chars.length)]).join("");
  for (let cell = 0; cell < 8; cell++) {
    const ox = (cell % ATLAS_COLS) * CW, oy = Math.floor(cell / ATLAS_COLS) * CH;
    if (cell < 5) {
      // Label: white card, invented barcode (random bar widths), grey filler lines.
      c.fillStyle = "#F6F5F0";
      c.fillRect(ox + 6, oy + 6, CW - 12, CH - 12);
      c.strokeStyle = "#2A2A2A";
      c.lineWidth = 3;
      c.strokeRect(ox + 18, oy + 18, CW - 36, CH - 36);
      c.fillStyle = "#1A1A1A";
      c.font = `600 30px Inter`;
      c.fillText(rnd(3) + "-" + rnd(4) + "-" + rnd(2), ox + 32, oy + 58);
      c.fillStyle = "#8A8A8A";
      for (let l = 0; l < 3; l++) c.fillRect(ox + 32, oy + 76 + l * 16, 120 + rng() * 150, 7);
      c.strokeStyle = "#555";
      c.lineWidth = 2;
      c.strokeRect(ox + CW - 150, oy + 34, 110, 82);
      c.fillStyle = "#1A1A1A";
      c.font = `600 44px Inter`;
      c.fillText(rnd(2), ox + CW - 132, oy + 92);
      // barcode
      let bx = ox + 34;
      const end = ox + CW - 34;
      while (bx < end) {
        const bw = 2 + Math.floor(rng() * 4) * 2;
        if (rng() < 0.55) c.fillRect(bx, oy + 140, Math.min(bw, end - bx), 62);
        bx += bw + 2;
      }
      c.fillStyle = "#333";
      c.font = `500 18px "JetBrains Mono"`;
      c.fillText(Array.from({ length: 18 }, () => Math.floor(rng() * 10)).join(""), ox + 120, oy + 226);
    } else {
      // Row of three outlined pictograms.
      const order = [[0, 1, 2], [1, 0, 2], [0, 2, 1]][cell - 5];
      const s = 156;
      c.fillStyle = "#151515";
      c.strokeStyle = "#151515";
      for (let k = 0; k < 3; k++) {
        const x = ox + 20 + k * (s + 16), y = oy + (CH - s) / 2;
        c.lineWidth = 9;
        c.strokeRect(x, y, s, s);
        const fn = [drawArrows, drawUmbrella, drawGlass][order[k]];
        fn(c, x, y, s);
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};
