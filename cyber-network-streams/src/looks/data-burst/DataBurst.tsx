import React, { useMemo } from "react";
import { Container, Particle, ParticleContainer, Sprite, Texture } from "pixi.js";
import { PixiScene, PixiStage } from "../../lib/pixi/PixiStage";
import { LineBatch } from "../../lib/pixi/LineBatch";
import { GlowBatch } from "../../lib/pixi/GlowBatch";
import { Projector } from "../../lib/pixi/projector";
import { gauss, hash2, mulberry32, range } from "../../lib/random";
import { DataBurstVersion } from "../../versions";
import { buildBurstAtlas } from "./atlas";

// Look 4 — Data Burst (15 s, not a loop). One continuous camera move:
// sphere of dashes → burst → network with icons → grid tunnel → warp + chip.
// Every position is a closed-form function of the frame and module-level
// seeded data; nothing is stepped.

export const DB_DURATION = 450;
const R = 10;
const FOV = 55;

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// --- camera z: monotone cubic (Fritsch–Carlson) through fixed keys
const KEYS: [number, number][] = [
  [0, 21],
  [50, 19],
  [110, -4],
  [180, -120],
  [270, -300],
  [360, -540],
  [450, -760],
];
const camZ = (() => {
  const n = KEYS.length;
  const xs = KEYS.map((k) => k[0]),
    ys = KEYS.map((k) => k[1]);
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / (2 / d[i - 1] + 1 / d[i] + 1 / d[i - 1] + 2 / d[i]) ;
  return (f: number) => {
    if (f <= xs[0]) return ys[0] + m[0] * (f - xs[0]);
    if (f >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (f - xs[n - 1]);
    let i = 0;
    while (f > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (f - xs[i]) / h;
    const t2 = t * t,
      t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
})();

const camAt = (f: number) => {
  const z = camZ(f);
  const net = sstep(100, 160, f) * (1 - sstep(240, 290, f));
  const x = Math.sin(f * 0.021) * 2.2 * net;
  const y = Math.sin(f * 0.016 + 1) * 1.4 * net;
  const yaw = Math.sin(f * 0.013 + 0.4) * 0.12 * net;
  const pitch = Math.sin(f * 0.011 + 2) * 0.07 * net;
  const roll = Math.sin(f * 0.009) * 0.1 * net;
  return { x, y, z, yaw, pitch, roll };
};

// --- seeded data
type Dash = { ux: number; uy: number; uz: number; r0: number; col: number; tb: number; v: number; kind: number; icon: number };
type Pt = { x: number; y: number; z: number; col: number; size: number; kind: number; icon: number; ph: number };

const build = (v: DataBurstVersion) => {
  const r = mulberry32(0xd47ab);
  const hexToBgr = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff);
  };
  const C = { teal: hexToBgr(v.teal), white: hexToBgr(v.white), pink: hexToBgr(v.pink), orange: hexToBgr(v.orange), blue: hexToBgr(v.blue), green: hexToBgr(v.green) };
  const dashes: Dash[] = [];
  for (let i = 0; i < 30000; i++) {
    const z = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    const roll = r();
    const col = roll < 0.48 ? C.teal : roll < 0.63 ? C.blue : roll < 0.73 ? C.white : roll < 0.85 ? C.pink : roll < 0.93 ? C.orange : C.green;
    // front of the sphere (towards camera, +z) bursts first
    dashes.push({ ux: s * Math.cos(a), uy: s * Math.sin(a), uz: z, r0: R * (1 + gauss(r) * 0.025), col, tb: 52 + (1 - z) * 14 + r() * 16, v: range(r, 0.5, 2.2), kind: r() < 0.3 ? 1 : 0, icon: Math.floor(r() * 9) });
  }
  const pts: Pt[] = [];
  const box = (n: number, kind: number, cols: number[], size: [number, number]) => {
    for (let i = 0; i < n; i++) {
      let x = 0,
        y = 0;
      do {
        x = gauss(r) * 16;
        y = gauss(r) * 10;
      } while (Math.abs(x) < 1.2 && Math.abs(y) < 1.0);
      pts.push({ x, y, z: -10 - r() * (kind === 2 ? 190 : 250), col: cols[Math.floor(r() * cols.length)], size: range(r, size[0], size[1]), kind, icon: Math.floor(r() * 9), ph: r() });
    }
  };
  box(9000, 0, [C.teal, C.teal, C.white, C.teal, C.pink, C.blue, C.blue], [0.05, 0.13]); // data squares
  box(3500, 1, [C.white, C.teal, C.white], [0.05, 0.12]); // network nodes (points)
  box(300, 2, [C.pink, C.teal, C.white, C.pink, C.teal, C.green, C.blue], [0.6, 1.9]); // icons
  // links between nearby nodes (k nearest within reach), computed once
  const nodes = pts.map((p, i) => [p, i] as const).filter(([p]) => p.kind === 1 || p.kind === 2);
  const cell = 7;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  nodes.forEach(([p], j) => {
    const k = key(p.x, p.y, p.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(j);
  });
  const links: [number, number][] = [];
  nodes.forEach(([p], j) => {
    const cand: [number, number][] = [];
    const gx = Math.floor(p.x / cell),
      gy = Math.floor(p.y / cell),
      gz = Math.floor(p.z / cell);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c2 = -1; c2 <= 1; c2++) {
          const arr = grid.get(`${gx + a},${gy + b},${gz + c2}`);
          if (!arr) continue;
          for (const o of arr) {
            if (o <= j) continue;
            const q = nodes[o][0];
            const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
            if (d < cell) cand.push([d, o]);
          }
        }
    cand.sort((a2, b2) => a2[0] - b2[0]);
    const kmax = p.kind === 2 ? 3 : 2;
    for (let k = 0; k < Math.min(kmax, cand.length); k++) links.push([nodes[j][1], nodes[cand[k][1]][1]]);
  });
  // long straight rays roughly along the flight axis (they converge on the vanishing point)
  const rays: { x: number; y: number; z: number; len: number; dx: number; dy: number; col: number; a: number; dash: number }[] = [];
  const warm = hexToBgr("#F2DFC0");
  for (let i = 0; i < 420; i++) {
    const dash = i >= 90 ? 1 : 0;
    const ang = r() * Math.PI * 2;
    const rad = dash ? 1.5 + Math.pow(r(), 0.8) * 20 : 3 + Math.pow(r(), 0.7) * 30;
    rays.push({
      x: Math.cos(ang) * rad,
      y: Math.sin(ang) * rad * 0.7,
      z: -15 - r() * 260,
      len: dash ? range(r, 1.2, 3.5) : range(r, 30, 110),
      dx: dash ? 0 : range(r, -0.45, 0.45),
      dy: dash ? 0 : range(r, -0.35, 0.35),
      col: dash ? C.white : [warm, warm, C.teal, C.blue][Math.floor(r() * 4)],
      a: dash ? range(r, 0.15, 0.4) : range(r, 0.1, 0.28),
      dash,
    });
  }
  const dust: { x: number; y: number; z: number; col: number }[] = [];
  for (let i = 0; i < 12000; i++) dust.push({ x: gauss(r) * 9, y: gauss(r) * 6, z: -20 - r() * 260, col: [C.blue, C.blue, C.teal, C.blue][Math.floor(r() * 4)] });
  // tunnel wall squares
  const tun: { x: number; y: number; z: number; ph: number; col: number }[] = [];
  const HW = 12,
    HH = 7;
  for (let i = 0; i < 1600; i++) {
    const side = Math.floor(r() * 4);
    const u = Math.round(range(r, -1, 1) * (side < 2 ? HW / 2 : HH / 2)) * 2;
    const z = -340 - Math.floor(r() * 150) * 6;
    const x = side === 0 || side === 1 ? u : side === 2 ? -HW : HW;
    const y = side === 0 ? -HH : side === 1 ? HH : u;
    tun.push({ x, y, z, ph: r(), col: r() < 0.8 ? C.teal : C.white });
  }
  // warp streaks (camera-relative cylinder)
  const warp: { a: number; rad: number; z0: number; col: number; w: number; dash: number }[] = [];
  const sky = hexToBgr("#2AB0E0"), royal = hexToBgr("#1565C8");
  for (let i = 0; i < 2200; i++) { const dash = i >= 1850; const k = i % 18; warp.push({ a: dash ? (k / 18) * Math.PI * 2 + range(r, -0.03, 0.03) : r() * Math.PI * 2, rad: dash ? 2 + (Math.floor(i / 18) % 4) * 3.5 : 0.8 + Math.pow(r(), 0.75) * 22, z0: dash ? ((Math.floor(i / 72) * 37) % 420) : r() * 420, col: dash ? C.white : r() < 0.5 ? sky : r() < 0.7 ? royal : C.teal, w: dash ? range(r, 0.1, 0.18) : range(r, 0.02, 0.06), dash: dash ? 1 : 0 }); }
  return { dashes, pts, links, tun, warp, rays, dust, C, HW, HH };
};

const bgrToRgb01 = (bgr: number): [number, number, number] => [(bgr & 0xff) / 255, ((bgr >> 8) & 0xff) / 255, ((bgr >> 16) & 0xff) / 255];

const buildScene = (v: DataBurstVersion): PixiScene => {
  const D = build(v);
  const A = buildBurstAtlas();
  const world = new Container();
  const lines = new LineBatch(16000);
  const glows = new GlowBatch(64);
  world.addChild(glows.mesh);
  world.addChild(lines.mesh);
  const pc = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true } });
  pc.blendMode = "add";
  world.addChild(pc);
  const chipPlate = new Sprite(Texture.WHITE);
  chipPlate.anchor.set(0.5);
  chipPlate.tint = 0x050d22;
  chipPlate.alpha = 0;
  world.addChild(chipPlate);
  const chipLayer = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, color: true } });
  chipLayer.blendMode = "add";
  world.addChild(chipLayer);
  const chipP = [0, 1].map(() => {
    const p = new Particle({ texture: A.chip, anchorX: 0.5, anchorY: 0.5 });
    chipLayer.addParticle(p);
    return p;
  });
  const pool: Particle[] = [];
  const total = D.dashes.length + D.pts.length + D.tun.length + D.dust.length + 40;
  for (let i = 0; i < total; i++) {
    const p = new Particle({ texture: A.discs[0], anchorX: 0.5, anchorY: 0.5 });
    pool.push(p);
    pc.addParticle(p);
  }
  const cam = new Projector();
  let used = 0;
  const put = (tex: Texture, x: number, y: number, sx: number, sy: number, rot: number, bgr: number, alpha: number) => {
    if (alpha <= 0.003 || used >= pool.length) return;
    const p = pool[used++];
    p.texture = tex;
    p.x = x;
    p.y = y;
    p.scaleX = sx;
    p.scaleY = sy;
    p.rotation = rot;
    p.color = (bgr & 0xffffff) + (Math.min(255, Math.round(alpha * 255)) << 24);
  };
  // disc of `size` px (diameter) with defocus `coc` px
  const disc = (x: number, y: number, core: number, coc: number, px: number, bgr: number, alpha: number) => {
    const size = Math.max(core, 1.6 * px) + coc;
    const idx = Math.min(7, Math.floor(Math.log2(1 + coc / (2.5 * px))));
    const tex = A.discs[idx];
    const k = idx === 0 ? 2.6 : 1.18; // texture padding: point glow / disc
    const s = (size * k) / 128;
    const energy = Math.max(0.06, Math.pow((Math.max(core, 1.6 * px) + px) / (size + px), 1.6));
    put(tex, x, y, s, s, 0, bgr, alpha * energy);
  };

  return {
    world,
    bloomAt: (f) => [lerp(0.16, 0.3, sstep(330, 400, f)), lerp(0.05, 0.12, sstep(330, 400, f))],
    update: (f, { width, height, px }) => {
      used = 0;
      // reset every per-frame object: frames may arrive in any order
      chipPlate.alpha = 0;
      chipP.forEach((p) => (p.color = 0));
      lines.begin();
      glows.begin();
      const blueRgb = bgrToRgb01(D.C.blue).map((x) => x * x);
      const whiteRgb = bgrToRgb01(D.C.white).map((x) => x * x);
      // soft blue haze behind everything (stronger in the network and the warp)
      const haze = 0;
      void haze;
      // vertical gradient: navy toward the top, near-black at the bottom
      glows.add(width / 2, -height * 0.25, height * 1.25, 0.004, 0.012, 0.04, 1, 0);
      const c = camAt(f);
      cam.set([c.x, c.y, c.z], c.yaw, c.pitch, c.roll, FOV, width, height);
      const focal = cam.focal;
      const ap = lerp(lerp(0.09, 0.05, sstep(100, 140, f)), 0.07, sstep(45, 70, f) * (1 - sstep(115, 140, f))); // aperture → strength of defocus (narrower during the burst so streaks stay crisp)
      const zf = lerp(lerp(13, 18, sstep(55, 140, f)), 34, sstep(250, 320, f));
      const coc = (z: number) => ap * focal * Math.abs(1 / z - 1 / zf);
      const fogFar = 170;

      // ---------------- sphere + burst
      const sphereA = 1 - sstep(130, 150, f);
      if (sphereA > 0) {
        const th = f * 0.0045;
        const ct = Math.cos(th),
          st = Math.sin(th);
        for (const d of D.dashes) {
          const dt = Math.max(0, f - d.tb);
          const breathe = 1 + 0.035 * Math.min(1, f / 60);
          const rr = d.r0 * breathe + d.v * (0.25 * dt + 0.03 * dt * dt);
          const vel = d.v * (0.25 + 0.06 * dt) * (dt > 0 ? 1 : 0);
          const ux = d.ux * ct + d.uz * st,
            uz = -d.ux * st + d.uz * ct,
            uy = d.uy;
          const x = ux * rr,
            y = uy * rr,
            z = uz * rr;
          if (!cam.project(x, y, z, 0.6)) continue;
          const sx = cam.x,
            sy = cam.y,
            zz = cam.z;
          // dash tail: back along the motion (radial), stretched by speed
          const len3 = 0.34 + vel * 2.2;
          if (!cam.project(x - ux * len3, y - uy * len3, z - uz * len3, 0.6)) continue;
          const tx = cam.x,
            ty = cam.y;
          const dx = sx - tx,
            dy = sy - ty;
          const lpx = Math.hypot(dx, dy);
          const thick = Math.max(1.4 * px, (0.12 * focal) / zz);
          const cc = coc(zz);
          const bi = Math.min(3, Math.floor(Math.log2(1 + cc / (3 * px))));
          const L = Math.max(lpx, thick) + cc * 0.5;
          const T = thick + cc;
          const energy = Math.max(0.04, (thick / T) * Math.min(1, (thick * 5) / Math.max(L, 1)));
          const near = sstep(1.5, 9, zz);
          const facing = (ux * (c.x - x) + uy * (c.y - y) + uz * (c.z - z)) / Math.max(1e-3, Math.hypot(c.x - x, c.y - y, c.z - z));
          const side = dt > 0 ? 1 : facing > 0 ? 1 : 0.04;
          if (dt <= 0) {
            // intact sphere: small tiles / glyph tiles, radially smeared by the slow push-in (zoom blur)
            const rx = sx - width / 2,
              ry = sy - height / 2;
            const rad = Math.hypot(rx, ry);
            // depth cue: interior points small and sparse, rim points larger and denser
            const rimness = 1 - Math.max(0, facing);
            const tile = ((0.09 + 0.1 * rimness) * focal) / zz;
            const smear = rad * 0.04 * rimness;
            const twinkle = hash2(Math.floor(d.r0 * 9973) + d.icon, 7) < 0.45 ? 1 : 0.3;
            const aa = 0.5 * side * sphereA * near * (0.35 + 0.4 * rimness * rimness) * twinkle;
            if (smear > tile * 1.3) {
              const Ls = smear + tile;
              put(A.dashes[2], sx, sy, (Ls * 1.28) / 128, (tile * 3.2) / 32, Math.atan2(ry, rx), d.col, aa * Math.min(1, (tile * 1.6) / Ls + 0.15));
            } else if (d.kind === 1) {
              put(A.icons[0][d.icon], sx, sy, (tile * 1.7) / 128, (tile * 1.7) / 128, 0, d.col, aa * 1.2);
            } else {
              put(A.squares[1], sx, sy, (tile * 1.9) / 64, (tile * 1.9) / 64, 0, d.col, aa);
            }
            continue;
          }
          const a = 0.42 * side * sphereA * near * Math.min(1, energy) * (0.85 + 0.15 * hash2(Math.floor(d.r0 * 1000), Math.floor(f / 6)));
          put(A.dashes[bi], (sx + tx) / 2, (sy + ty) / 2, (L * 1.28) / 128, (T * 3.2) / 32, Math.atan2(dy, dx), d.col, a);
        }
      }

      // ---------------- network: squares, nodes, icons
      const netA = sstep(40, 105, f) * (1 - sstep(300, 345, f));
      if (netA > 0) {
        for (let i = 0; i < D.pts.length; i++) {
          const p = D.pts[i];
          if (!cam.project(p.x, p.y, p.z, 0.4)) continue;
          const z = cam.z;
          if (z > fogFar) continue;
          const fog = sstep(fogFar, fogFar * 0.4, z) * sstep(0.5, 3, z);
          const cc = coc(z);
          const core = (p.size * focal) / z;
          const tw = 0.75 + 0.25 * Math.sin(p.ph * 40 + f * 0.15);
          if (p.kind === 2) {
            const bi = cc < 3 * px ? 0 : cc < 9 * px ? 1 : cc < 22 * px ? 2 : 3;
            if (bi < 3) {
              const s = ((core + cc * 0.6) * 1.45) / 128;
              const e = Math.max(0.15, Math.pow(core / (core + cc * 0.6), 1.2));
              const tiled = i % 5 === 0;
              const tex = tiled ? A.tiles[bi === 0 ? 0 : 1][p.icon] : A.icons[bi][p.icon];
              put(tex, cam.x, cam.y, s, s, 0, p.col, netA * fog * e * (tiled ? 0.8 : 1));
            } else disc(cam.x, cam.y, core * 0.7, cc, px, p.col, netA * fog * 0.8);
          } else if (p.kind === 0) {
            const bi = cc < 3 * px ? 0 : cc < 10 * px ? 1 : 2;
            if (bi < 2 || core > cc) {
              const s = ((Math.max(core, 1.5 * px) + cc * 0.5) * 2) / 64;
              const e = Math.max(0.12, Math.pow(Math.max(core, 1.5 * px) / (Math.max(core, 1.5 * px) + cc * 0.5), 1.4));
              put(A.squares[bi], cam.x, cam.y, s, s, 0, p.col, netA * fog * e * tw);
            } else disc(cam.x, cam.y, core, cc, px, p.col, netA * fog * 0.9 * tw);
          } else disc(cam.x, cam.y, core * 0.7, cc, px, p.col, netA * fog * tw * 0.45);
        }
        // links
        const P = D.pts;
        for (const [ia, ib] of D.links) {
          const a = P[ia],
            b = P[ib];
          const okA = cam.project(a.x, a.y, a.z, 0.5);
          const ax = cam.x,
            ay = cam.y,
            az = cam.z;
          const okB = cam.project(b.x, b.y, b.z, 0.5);
          if (!okA || !okB) continue;
          if (az > fogFar && cam.z > fogFar) continue;
          const fa = sstep(fogFar, fogFar * 0.3, az) * sstep(0.5, 4, az);
          const fb = sstep(fogFar, fogFar * 0.3, cam.z) * sstep(0.5, 4, cam.z);
          const wa = Math.max(1.1 * px, (0.02 * focal) / az),
            wb = Math.max(1.1 * px, (0.02 * focal) / cam.z);
          const k = netA * 0.05;
          lines.add(ax, ay, cam.x, cam.y, wa, wb, 0.45 * k * fa, 0.7 * k * fa, 1.0 * k * fa, k * fa, 0.45 * k * fb, 0.7 * k * fb, k * fb, k * fb);
        }
      }

      const rayA = Math.max(netA, 0.3 * (1 - sstep(60, 120, f)));
      if (rayA > 0) {
        // rays and dashed motion streaks
        for (const ry of D.rays) {
          const zA = ry.z,
            zB = ry.z - ry.len;
          const zNear = c.z - 1.0;
          if (zB > zNear) continue;
          const z0 = Math.min(zA, zNear);
          const t0 = (ry.z - z0) / ry.len;
          const x0 = ry.x + ry.dx * ry.len * t0,
            y0 = ry.y + ry.dy * ry.len * t0;
          if (!cam.project(x0, y0, z0, 0.8)) continue;
          const ax = cam.x,
            ay = cam.y,
            az = cam.z;
          if (!cam.project(ry.x + ry.dx * ry.len, ry.y + ry.dy * ry.len, zB, 0.8)) continue;
          const fa = sstep(fogFar * 2, fogFar * 0.4, az) * rayA * ry.a,
            fb = sstep(fogFar * 2, fogFar * 0.4, cam.z) * rayA * ry.a;
          const [rr, gg, bb] = bgrToRgb01(ry.col);
          const w0 = Math.max(1.0 * px, ((ry.dash ? 0.025 : 0.02) * focal) / az),
            w1 = Math.max(1.0 * px, ((ry.dash ? 0.025 : 0.02) * focal) / cam.z);
          lines.add(ax, ay, cam.x, cam.y, w0, w1, rr * fa, gg * fa, bb * fa, fa, rr * fb, gg * fb, bb * fb, fb);
        }
        // fine dust, densest around the flight axis
        for (const d of netA > 0 ? D.dust : []) {
          if (!cam.project(d.x, d.y, d.z, 0.5)) continue;
          const z = cam.z;
          if (z > fogFar) continue;
          const fog = sstep(fogFar, fogFar * 0.3, z) * sstep(0.5, 3, z) * netA;
          const sz = Math.max(1.1 * px, (0.03 * focal) / z);
          put(A.discs[0], cam.x, cam.y, (sz * 2.6) / 128, (sz * 2.6) / 128, 0, d.col, fog * 0.7);
        }
        // small intense point flare at the vanishing point
        if (cam.project(c.x, c.y, c.z - 500, 0.5)) {
          glows.add(cam.x, cam.y, height * 0.06, 1, 1, 1, netA * 0.9, 1);
          glows.add(cam.x, cam.y, height * 0.18, blueRgb[0], blueRgb[1], blueRgb[2], netA * 0.12, 0);
        }
      }

      // ---------------- grid tunnel
      const tunA = sstep(215, 275, f) * (1 - sstep(385, 425, f));
      if (tunA > 0) {
        const { HW, HH } = D;
        const z0 = -340;
        const ring = 6;
        const kStart = Math.max(0, Math.floor((z0 - c.z) / ring) - 1);
        const segs: [number, number][] = [];
        for (let u = -HW; u <= HW; u += 3) segs.push([u, -HH], [u, HH]);
        for (let u = -HH; u <= HH; u += 3) segs.push([-HW, u], [HW, u]);
        const corners: [number, number][] = [
          [-HW, -HH],
          [HW, -HH],
          [HW, HH],
          [-HW, HH],
        ];
        for (let k = kStart; k < kStart + 70; k++) {
          const z = z0 - k * ring;
          if (z > c.z - 0.6) continue;
          const dz = c.z - z;
          const fog = sstep(320, 60, dz) * sstep(0.6, 8, dz) * tunA;
          if (fog <= 0.002) continue;
          const kk = fog * 0.55;
          // ring
          for (let e = 0; e < 4; e++) {
            const p0 = corners[e],
              p1 = corners[(e + 1) % 4];
            if (!cam.project(p0[0], p0[1], z, 0.5)) continue;
            const x0 = cam.x,
              y0 = cam.y;
            if (!cam.project(p1[0], p1[1], z, 0.5)) continue;
            const w = Math.max(1.2 * px, (0.05 * focal) / dz);
            lines.add(x0, y0, cam.x, cam.y, w, w, 0.35 * kk, 0.65 * kk, kk, kk, 0.35 * kk, 0.65 * kk, kk, kk);
          }
          // longitudinal grid segment to next ring
          for (const [sx, sy] of segs) {
            if (!cam.project(sx, sy, z, 0.5)) continue;
            const x0 = cam.x,
              y0 = cam.y,
              zz0 = cam.z;
            if (!cam.project(sx, sy, z - ring, 0.5)) continue;
            const w0 = Math.max(1.0 * px, (0.03 * focal) / zz0),
              w1 = Math.max(1.0 * px, (0.03 * focal) / cam.z);
            const k2 = kk * 0.6;
            lines.add(x0, y0, cam.x, cam.y, w0, w1, 0.3 * k2, 0.6 * k2, k2, k2, 0.3 * k2, 0.6 * k2, k2, k2);
          }
        }
        for (const s of D.tun) {
          if (!cam.project(s.x, s.y, s.z, 0.5)) continue;
          const dz = cam.z;
          const blink = hash2(Math.floor(s.ph * 1e5), Math.floor((f + s.ph * 20) / 20)) > 0.35 ? 1 : 0.25;
          const fog = sstep(320, 60, dz) * sstep(0.6, 6, dz) * tunA * blink;
          const core = (0.35 * focal) / dz;
          disc(cam.x, cam.y, core, coc(dz) * 0.6, px, s.col, fog);
        }
        // bright point ahead
        if (cam.project(0, 0, c.z - 600, 0.5)) {
          const g = 0.25 + 0.75 * sstep(250, 360, f);
          const s = (height * (0.06 + 0.25 * sstep(300, 420, f))) / 256;
          glows.add(cam.x, cam.y, s * 256 * 2, whiteRgb[0], whiteRgb[1], whiteRgb[2], tunA * g * 0.9, 1);
        }
      }

      // ---------------- warp streaks
      const wA = sstep(335, 380, f);
      if (wA > 0) {
        const tt = Math.max(0, f - 335);
        const S = 4 * tt + 0.11 * tt * tt;
        const Lw = 10 + 2.4 * tt;
        for (const w of D.warp) {
          const zr = ((w.z0 - S) % 420 + 420) % 420 + 1.0;
          const x = Math.cos(w.a) * w.rad,
            y = Math.sin(w.a) * w.rad;
          // camera-relative: project manually along the view axis (roll applied)
          const cr = Math.cos(c.roll),
            sr = Math.sin(c.roll);
          const rx = x * cr - y * sr,
            ry = x * sr + y * cr;
          const z1 = zr,
            z2 = zr + (w.dash ? 3 + 0.05 * tt : Lw);
          const x1 = width / 2 + (rx / z1) * focal,
            y1 = height / 2 - (ry / z1) * focal;
          const x2 = width / 2 + (rx / z2) * focal,
            y2 = height / 2 - (ry / z2) * focal;
          const scr = Math.hypot(x2 - width / 2, y2 - height / 2) / height;
          const fade = sstep(420, 200, zr) * sstep(0.5, 6, zr) * wA * (0.6 + 0.4 * sstep(0.02, 0.15, scr));
          const [rr, gg, bb] = bgrToRgb01(w.col);
          const zoom = 1 + 14 * scr * scr; // radial zoom blur: softer and wider toward the edges
          const k1 = (fade * (w.dash ? 0.5 : 0.6)) / Math.sqrt(zoom),
            k2 = (fade * (w.dash ? 0.5 : 0.1)) / Math.sqrt(zoom);
          const w1 = Math.max(1.2 * px, (w.w * focal) / z1) * zoom,
            w2 = Math.max(1 * px, (w.w * focal) / z2) * zoom;
          lines.add(x1, y1, x2, y2, w1, w2, rr * k1, gg * k1, bb * k1, k1, rr * k2, gg * k2, bb * k2, k2);
        }
        // chip at the vanishing point
        const ch = sstep(360, 420, f);
        if (ch > 0) {
          const dist = lerp(160, 26, sstep(360, 450, f));
          const size = (3 * focal) / dist;
          const cx = width / 2,
            cy = height / 2;
          const tealRgb = bgrToRgb01(D.C.teal).map((x) => x * x);
          glows.add(cx, cy, size * 2.4, tealRgb[0], tealRgb[1], tealRgb[2], ch * 0.3, 0);
          // vertical dashed line through the chip, dashes moving outward
          for (let k = 0; k < 14; k++) {
            const u = (k / 14 + tt * 0.012) % 1;
            const off = size * 0.75 + u * u * height * 0.5;
            const len = 4 * px + u * 30 * px;
            for (const sg of [-1, 1]) lines.add(cx, cy + sg * off, cx, cy + sg * (off + len), 3 * px, 3 * px, 0.8 * ch, 0.9 * ch, ch, ch, 0.8 * ch, 0.9 * ch, ch, ch);
          }
          chipPlate.position.set(cx, cy);
          chipPlate.width = chipPlate.height = size * 1.05;
          chipPlate.rotation = c.roll;
          chipPlate.alpha = ch * 0.6;
          chipP.forEach((p, k) => {
            p.x = cx;
            p.y = cy;
            p.rotation = c.roll;
            p.scaleX = p.scaleY = (size * (k ? 1.5 : 1.45)) / 256;
            p.color = ((k ? D.C.teal : D.C.white) & 0xffffff) + (Math.round(255 * ch * (k ? 0.25 : 1)) << 24);
          });
        } else {
          chipPlate.alpha = 0;
          chipP.forEach((p) => (p.color = 0));
        }
      }

      // hide the rest of the pool
      for (let i = used; i < pool.length; i++) {
        const p = pool[i];
        if (p.color === 0 && p.scaleX === 0) break;
        p.color = 0;
        p.scaleX = 0;
        p.scaleY = 0;
      }
      lines.end();
      glows.end();
    },
  };
};

export const DataBurst: React.FC<{ version: DataBurstVersion }> = ({ version }) => {
  const post = useMemo(() => {
    const n = parseInt(version.bg.slice(1), 16);
    return {
      bloomA: 0.3,
      bloomB: 0.15,
      exposure: 1.0,
      grain: 0.02,
      dither: true,
      blackSafe: false,
      bg: [(((n >> 16) & 255) / 255) * 0.35, (((n >> 8) & 255) / 255) * 0.35, ((n & 255) / 255) * 0.35] as [number, number, number],
      grainPeriod: 100000,
    };
  }, [version]);
  const build = useMemo(() => () => buildScene(version), [version]);
  return <PixiStage build={build} post={post} />;
};
