// The pattern the key light shines through: soft round spots in gently
// curved rows (a perforated / woven screen), broken up by the soft shadows
// of a lattice and foliage. Projected by the key SpotLight (SpotLight.map),
// so it falls on the paper AND the cubes and bends over their edges.
// Values are linear light transmission (0 = blocked, 1 = open).

import { fbm2, makeNoise2D, seeded } from "../lib/prng";

const S = 2048;
export const SPOT_SPACING_PX = 25;
let cached: HTMLCanvasElement | null = null;

export const lightPatternCanvas = (): HTMLCanvasElement => {
  if (cached) return cached;
  const rng = seeded("light-pattern", 3);
  const n1 = makeNoise2D(rng);
  const n2 = makeNoise2D(rng);

  // Low-resolution occlusion mask: crossing curved lattice bars + foliage.
  const M = 512;
  const mask = new Float32Array(M * M);
  const bar = (s: number, w: number) => {
    const f = Math.abs(s - Math.round(s));
    return 1 - Math.min(Math.max((f - w) / 0.12, 0), 1);
  };
  const open0 = (u: number, v: number) => {
    const r = Math.hypot(u - 0.5, (v - 0.53) * 1.25);
    return 1 - Math.min(Math.max((r - 0.07) / 0.08, 0), 1);
  };
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
      const u = x / M;
      const v = y / M;
      const s1 = (u * 0.8 + v * 0.55) * 4.2 + 0.35 * Math.sin(v * 5.0 + u * 2.0);
      const s2 = (u * 0.75 - v * 0.6) * 3.4 + 0.3 * Math.sin(u * 4.0 - v * 3.0);
      const lattice = 1 - 0.7 * (1 - 0.6 * open0(u, v)) * Math.max(bar(s1, 0.17), 0.9 * bar(s2, 0.12));
      const leaf = fbm2(n1, u * 3.6, v * 3.6, 4);
      const t = Math.min(Math.max((leaf - 0.36) / 0.24, 0), 1);
      // The cubes land near the centre of the beam: keep an opening in the
      // foliage there so they sit in dappled sun and cast clear shadows.
      const open = open0(u, v);
      const tt = Math.max(t * t * (3 - 2 * t), open);
      const foliage = 0.22 + 0.78 * tt;
      mask[y * M + x] = lattice * foliage * (0.85 + 0.3 * (n2(u * 9, v * 9) - 0.5));
    }
  }
  // Spots: additive soft discs on black.
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = "lighter";
  const sp = SPOT_SPACING_PX;
  const rows = Math.ceil(S / sp) + 6;
  const cols = Math.ceil(S / sp) + 6;
  for (let j = -3; j < rows; j++) {
    for (let i = -3; i < cols; i++) {
      const bx = i * sp + (j % 2 ? sp / 2 : 0);
      // Rows bow gently, like a slightly curved screen.
      const y = j * sp + 0.00011 * (bx - S / 2) * (bx - S / 2) + 9 * Math.sin(bx / 230 + j * 0.11);
      const r = sp * 0.5;
      const g = ctx.createRadialGradient(bx, y, 0, bx, y, r);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(bx - r, y - r, 2 * r, 2 * r);
    }
  }
  ctx.filter = "blur(1.6px)";
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(c, 0, 0);
  ctx.filter = "none";

  // Combine: the screen passes some diffuse light between the spots
  // (FLOOR), and the lattice/foliage shade dims spots and gaps alike.
  const FLOOR = 0.2;
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Bilinear sample of the low-res mask.
      const mx = Math.min(Math.max((x / S) * M - 0.5, 0), M - 1.001);
      const my = Math.min(Math.max((y / S) * M - 0.5, 0), M - 1.001);
      const x0 = Math.floor(mx);
      const y0 = Math.floor(my);
      const fx = mx - x0;
      const fy = my - y0;
      const m =
        (mask[y0 * M + x0] * (1 - fx) + mask[y0 * M + x0 + 1] * fx) * (1 - fy) +
        (mask[(y0 + 1) * M + x0] * (1 - fx) + mask[(y0 + 1) * M + x0 + 1] * fx) * fy;
      const i = (y * S + x) * 4;
      const spot = d[i] / 255;
      const v = Math.min(m, 1) * (FLOOR + (1 - FLOOR) * spot);
      d[i] = d[i + 1] = d[i + 2] = Math.round(v * 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cached = c;
  return c;
};
