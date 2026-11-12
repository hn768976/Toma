import React, { useMemo } from "react";
import { CanvasComp, DrawFn } from "../lib/CanvasComp";
import { hex, mix, rgba } from "../lib/color";
import { renderGlowField } from "../lib/dither";
import { lifecycle, LOOP_DRAWINGS, loopDrawing } from "../lib/loop";
import type { Pt } from "../lib/math";
import { makeNoise, timeCircle } from "../lib/noise";
import { polyPath } from "../lib/path";
import { hash01, Rand } from "../lib/rng";
import { SHARD_PALETTES, ShardPalette } from "./palettes";

type Kind = "dark" | "mid" | "bright";
type ShapeType = "plate" | "splinter" | "tri" | "burst";

const PERIODS = [10, 15, 25, 30, 50];

// --- shape generators (local coords, centred on 0,0) ----------------------

const plate = (r: Rand, size: number): Pt[] => {
  const n = r.int(10, 17);
  const angs: number[] = [];
  for (let i = 0; i < n; i++) angs.push((i / n) * Math.PI * 2 + r.range(-0.3, 0.3));
  angs.sort((a, b) => a - b);
  const pts: Pt[] = [];
  const ax = r.range(0.6, 1.4);
  for (let i = 0; i < n; i++) {
    const rad = size * r.range(0.35, 1);
    pts.push([Math.cos(angs[i]) * rad * ax, Math.sin(angs[i]) * rad]);
    // jagged inward notch between corners
    if (r.chance(0.7)) {
      const a = (angs[i] + angs[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0)) / 2;
      const rr = size * r.range(0.12, 0.5);
      pts.push([Math.cos(a) * rr * ax, Math.sin(a) * rr]);
    }
    // torn edge: a thin spiky tendril
    if (r.chance(0.18)) {
      const a = angs[i] + r.range(0.05, 0.25);
      const L = size * r.range(1.2, 1.9);
      const w = r.range(0.03, 0.06);
      pts.push([Math.cos(a - w) * size * 0.7 * ax, Math.sin(a - w) * size * 0.7]);
      pts.push([Math.cos(a) * L * ax, Math.sin(a) * L]);
      pts.push([Math.cos(a + w) * size * 0.7 * ax, Math.sin(a + w) * size * 0.7]);
    }
  }
  return pts;
};

const splinter = (r: Rand, size: number): Pt[] => {
  const L = size * r.range(1.4, 2.6);
  const w = size * r.range(0.12, 0.3);
  return [
    [L / 2, r.range(-0.1, 0.1) * w],
    [r.range(-0.1, 0.2) * L, -w * 0.5],
    [-L / 2, -w * r.range(0.2, 0.6)],
    [-L * r.range(0.25, 0.4), w * 0.1],
    [-L / 2 + r.range(0, 0.2) * L, w * 0.6],
    [r.range(0, 0.25) * L, w * 0.35],
  ];
};

const tri = (r: Rand, size: number): Pt[] => {
  const a0 = r.range(0, Math.PI * 2);
  return [0, 1, 2].map((i) => {
    const a = a0 + (i / 3) * Math.PI * 2 + r.range(-0.5, 0.5);
    const rad = size * (i === 0 ? r.range(1, 1.8) : r.range(0.3, 0.7));
    return [Math.cos(a) * rad, Math.sin(a) * rad] as Pt;
  });
};

const burst = (r: Rand, size: number): Pt[] => {
  const k = r.int(3, 6);
  const pts: Pt[] = [];
  const a0 = r.range(0, Math.PI * 2);
  const r0 = size * 0.18;
  for (let i = 0; i < k; i++) {
    const a = a0 + (i / k) * Math.PI * 2 + r.range(-0.4, 0.4);
    const L = size * r.range(0.7, 1.7);
    const dl = r.range(0.08, 0.22);
    pts.push([Math.cos(a - dl) * r0, Math.sin(a - dl) * r0]);
    // a kink half way out, like a lightning-split splinter
    const ka = a + r.range(-0.25, 0.25);
    pts.push([Math.cos(ka - 0.05) * L * 0.55, Math.sin(ka - 0.05) * L * 0.55]);
    pts.push([Math.cos(a) * L, Math.sin(a) * L]);
    pts.push([Math.cos(ka + 0.07) * L * 0.5, Math.sin(ka + 0.07) * L * 0.5]);
    pts.push([Math.cos(a + dl) * r0, Math.sin(a + dl) * r0]);
  }
  return pts;
};

// --- lightning crack -------------------------------------------------------

const crack = (r: Rand, x: number, y: number, ang: number, len: number, depth = 0): Pt[][] => {
  const pts: Pt[] = [[x, y]];
  const out: Pt[][] = [];
  let L = 0;
  while (L < len) {
    const st = r.range(len * 0.04, len * 0.13);
    const a = ang + r.range(-0.95, 0.95);
    x += Math.cos(a) * st;
    y += Math.sin(a) * st;
    pts.push([x, y]);
    L += st;
    if (depth < 1 && r.chance(0.12)) {
      out.push(...crack(r, x, y, ang + r.sign() * r.range(0.5, 1.2), len * r.range(0.2, 0.45), depth + 1));
    }
  }
  out.unshift(pts);
  return out;
};

// Jagged, tapered lightning: per-segment strokes with mitred joins.
const zigzag = (ctx: CanvasRenderingContext2D, pts: Pt[], w: number) => {
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    ctx.lineWidth = Math.max(1.5, w * (t < 0.15 ? 0.4 + 4 * t : 1 - 0.85 * t));
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    if (i + 2 <= n) ctx.lineTo(pts[i + 2][0], pts[i + 2][1]);
    ctx.stroke();
  }
};

// --- element tables (fixed per composition) --------------------------------

type Slot = { kind: Kind; period: number; offset: number; i: number };

const buildSlots = (id: string) => {
  const r = new Rand(id, "slots");
  const slots: Slot[] = [];
  const add = (kind: Kind, n: number) => {
    for (let i = 0; i < n; i++) {
      const period = r.pick(PERIODS);
      slots.push({ kind, period, offset: r.int(0, period), i: slots.length });
    }
  };
  add("mid", 15);
  add("dark", 40);
  add("bright", 22);
  return slots;
};

type Placed = {
  pts: Pt[];
  x: number;
  y: number;
  rot: number;
  vx: number;
  vy: number;
  size: number;
  fill: string;
  hi: string;
  band: { a: number; off: number; w: number };
  glow: string | null;
  type: ShapeType;
};

const placeShard = (id: string, slot: Slot, cycle: number, W: number, H: number, pal: ShardPalette): Placed => {
  const r = new Rand(id, "shard", slot.i, cycle);
  let type: ShapeType;
  let size: number;
  let x = r.range(-0.05, 1.05) * W;
  let y = r.range(-0.05, 1.05) * H;
  let fill: string;
  let hi: string;
  let glow: string | null = null;
  if (slot.kind === "dark") {
    type = r.chance(0.7) ? "plate" : r.chance(0.5) ? "splinter" : "tri";
    size = r.range(160, 520);
    // darks hug the edges more than the glowing centre-left
    if (r.chance(0.55)) {
      const e = r.int(0, 4);
      if (e === 0) y = r.range(-0.05, 0.22) * H;
      if (e === 1) y = r.range(0.78, 1.05) * H;
      if (e === 2) x = r.range(0.7, 1.05) * W;
      if (e === 3) x = r.range(-0.05, 0.15) * W;
    }
    fill = r.pick(pal.darks);
    hi = mix(fill, pal.darkHi, r.range(0.3, 0.6));
  } else if (slot.kind === "mid") {
    type = "plate";
    size = r.range(300, 620);
    x = (0.12 + r.range(0, 0.8)) * W;
    y = (0.1 + r.range(0, 0.8)) * H;
    fill = r.pick(pal.mids);
    hi = mix(fill, pal.glow[0], 0.15);
  } else {
    type = r.chance(0.6) ? "splinter" : r.chance(0.25) ? "burst" : "tri";
    size = r.range(90, 320) * (type === "burst" ? 1.35 : 1);
    fill = r.pick(pal.brights);
    hi = mix(fill, "#FFFFFF", 0.18);
    glow = fill;
  }
  const pts =
    type === "plate"
      ? plate(r, size)
      : type === "splinter"
        ? splinter(r, size)
        : type === "burst"
          ? burst(r, size)
          : tri(r, size);
  return {
    pts,
    x,
    y,
    rot: r.range(0, Math.PI * 2),
    vx: r.range(3, 8), // slow drift right, design px per drawing
    vy: r.range(-1.5, 1.5),
    size,
    fill,
    hi,
    band: { a: r.range(0, Math.PI), off: r.range(-0.35, 0.2), w: r.range(0.18, 0.4) },
    glow,
    type,
  };
};

// --- drawing ---------------------------------------------------------------

const flareAt = (id: string, d: number) => {
  const k = Math.floor(d / 15); // ~ one flare per second (15 drawings)
  const a = 0.35 + 0.45 * hash01(k, 77, id.length);
  const t = d % 15;
  const env = [1, 0.62, 0.32, 0.12, 0.04][t] ?? 0;
  return a * env;
};

const makeDraw = (id: string, pal: ShardPalette): DrawFn => {
  const slots = buildSlots(id);
  const noise = makeNoise(id, "glow");
  const glowCache = { key: "", img: null as ImageData | null };
  const bg = hex(pal.bg);

  return (ctx, { frame, W, H, s, pw, ph }) => {
    const d = loopDrawing(frame);
    const p = d / LOOP_DRAWINGS;
    const [tx, ty] = timeCircle(p, 1.2);
    const flare = flareAt(id, d);
    const flick = 0.85 + 0.15 * hash01(d, 3, 9);

    // 1. background + soft glow (dithered)
    const key = `${d}:${pw}`;
    if (glowCache.key !== key) {
      const wob = (k: number) => noise.n4(k * 7.1, 0.3, tx, ty);
      const [c0, , c2] = pal.glow.map(hex);
      const g = (1 + flare * 0.9) * flick;
      glowCache.img = renderGlowField(pw, ph, s, bg, [
        { x: W * (0.49 + 0.02 * wob(1)), y: H * (0.41 + 0.03 * wob(2)), rx: W * 0.2, ry: H * 0.3, color: c2, a: 0.4 * g },
        { x: W * (0.48 + 0.015 * wob(3)), y: H * (0.4 + 0.02 * wob(4)), rx: W * 0.11, ry: H * 0.19, color: c0, a: 0.6 * g },
      ]);
      glowCache.key = key;
    }
    ctx.putImageData(glowCache.img!, 0, 0);

    const drawShard = (sl: Slot, glowPass: boolean) => {
      const lc = lifecycle(d, sl.period, sl.offset);
      const sh = placeShard(id, sl, lc.cycle, W, H, pal);
      const jr = new Rand(id, "jit", sl.i, d);
      const a = lc.age;
      const pop = a === 0 ? 0.55 : a === lc.period - 1 ? 0.75 : 1;
      const flip = sl.kind === "bright" && Math.floor((a + sl.i) / 3) % 2 === 1 ? -1 : 1;
      const x = sh.x + sh.vx * a + jr.range(-4, 4);
      const y = sh.y + sh.vy * a + jr.range(-4, 4);
      const rot = sh.rot + jr.range(-0.05, 0.05) + (sl.kind === "bright" ? a * 0.03 : a * 0.004);
      const pts = sh.pts.map(
        ([px, py]) => [px + jr.range(-0.035, 0.035) * sh.size, py + jr.range(-0.035, 0.035) * sh.size] as Pt,
      );
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(pop * flip, pop);
      const path = new Path2D();
      polyPath(path, pts);
      if (sl.kind === "bright") {
        const pulse = 0.72 + 0.28 * hash01(sl.i, d, 5) + flare * 0.4;
        if (glowPass) {
          ctx.shadowColor = rgba(sh.glow!, Math.min(1, 0.9 * pulse));
          ctx.shadowBlur = (30 + sh.size * 0.25) * s;
          ctx.fillStyle = sh.fill;
          ctx.globalAlpha = Math.min(1, 0.85 * pulse);
          ctx.fill(path);
          ctx.shadowBlur = 0;
        } else {
          ctx.globalAlpha = Math.min(1, pulse);
          ctx.fillStyle = sh.fill;
          ctx.fill(path);
          ctx.clip(path);
          ctx.rotate(sh.band.a);
          ctx.fillStyle = sh.hi;
          ctx.fillRect(-sh.size * 3, sh.band.off * sh.size, sh.size * 6, sh.band.w * sh.size);
        }
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = sh.fill;
        ctx.fill(path);
        ctx.clip(path);
        ctx.rotate(sh.band.a);
        ctx.fillStyle = sh.hi;
        ctx.fillRect(-sh.size * 3, sh.band.off * sh.size, sh.size * 6, sh.band.w * sh.size);
      }
      ctx.restore();
    };

    // 2. mid-tone and dark cel plates
    for (const sl of slots) if (sl.kind === "mid") drawShard(sl, false);

    // thin dark hairline cracks across the glow
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    for (let i = 0; i < 10; i++) {
      const lc = lifecycle(d, 25, (i * 7) % 25);
      const r = new Rand(id, "hair", i, lc.cycle, Math.floor(lc.age / 4));
      const r0 = new Rand(id, "hair0", i, lc.cycle);
      const lines = crack(r, r0.range(0.05, 0.9) * W + lc.age * 3, r0.range(0.1, 0.9) * H, r0.range(0, Math.PI * 2), r0.range(250, 700));
      ctx.strokeStyle = pal.hairline;
      lines.forEach((l, k) => {
        ctx.lineWidth = k === 0 ? r0.range(6, 13) : 4;
        ctx.beginPath();
        polyPath(ctx, l, false);
        ctx.stroke();
      });
    }

    for (const sl of slots) if (sl.kind === "dark") drawShard(sl, false);

    // 3. bright shards: glow pass then crisp cel pass
    for (const sl of slots) if (sl.kind === "bright") drawShard(sl, true);
    for (const sl of slots) if (sl.kind === "bright") drawShard(sl, false);

    // 4. glowing lightning cracks (coloured glow + bright core)
    for (let i = 0; i < 14; i++) {
      const per = [10, 15, 25][i % 3];
      const lc = lifecycle(d, per, (i * 3) % per);
      const r0 = new Rand(id, "crack0", i, lc.cycle);
      // re-route every 3 drawings, flicker every drawing
      const r = new Rand(id, "crack", i, lc.cycle, Math.floor(lc.age / 3));
      let cx0 = r0.range(-0.05, 0.95);
      const cy0 = r0.range(0.02, 0.98);
      if (Math.abs(cx0 - 0.45) < 0.15 && Math.abs(cy0 - 0.42) < 0.2) cx0 += cx0 < 0.45 ? -0.2 : 0.2;
      const col = cx0 > 0.55 && r0.chance(0.7) ? pal.brights[2] : cy0 > 0.5 && r0.chance(0.6) ? pal.brights[4] : r0.pick(pal.brights);
      const vis = hash01(i, d, 41);
      if (vis < 0.12) continue;
      const lines = crack(
        r,
        cx0 * W + lc.age * 5,
        cy0 * H,
        r0.range(-0.6, 0.6) + (r0.chance(0.5) ? 0 : Math.PI),
        r0.range(320, 1100),
      );
      const bright = Math.min(1, 0.6 + 0.4 * vis + flare);
      ctx.save();
      ctx.globalAlpha = bright;
      // coloured glow pass (tight) + filled jagged body + bright core
      ctx.shadowColor = col;
      ctx.shadowBlur = 8 * s;
      ctx.strokeStyle = col;
      const wMain = r0.range(22, 48);
      lines.forEach((l, k) => zigzag(ctx, l, k === 0 ? wMain : wMain * 0.5));
      ctx.shadowBlur = 0;
      ctx.strokeStyle = mix(col, pal.core, 0.7);
      lines.forEach((l, k) => zigzag(ctx, l, k === 0 ? wMain * 0.3 : wMain * 0.16));
      ctx.restore();
    }

    // 4b. the big jagged bolt (re-routes every 3 drawings)
    {
      const lc = lifecycle(d, 30, 4);
      const r0 = new Rand(id, "bolt0", lc.cycle);
      const r = new Rand(id, "bolt", lc.cycle, Math.floor(lc.age / 3));
      const corners: [number, number, number][] = [[0.04, 0.06, 0.65], [0.06, 0.1, 0.55], [0.92, 0.12, 2.4], [0.05, 0.08, 0.75], [0.1, 0.85, -0.7]];
      const c = corners[lc.cycle % 5];
      const lines = crack(r, c[0] * W + lc.age * 4, c[1] * H, c[2] + r0.range(-0.2, 0.2), r0.range(900, 1300));
      const w = r0.range(70, 110);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.85 + flare);
      ctx.shadowColor = pal.bolt;
      ctx.shadowBlur = 22 * s;
      ctx.strokeStyle = pal.bolt;
      lines.forEach((l, k) => zigzag(ctx, l, k === 0 ? w : w * 0.5));
      ctx.shadowBlur = 0;
      ctx.strokeStyle = mix(pal.bolt, "#FFFFFF", 0.45);
      lines.forEach((l, k) => zigzag(ctx, l, k === 0 ? w * 0.3 : w * 0.15));
      ctx.restore();
    }

    // 5. specks
    for (let i = 0; i < 60; i++) {
      const lc = lifecycle(d, 10, i % 10);
      const r = new Rand(id, "speck", i, lc.cycle);
      const x = r.range(0, W) + lc.age * 4;
      const y = r.range(0, H);
      const rad = r.range(6, 15) * (r.chance(0.12) ? 1.6 : 1);
      ctx.fillStyle = r.chance(0.15) ? pal.hairline : r.chance(0.6) ? r.pick([pal.brights[0], pal.brights[4], pal.glow[0]]) : r.pick(pal.brights);
      ctx.globalAlpha = 0.6 + 0.4 * hash01(i, d, 8);
      const k = r.int(4, 7);
      const a0 = r.range(0, 6.28);
      ctx.beginPath();
      for (let q = 0; q < k; q++) {
        const a = a0 + (q / k) * Math.PI * 2;
        const rr = rad * r.range(0.4, 1.3);
        if (q === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
};

export const AnimeShards: React.FC<{ variant: "neon" | "ice" }> = ({ variant }) => {
  const id = `AnimeShards_${variant === "neon" ? "Neon" : "Ice"}`;
  const draw = useMemo(() => makeDraw(id, SHARD_PALETTES[variant]), [id, variant]);
  return <CanvasComp draw={draw} />;
};
