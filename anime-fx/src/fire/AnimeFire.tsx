import React, { useMemo } from "react";
import { CanvasComp, DrawFn } from "../lib/CanvasComp";
import { hex, rgba } from "../lib/color";
import { ditherTile } from "../lib/dither";
import { LOOP_DRAWINGS, loopDrawing } from "../lib/loop";
import { clamp, fract } from "../lib/math";
import { makeNoise, timeCircle } from "../lib/noise";
import { hash01, Rand } from "../lib/rng";
import { FIRE_PALETTES, FirePalette } from "./palettes";

// Cel-shaded anime fire. The flame shapes are iso-contours of a scalar field:
//   F = height ramp + side ramp + domain-warped fbm noise + rising blobs - holes
// The noise rises with a two-phase flow map (period 50 drawings, so it
// closes 3 times per loop) and evolves on a time circle (period 150
// drawings). Bands are cut with hard, anti-aliased thresholds.

const CELL = 8; // design px per field sample
const RISE_T = 50; // drawings per flow-map phase
const RISE_L = 0.55; // rise per phase, in frame heights
const THRESH = [0.0, 0.42, 0.82, 1.45];
const BACK_T = [0.0, 0.32];

type Blob = { x: number; k: number; ph: number; r: number; str: number; drift: number };

const makeDraw = (id: string, pal: FirePalette): DrawFn => {
  const nz = makeNoise(id, "fire");
  const nzB = makeNoise(id, "fire-b");
  const r = new Rand(id, "blobs");
  const holes: Blob[] = [];
  for (let i = 0; i < 24; i++)
    holes.push({ x: r.range(-0.05, 1.05), k: r.pick([1, 2, 2, 3]), ph: r.next(), r: r.range(14, 48), str: r.range(0.5, 0.9), drift: r.range(-0.05, 0.25) });
  const lumps: Blob[] = [];
  for (let i = 0; i < 12; i++)
    lumps.push({ x: r.range(0, 1), k: r.pick([2, 3, 3]), ph: r.next(), r: r.range(40, 90), str: r.range(0.6, 1.0), drift: r.range(-0.05, 0.15) });
  const embers = Array.from({ length: 70 }, (_, i) => {
    const e = new Rand(id, "ember", i);
    return {
      x: e.range(0.22, 0.72),
      k: e.pick([1, 2, 2, 3]),
      ph: e.next(),
      m: e.pick([1, 2, 3]),
      wob: e.range(10, 70),
      size: e.range(6, 13) * (e.chance(0.15) ? 1.7 : 1),
      flake: e.chance(0.3),
      rot: e.range(0, Math.PI),
      wph: e.next(),
    };
  });

  const bands = pal.bands.map(hex);
  const glowC = hex(pal.glow);
  const cache = { key: "", img: null as ImageData | null };

  const field = (d: number, W: number, H: number) => {
    const GW = Math.ceil(W / CELL) + 2;
    const GH = Math.ceil(H / CELL) + 2;
    const F = new Float32Array(GW * GH);
    const D = new Float32Array(GW * GH);
    const B = new Float32Array(GW * GH);
    const p = d / LOOP_DRAWINGS;
    const [tx, ty] = timeCircle(p, 0.55);
    const ph = (d % RISE_T) / RISE_T;
    const offA = ph * RISE_L;
    const offB = fract(ph + 0.5) * RISE_L;
    const wA = 1 - Math.abs(1 - 2 * ph);
    const wB = 1 - wA;
    const norm = 1 / Math.sqrt(wA * wA + wB * wB);
    const aspect = W / H;

    const layer = (n4: typeof nz.n4, u: number, v: number) => {
      // domain warp -> curling, hooked tongues
      const wu = n4(u * 1.6, v * 1.3, tx, ty) * 0.3;
      const wv = n4(u * 1.6 + 5.2, v * 1.3 + 1.7, tx, ty) * 0.14;
      const uu = u + wu;
      const vv = v + wv;
      const a = n4(uu * 3.4, vv * 0.8, tx * 0.6, ty * 0.6);
      // ridged term -> creases and pointed, hooked tongue tips
      const ridge = 0.5 - Math.abs(n4(uu * 5.0 + 9.1, vv * 1.1, tx * 0.8, ty * 0.8));
      return (
        a * 0.7 +
        ridge * 1.1 +
        n4(uu * 9, vv * 2.4, tx, ty) * 0.32 +
        (0.35 - Math.abs(n4(uu * 14, vv * 5, tx * 1.4, ty * 1.4))) * 0.35
      );
    };

    for (let j = 0; j < GH; j++) {
      const y = (j - 1) * CELL;
      const v = y / H;
      const base = (v - 0.9) * 1.3;
      for (let i = 0; i < GW; i++) {
        const x = (i - 1) * CELL;
        const u = x / H;
        const sd = Math.min(u, aspect - u);
        // left column up the whole edge, a diagonal sweep up to the top right
        const side = 1.0 * Math.exp(-Math.max(0, u) / 0.2) + 0.3 * Math.exp(-Math.max(0, sd) / 0.1) * clamp(v * 1.5);
        // keep the middle open: a dark void from the top down to ~70%
        const cu = u / aspect - 0.42;
        const voidT = 0.55 * Math.exp(-(cu * cu) / 0.025) * clamp(1.15 - v);
        const dl = ((u - 0.5 * aspect) * 1 + (v - 1) * 0.5 * aspect) / Math.hypot(1, 0.5 * aspect);
        const sweep = 1.1 * Math.exp(-(dl * dl) / (0.15 * 0.15)) * clamp(1.3 - Math.abs(v - 0.55));
        // features move up and slightly right as the offset grows
        const sk = u + (1 - v) * 0.35; // tongues lean to the right as they rise
        const nA = wA > 0 ? layer(nz.n4, sk - offA * 0.45, v + offA) : 0;
        const nB = wB > 0 ? layer(nzB.n4, sk - offB * 0.45, v + offB) : 0;
        F[j * GW + i] = base + side + sweep - voidT + 0.9 * (wA * nA + wB * nB) * norm;
        // dim background flames: bigger, slower shapes behind everything
        const bA = wA > 0 ? nz.n3((u - offA * 0.2) * 1.7, (v + offA * 0.6) * 0.8, ty * 0.6) : 0;
        const bB = wB > 0 ? nzB.n3((u - offB * 0.2) * 1.7, (v + offB * 0.6) * 0.8, ty * 0.6) : 0;
        B[j * GW + i] = (v - 0.45) * 1.3 + 0.5 * side + 0.6 * sweep + 0.75 * (wA * bA + wB * bB) * norm;
        // inner-band detail: rides with the same flow so it rises with the flames
        const dA = wA > 0 ? nz.n3((u - offA * 0.35) * 5.5, (v + offA) * 2.4, tx * 0.7) : 0;
        const dB = wB > 0 ? nzB.n3((u - offB * 0.35) * 5.5, (v + offB) * 2.4, tx * 0.7) : 0;
        D[j * GW + i] = (wA * dA + wB * dB) * norm;
      }
    }
    // rising lumps (flame pieces breaking off) and round holes
    const stamp = (b: Blob, sign: number, yStart: number, yEnd: number, fadeTop: boolean) => {
      const t = fract(p * b.k + b.ph);
      const cy = H * (yStart - t * (yStart - yEnd));
      const cx = W * fract(b.x + b.drift * t);
      const rad = b.r * (fadeTop ? 1 - 0.45 * t : 1);
      const str = b.str * (fadeTop ? Math.sin(Math.PI * Math.min(1, t * 1.15)) : 1) * sign;
      const i0 = Math.max(0, Math.floor((cx - rad) / CELL) + 1);
      const i1 = Math.min(GW - 1, Math.ceil((cx + rad) / CELL) + 1);
      const j0 = Math.max(0, Math.floor((cy - rad) / CELL) + 1);
      const j1 = Math.min(GH - 1, Math.ceil((cy + rad) / CELL) + 1);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = ((i - 1) * CELL - cx) / rad;
          // tall, teardrop-ish (not round): taller below the centre
          const ry = (j - 1) * CELL > cy ? 2.4 : 1.4;
          const dy = ((j - 1) * CELL - cy) / (rad * ry);
          const q = 1 - (dx * dx + dy * dy);
          if (q > 0) F[j * GW + i] += str * q * q;
        }
      }
    };
    for (const h of holes) stamp(h, -1, 1.15, 0.25, false);
    for (const l of lumps) stamp(l, 1, 0.75, 0.05, true);
    return { F, D, B, GW, GH };
  };

  return (ctx, { frame, W, H, s, pw, ph }) => {
    const d = loopDrawing(frame);
    const key = `${d}:${pw}`;
    if (cache.key !== key) {
      const { F, D, B, GW } = field(d, W, H);
      const back = pal.back.map(hex);
      const img = new ImageData(pw, ph);
      const data = img.data;
      const tl = ditherTile();
      const inv = 1 / (CELL * s); // field cells per device px
      for (let y = 0; y < ph; y++) {
        const gy = (y + 0.5) * inv + 1;
        const j = Math.floor(gy);
        const fy = gy - j;
        const trow = (y & 255) << 8;
        let o = y * pw * 4;
        for (let x = 0; x < pw; x++, o += 4) {
          const gx = (x + 0.5) * inv + 1;
          const i = Math.floor(gx);
          const fx = gx - i;
          const k = j * GW + i;
          const f00 = F[k];
          const f10 = F[k + 1];
          const f01 = F[k + GW];
          const f11 = F[k + GW + 1];
          const top = f00 + (f10 - f00) * fx;
          const bot = f01 + (f11 - f01) * fx;
          const v = top + (bot - top) * fy;
          // field change per device pixel, for 1px anti-aliasing
          const gxv = ((f10 - f00) * (1 - fy) + (f11 - f01) * fy) * inv;
          const gyv = (bot - top) * inv;
          const g = Math.sqrt(gxv * gxv + gyv * gyv) + 1e-6;
          const d00 = D[k];
          const dt = d00 + (D[k + 1] - d00) * fx;
          const db = D[k + GW] + (D[k + GW + 1] - D[k + GW]) * fx;
          const dv = dt + (db - dt) * fy;
          const dgx = ((D[k + 1] - d00) * (1 - fy) + (D[k + GW + 1] - D[k + GW]) * fy) * inv;
          const dgy = (db - dt) * inv;
          const g2 = Math.sqrt((gxv + 0.3 * dgx) ** 2 + (gyv + 0.3 * dgy) ** 2) + 1e-6;
          let r = 0;
          let gg = 0;
          let b = 0;
          let glowing = false;
          // background flame layer (hard-edged, dim)
          const b00 = B[k];
          const bt = b00 + (B[k + 1] - b00) * fx;
          const bb = B[k + GW] + (B[k + GW + 1] - B[k + GW]) * fx;
          const bv = bt + (bb - bt) * fy;
          const bg = Math.abs(bb - bt) * inv + Math.abs((B[k + 1] - b00) * inv) + 1e-6;
          let backA = 0;
          for (let q = 0; q < 2; q++) {
            const a = clamp((bv - BACK_T[q]) / (bg * 14) + 0.5);
            if (a <= 0) break;
            backA = 1;
            r += (back[q][0] - r) * a;
            gg += (back[q][1] - gg) * a;
            b += (back[q][2] - b) * a;
          }
          if (v < THRESH[0] + g) {
            // haze around the flames, fading to exact black
            const gi = 0.26 * Math.exp((v - THRESH[0]) / 0.1);
            if (gi * 255 > 0.6) {
              const dz = tl[trow | (x & 255)];
              r += glowC[0] * gi * (1 - r / 255) + dz;
              gg += glowC[1] * gi * (1 - gg / 255) + dz;
              b += glowC[2] * gi * (1 - b / 255) + dz;
              glowing = true;
            }
          }
          for (let t = 0; t < 4; t++) {
            const vv = t < 2 ? v : Math.min(v, v + 0.3 * dv - (t === 3 ? 0.05 : 0));
            const a = clamp((vv - THRESH[t]) / (t < 2 ? g : g2) + 0.5);
            if (a <= 0) break;
            const c = bands[t];
            r += (c[0] - r) * a;
            gg += (c[1] - gg) * a;
            b += (c[2] - b) * a;
            glowing = false;
          }
          if (glowing || backA > 0 || r + gg + b > 0.4) {
            data[o] = Math.round(r);
            data[o + 1] = Math.round(gg);
            data[o + 2] = Math.round(b);
          }
          data[o + 3] = 255;
        }
      }
      cache.img = img;
      cache.key = key;
    }
    ctx.putImageData(cache.img!, 0, 0);

    // embers drifting up
    const p = d / LOOP_DRAWINGS;
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      const t = fract(p * e.k + e.ph);
      const y = H * (1.05 - t * 0.95);
      const x = W * e.x + e.wob * Math.sin(Math.PI * 2 * (p * e.m + e.wph)) + t * 160;
      const fade = clamp((y - 0.15 * H) / (0.35 * H)) * (0.55 + 0.45 * hash01(i, d, 12));
      if (fade <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.shadowColor = rgba(pal.ember, 0.9);
      ctx.shadowBlur = e.size * 0.8 * s;
      ctx.fillStyle = pal.ember;
      const rot = e.flake ? e.rot + t * 6 : 0.25;
      const ax = e.flake ? e.size * 2.6 : e.size;
      const ay = e.flake ? e.size * 0.6 : e.size * 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, ax, ay, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (hash01(i, 7) < 0.35) {
        ctx.fillStyle = pal.emberCore;
        ctx.beginPath();
        ctx.ellipse(x, y, ax * 0.55, ay * 0.55, rot, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };
};

export const AnimeFire: React.FC<{ variant: "red" | "blue" }> = ({ variant }) => {
  const id = `AnimeFire_${variant === "red" ? "Red" : "Blue"}`;
  const draw = useMemo(() => makeDraw(id, FIRE_PALETTES[variant]), [id, variant]);
  return <CanvasComp draw={draw} />;
};
