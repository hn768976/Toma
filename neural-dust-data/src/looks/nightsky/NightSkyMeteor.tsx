import React, { useCallback } from "react";
import { Canvas2DLook, Draw2D } from "../../lib/canvas/useCanvas2D";
import { mulberry32, TAU } from "../../lib/random";
import { hexToRgb } from "../../lib/color";
import { NightSkyVersion } from "./versions";

export const NIGHTSKY_LOOP = 600;
const W = 3840;
const H = 2160;

// ---------------------------------------------------------------------------
// Stars: built once at module level from a fixed seed. Units: 4K pixels.
// ---------------------------------------------------------------------------
type Star = { x: number; y: number; r: number; a: number; tw: number; n: number; ph: number };
const STARS: Star[] = (() => {
  const rnd = mulberry32(4155286737);
  const out: Star[] = [];
  const push = (x: number, y: number) => {
    const u = rnd();
    // mostly tiny, a few brighter
    const r = 1.6 + Math.pow(u, 6) * 5.5 + rnd() * 1.0;
    const a = 0.25 + Math.pow(rnd(), 2.2) * 0.75;
    const tw = rnd() < 0.18 ? 0.35 + rnd() * 0.5 : 0;
    out.push({ x, y, r, a, tw, n: 2 + Math.floor(rnd() * 10), ph: rnd() * TAU });
  };
  for (let i = 0; i < 2100; i++) push(rnd() * W, rnd() * H);
  // faint, sparse band of denser stars running diagonally
  for (let i = 0; i < 450; i++) {
    const t = rnd();
    const off = (rnd() + rnd() + rnd() - 1.5) * 260;
    push(t * W * 1.1 - 0.05 * W + off * 0.45, H * 0.95 - t * H * 0.8 + off);
  }
  return out;
})();

type Meteor = { start: number; dur: number; x0: number; y0: number; x1: number; y1: number; len: number };
// fixed times, none crossing the loop point (600)
const METEORS: Meteor[] = [
  { start: 40, dur: 30, x0: 0.04 * W, y0: 0.06 * H, x1: 0.42 * W, y1: 0.26 * H, len: 0.24 * W },
  { start: 250, dur: 32, x0: 0.46 * W, y0: 0.1 * H, x1: 0.86 * W, y1: 0.42 * H, len: 0.22 * W },
  { start: 470, dur: 28, x0: 0.14 * W, y0: 0.42 * H, x1: 0.5 * W, y1: 0.64 * H, len: 0.2 * W },
];

type Spark = { m: number; t0: number; s: number; vx: number; vy: number; life: number; r: number };
const SPARKS: Spark[] = (() => {
  const rnd = mulberry32(77);
  const out: Spark[] = [];
  METEORS.forEach((m, mi) => {
    for (let i = 0; i < 26; i++) {
      out.push({ m: mi, t0: rnd() * m.dur * 0.85, s: 0, vx: (rnd() - 0.5) * 3, vy: 1 + rnd() * 3.5, life: 8 + rnd() * 14, r: 1.8 + rnd() * 2.2 });
    }
  });
  return out;
})();

// Background gradient (float, render-res), cached per size: a pure function of the size.
const bgCache = new Map<string, Float32Array>();
const skyGradient = (pw: number, ph: number, v: NightSkyVersion) => {
  const key = `${pw}x${ph}:${v.id}`;
  const hit = bgCache.get(key);
  if (hit) return hit;
  const L = hexToRgb(v.skyLight).map((c) => c * 255);
  const D = hexToRgb(v.skyDark).map((c) => c * 255);
  const buf = new Float32Array(pw * ph * 3);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const u = x / pw;
      const vv = y / ph;
      // light pool at upper-left, falling off to near-black at lower-right
      const d = Math.hypot(u * 1.0 + 0.02, (vv + 0.05) * 0.9);
      let t = Math.min(1, Math.max(0, (d - 0.02) / 1.05));
      t = t * t * (3 - 2 * t);
      t = Math.pow(t, 0.8);
      const i = (y * pw + x) * 3;
      buf[i] = L[0] + (D[0] - L[0]) * t;
      buf[i + 1] = L[1] + (D[1] - L[1]) * t;
      buf[i + 2] = L[2] + (D[2] - L[2]) * t;
    }
  }
  bgCache.set(key, buf);
  return buf;
};

// integer hash of (x, y, frame) -> [0,1)
const ihash = (x: number, y: number, f: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(f, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const spriteCache = new Map<string, HTMLCanvasElement>();
const starSprite = (rgb: string) => {
  const hit = spriteCache.get(rgb);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.18, `rgba(${rgb},0.9)`);
  gr.addColorStop(0.4, `rgba(${rgb},0.25)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(rgb, c);
  return c;
};

const rgbStr = (hex: string) => hexToRgb(hex).map((c) => Math.round(c * 255)).join(",");

export const NightSkyMeteor: React.FC<{ version: NightSkyVersion; durationOverride?: number }> = ({ version }) => {
  const draw = useCallback<Draw2D>(
    (ctx, frame, pw, ph, scale) => {
      const f = ((frame % NIGHTSKY_LOOP) + NIGHTSKY_LOOP) % NIGHTSKY_LOOP;
      // 1) sky gradient + 1.5% grain + ±1/255 dither, one pass
      const bg = skyGradient(pw, ph, version);
      const img = ctx.createImageData(pw, ph);
      const d = img.data;
      for (let y = 0, i = 0, j = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++, i += 4, j += 3) {
          const g = (ihash(x, y, f) - 0.5) * 0.015 * 255 * 1.6;
          const dt = ihash(x + 7919, y, f) + ihash(x, y + 104729, f) - 1;
          d[i] = bg[j] + g + dt;
          d[i + 1] = bg[j + 1] + g + dt;
          d[i + 2] = bg[j + 2] + g * 1.1 + dt;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      // 2) stars
      const spr = starSprite(rgbStr(version.star));
      for (const s of STARS) {
        let a = s.a;
        if (s.tw > 0) a *= 1 - s.tw * (0.5 + 0.5 * Math.sin((TAU * s.n * f) / NIGHTSKY_LOOP + s.ph));
        const r = Math.max(s.r, 1.2 / scale) * 2.4;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(spr, s.x - r, s.y - r, r * 2, r * 2);
      }

      // 3) meteors
      const head = rgbStr(version.meteor);
      const tail = rgbStr(version.meteorTail);
      METEORS.forEach((m, mi) => {
        const t = (f - m.start) / m.dur;
        if (t < 0 || t > 1.4) return;
        const dx = m.x1 - m.x0;
        const dy = m.y1 - m.y0;
        const dl = Math.hypot(dx, dy);
        const ux = dx / dl;
        const uy = dy / dl;
        const tt = Math.min(t, 1);
        const ease = 1 - Math.pow(1 - tt, 1.4);
        const hx = m.x0 + dx * ease;
        const hy = m.y0 + dy * ease;
        const env = Math.min(1, t / 0.12) * (t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.3));
        const len = m.len * Math.min(1, 0.35 + t * 1.3);
        if (env > 0) {
          const tx = hx - ux * len;
          const ty = hy - uy * len;
          const nx = -uy;
          const ny = ux;
          // tail: tapering wedge, layered for a soft glow
          for (const [wdt, al] of [
            [26, 0.07],
            [12, 0.18],
            [5, 0.55],
            [2.2, 0.9],
          ] as const) {
            const gr = ctx.createLinearGradient(hx, hy, tx, ty);
            gr.addColorStop(0, `rgba(${head},${al * env})`);
            gr.addColorStop(0.25, `rgba(${tail},${al * 0.6 * env})`);
            gr.addColorStop(1, `rgba(${tail},0)`);
            ctx.fillStyle = gr;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(hx + nx * wdt, hy + ny * wdt);
            ctx.lineTo(hx + ux * wdt * 0.6, hy + uy * wdt * 0.6);
            ctx.lineTo(hx - nx * wdt, hy - ny * wdt);
            ctx.lineTo(tx, ty);
            ctx.closePath();
            ctx.fill();
          }
          // head glow
          const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 60);
          hg.addColorStop(0, `rgba(${head},${0.95 * env})`);
          hg.addColorStop(0.12, `rgba(${head},${0.5 * env})`);
          hg.addColorStop(0.45, `rgba(${tail},${0.08 * env})`);
          hg.addColorStop(1, `rgba(${tail},0)`);
          ctx.fillStyle = hg;
          ctx.fillRect(hx - 60, hy - 60, 120, 120);
        }
        // sparks breaking off the trail
        for (const s of SPARKS) {
          if (s.m !== mi) continue;
          const age = f - m.start - s.t0;
          if (age < 0 || age > s.life) continue;
          const e0 = 1 - Math.pow(1 - Math.min(1, s.t0 / m.dur), 1.4);
          const sx = m.x0 + dx * e0 - ux * 20 + s.vx * age;
          const sy = m.y0 + dy * e0 - uy * 20 + s.vy * age + 0.06 * age * age;
          const a = (1 - age / s.life) * 0.8;
          ctx.globalAlpha = a;
          const r = s.r * 2.4;
          ctx.drawImage(spr, sx - r, sy - r, r * 2, r * 2);
        }
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
    [version],
  );
  return <Canvas2DLook draw={draw} />;
};
