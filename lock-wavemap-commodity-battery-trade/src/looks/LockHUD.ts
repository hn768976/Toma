import * as THREE from "three";
import type { LookFactory } from "../core/Stage";
import { canvasTexture, font, hexVec, makeCanvas, rgba, type Ctx } from "../core/canvas";
import { layerMaterial } from "../core/layers";
import { clamp, easeOutCubic, easeOutQuint, hash01, mulberry32, range, smoothstep, TAU } from "../core/random";

// Look 1 — Lock HUD. A pixel-textured padlock at the centre of a ring HUD laid
// almost flat (plane ~65° from facing), with upright translucent cards around
// it. 20 s: 0–1.5 s black, 1.5–4 s build-in, 4–20 s live hold.

export type LockHUDProps = {
  lockA: string;
  lockB: string;
  ring: string;
  ringDim: string;
  text: string;
  accent: string;
  hazeCentre: string;
  hazeEdge: string;
};

const RMAX = 10.2;
const rng = mulberry32(85438445);

type RingDef = { rin: number; rout: number; speed: number; kind: string; seed: number };
const RINGS: RingDef[] = [
  { rin: 3.0, rout: 3.6, speed: -4, kind: "arcs", seed: 2 },
  { rin: 3.75, rout: 4.05, speed: 6, kind: "ticks", seed: 3 },
  { rin: 4.25, rout: 5.05, speed: -2.5, kind: "ribbon", seed: 4 },
  { rin: 5.2, rout: 5.8, speed: 3.5, kind: "binary", seed: 5 },
  { rin: 5.95, rout: 6.45, speed: -5, kind: "dash2", seed: 6 },
  { rin: 6.65, rout: 7.95, speed: 2, kind: "band", seed: 7 },
  { rin: 8.2, rout: 8.75, speed: -1.5, kind: "binary2", seed: 8 },
  { rin: 9.0, rout: 10.1, speed: 1.2, kind: "outer", seed: 9 },
];

type CardDef = { ang: number; r: number; h: number; w: number; kind: number; seed: number; y: number };
// kinds: 0 number tag, 1 mini bars, 2/3 ID strip, 4 text + line, 5 white callout,
// 6 large glass slab, 7 tall column panel, 8 bar strip, 9 value bar + white tag
const CARDS: CardDef[] = [
  { ang: 2.85, r: 7.2, w: 4.4, h: 2.5, kind: 6, seed: 11, y: 1.7 },
  { ang: 0.75, r: 8.6, w: 1.7, h: 4.0, kind: 7, seed: 12, y: 2.2 },
  { ang: 1.05, r: 9.6, w: 4.8, h: 1.0, kind: 8, seed: 13, y: 3.2 },
  { ang: 1.45, r: 8.4, w: 2.0, h: 0.7, kind: 10, seed: 23, y: 0.45 },
  { ang: 1.75, r: 9.4, w: 4.6, h: 1.0, kind: 3, seed: 14, y: 4.9 },
  { ang: 0.32, r: 6.2, w: 3.4, h: 0.62, kind: 9, seed: 15, y: 2.3 },
  { ang: 4.3, r: 4.4, w: 1.5, h: 0.75, kind: 5, seed: 16, y: 0.35 },
  { ang: 2.35, r: 9.0, w: 2.6, h: 1.3, kind: 4, seed: 17, y: 3.4 },
  { ang: 3.5, r: 9.6, w: 2.4, h: 1.2, kind: 1, seed: 18, y: 0.9 },
  { ang: 5.55, r: 8.4, w: 2.4, h: 0.9, kind: 0, seed: 19, y: 0.5 },
  { ang: 0.05, r: 9.6, w: 1.4, h: 0.8, kind: 5, seed: 20, y: 1.4 },
  { ang: 2.0, r: 9.9, w: 2.2, h: 1.0, kind: 2, seed: 21, y: 2.6 },
];

const ORANGE = Array.from({ length: 12 }, () => ({
  ring: [0, 2, 3, 5, 5, 6, 7][Math.floor(rng() * 7)],
  ang: rng() * TAU,
  n: 1 + Math.floor(rng() * 3),
  period: [20, 30, 40, 60][Math.floor(rng() * 4)],
  seed: Math.floor(rng() * 1e6),
}));

// ---------------------------------------------------------------------------
// Ring artwork, drawn once into one square canvas (concentric); each ring mesh
// samples only its own annulus, so they can spin independently.
const drawRings = (ctx: Ctx, S: number, p: LockHUDProps) => {
  const k = S / (2 * RMAX); // px per unit
  ctx.translate(S / 2, S / 2);
  const circle = (r: number, w: number, col: string, a0 = 0, a1 = TAU) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w * k;
    ctx.beginPath();
    ctx.arc(0, 0, r * k, a0, a1);
    ctx.stroke();
  };
  const ticks = (r0: number, r1: number, n: number, w: number, col: string, every = 0, r1b = r1) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w * k;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = every && i % every === 0 ? r1b : r1;
      ctx.moveTo(Math.cos(a) * r0 * k, Math.sin(a) * r0 * k);
      ctx.lineTo(Math.cos(a) * rr * k, Math.sin(a) * rr * k);
    }
    ctx.stroke();
  };
  const textOnRing = (str: string, r: number, a: number, size: number, col: string, weight = 500, fam: "Inter" | "JetBrains Mono" = "JetBrains Mono") => {
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -r * k);
    ctx.fillStyle = col;
    ctx.font = font(weight, size * k, fam);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
  const band = (r0: number, r1: number, a0: number, a1: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r1 * k, a0, a1);
    ctx.arc(0, 0, r0 * k, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  };
  const C = p.ring;
  const D = p.ringDim;
  const T = p.text;
  for (const R of RINGS) {
    const r = mulberry32(R.seed * 7919);
    const mid = (R.rin + R.rout) / 2;
    switch (R.kind) {
      case "dash":
        circle(R.rin + 0.05, 0.03, rgba(C, 0.8));
        ctx.setLineDash([0.12 * k, 0.08 * k]);
        circle(mid + 0.05, 0.12, rgba(C, 0.55));
        ctx.setLineDash([]);
        circle(R.rout - 0.04, 0.02, rgba(C, 0.5));
        break;
      case "arcs":
        band(R.rin + 0.05, R.rout - 0.05, 0, TAU, rgba(D, 0.13));
        for (let i = 0; i < 5; i++) {
          const a0 = r() * TAU;
          band(R.rin + 0.25, R.rout - 0.12, a0, a0 + range(r, 0.3, 1.1), rgba(D, 0.35));
        }
        circle(R.rin + 0.05, 0.035, rgba(C, 0.85));
        circle(R.rout - 0.05, 0.06, rgba(C, 0.7), 0.2, 4.4);
        for (let i = 0; i < 6; i++) textOnRing(String(Math.floor(range(r, 1000, 99999))), mid, (i / 6) * TAU + 0.1, 0.14, rgba(T, 0.6));
        break;
      case "ticks":
        ticks(R.rin + 0.03, R.rin + 0.14, 360, 0.018, rgba(C, 0.75), 10, R.rout - 0.03);
        circle(R.rin + 0.02, 0.02, rgba(C, 0.6));
        break;
      case "panel": {
        band(R.rin, R.rout, 0, TAU, rgba(D, 0.07));
        circle(R.rin + 0.02, 0.025, rgba(C, 0.55));
        circle(R.rout - 0.02, 0.025, rgba(C, 0.55));
        // flat cards lying on the ring with numbers
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + r() * 0.3;
          const span = range(r, 0.22, 0.42);
          band(R.rin + 0.15, R.rout - 0.15, a, a + span, rgba(D, 0.12));
          ctx.save();
          ctx.rotate(a + span / 2 + Math.PI / 2);
          ctx.strokeStyle = rgba(C, 0.35);
          ctx.lineWidth = 0.015 * k;
          ctx.strokeRect(-span * mid * 0.5 * k, -(R.rout - 0.15) * k, span * mid * k, (R.rout - R.rin - 0.3) * k);
          ctx.restore();
          textOnRing(range(r, 100, 999).toFixed(2), mid + 0.12, a + span / 2 + Math.PI / 2, 0.24, rgba(T, 0.75), 700, "Inter");
          for (let j = 0; j < 3; j++) textOnRing("▬▬ ▬▬▬ ▬", mid - 0.15 - j * 0.12, a + span / 2 + Math.PI / 2 - 0.05, 0.06, rgba(T, 0.45));
        }
        break;
      }
      case "ribbon":
        band(R.rin, R.rout, 0, TAU, rgba(D, 0.06));
        for (let i = 0; i < 4; i++) {
          const a0 = (i / 4) * TAU + r() * 0.8;
          band(R.rin + 0.08, R.rout - 0.08, a0, a0 + range(r, 0.6, 1.4), rgba("#7AB4FF", 0.3));
        }
        circle(R.rin + 0.02, 0.025, rgba(C, 0.55));
        circle(R.rout - 0.02, 0.02, rgba(C, 0.45));
        for (let i = 0; i < 2; i++) textOnRing(range(r, 10, 99).toFixed(2), R.rin + 0.4, (i / 2) * TAU + 0.5, 0.2, rgba(T, 0.6), 700, "Inter");
        break;
      case "binary": {
        circle(R.rin + 0.03, 0.02, rgba(C, 0.5));
        const n = 150;
        for (let i = 0; i < n; i++) textOnRing(r() > 0.5 ? "1" : "0", mid, (i / n) * TAU, 0.3, rgba(T, 0.95), 600);
        break;
      }
      case "dash2":
        ctx.setLineDash([0.9 * k, 0.25 * k, 0.15 * k, 0.25 * k]);
        circle(mid, 0.2, rgba(D, 0.45));
        ctx.setLineDash([]);
        circle(R.rin + 0.02, 0.03, rgba(C, 0.65));
        circle(R.rout - 0.02, 0.015, rgba(C, 0.45));
        break;
      case "band":
        band(R.rin, R.rout, 0, TAU, rgba(D, 0.08));
        for (let i = 0; i < 7; i++) {
          const a0 = r() * TAU;
          band(R.rin + 0.1, R.rout - 0.1, a0, a0 + range(r, 0.3, 1.2), rgba("#6AA8FF", 0.22));
        }
        ticks(R.rout - 0.25, R.rout - 0.05, 180, 0.03, rgba(C, 0.55));
        circle(R.rin + 0.03, 0.05, rgba(C, 0.75));
        circle(R.rin + 0.25, 0.015, rgba(C, 0.45));
        for (let i = 0; i < 10; i++) textOnRing(`${Math.floor(range(r, 10000, 99999))}  ${Math.floor(range(r, 10, 99))}  ${Math.floor(range(r, 100, 999))}`, R.rin + 0.55, (i / 10) * TAU + 0.2, 0.2, rgba(T, 0.75), 500);
        break;
      case "binary2": {
        const n = 210;
        for (let i = 0; i < n; i++) textOnRing(r() > 0.5 ? "1" : "0", mid, (i / n) * TAU, 0.34, rgba(T, 0.85), 600);
        circle(R.rout - 0.02, 0.03, rgba(C, 0.5));
        break;
      }
      case "outer":
        circle(R.rin + 0.1, 0.03, rgba(C, 0.6), 0.3, 3.9);
        circle(R.rin + 0.5, 0.05, rgba(C, 0.7), 4.3, 6.0);
        circle(R.rout - 0.2, 0.025, rgba(C, 0.45));
        band(R.rin + 0.25, R.rin + 0.65, 1.0, 2.2, rgba(D, 0.25));
        band(R.rin + 0.25, R.rin + 0.65, 4.0, 4.6, rgba(D, 0.25));
        ticks(R.rout - 0.2, R.rout - 0.05, 90, 0.04, rgba(C, 0.4));
        break;
    }
  }
};

// ---------------------------------------------------------------------------
const drawLock = (ctx: Ctx, w: number, h: number, p: LockHUDProps) => {
  // Shape (units of w): shackle + body + keyhole.
  const bodyX = w * 0.13;
  const bodyY = h * 0.44;
  const bodyW = w * 0.74;
  const bodyH = h * 0.54;
  const shape = () => {
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, w * 0.07);
    // keyhole (even-odd hole)
    const cx = w / 2;
    const cy = bodyY + bodyH * 0.42;
    ctx.moveTo(cx + w * 0.085, cy);
    ctx.arc(cx, cy, w * 0.085, 0, TAU, true);
    ctx.moveTo(cx - w * 0.04, cy + w * 0.04);
    ctx.lineTo(cx - w * 0.055, cy + bodyH * 0.38);
    ctx.lineTo(cx + w * 0.055, cy + bodyH * 0.38);
    ctx.lineTo(cx + w * 0.04, cy + w * 0.04);
    ctx.closePath();
  };
  // pixel texture fill
  const fillPixels = () => {
    const cell = w / 70;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const v = hash01(Math.floor(x / cell), Math.floor(y / cell), 7);
        if (v < 0.12) continue;
        const t = y / h;
        const a = 0.55 + 0.45 * v;
        ctx.fillStyle = v > 0.96 ? rgba(p.lockB, 1) : rgba(p.lockA, a * (0.75 + 0.25 * t));
        ctx.fillRect(x + cell * 0.08, y + cell * 0.08, cell * 0.84, cell * 0.84);
      }
    }
  };
  ctx.save();
  shape();
  ctx.clip("evenodd");
  fillPixels();
  ctx.restore();
  // shackle: pixel fill masked by the stroked shackle shape (source-in keeps
  // the pixel texture's own alpha, so gaps stay transparent)
  const mask = makeCanvas(w, h);
  const m = mask.ctx;
  m.lineWidth = w * 0.1;
  m.strokeStyle = "#fff";
  m.beginPath();
  const rs = w * 0.24;
  m.moveTo(w / 2 - rs, bodyY + 2);
  m.lineTo(w / 2 - rs, h * 0.3);
  m.arc(w / 2, h * 0.3, rs, Math.PI, 0);
  m.lineTo(w / 2 + rs, bodyY + 2);
  m.stroke();
  const pix = makeCanvas(w, h);
  const pc = pix.ctx;
  {
    const cell = w / 70;
    for (let y = 0; y < h; y += cell)
      for (let x = 0; x < w; x += cell) {
        const v = hash01(Math.floor(x / cell), Math.floor(y / cell), 7);
        if (v < 0.12) continue;
        pc.fillStyle = v > 0.96 ? rgba(p.lockB, 1) : rgba(p.lockA, (0.55 + 0.45 * v) * 0.8);
        pc.fillRect(x + cell * 0.08, y + cell * 0.08, cell * 0.84, cell * 0.84);
      }
  }
  m.globalCompositeOperation = "source-in";
  m.drawImage(pix.canvas, 0, 0);
  ctx.drawImage(mask.canvas, 0, 0);
  // outlines
  ctx.strokeStyle = rgba(p.lockB, 0.75);
  ctx.lineWidth = w * 0.01;
  shape();
  ctx.stroke();
  ctx.lineWidth = w * 0.01;
  ctx.beginPath();
  const r0 = w * 0.24;
  ctx.arc(w / 2, h * 0.3, r0 + w * 0.05, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.3, r0 - w * 0.05, Math.PI, 0);
  ctx.stroke();
};

// ---------------------------------------------------------------------------
const CARD_W = 640;
const drawCard = (ctx: Ctx, cw: number, ch: number, def: CardDef, frame: number, p: LockHUDProps) => {
  const tick = (period: number, salt: number) => Math.floor((frame + def.seed * 7) / period) + salt;
  ctx.clearRect(0, 0, cw, ch);
  const u = cw / CARD_W;
  ctx.fillStyle = rgba(p.ringDim, 0.18);
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = rgba(p.ring, 0.7);
  ctx.lineWidth = 3 * u;
  ctx.strokeRect(2 * u, 2 * u, cw - 4 * u, ch - 4 * u);
  ctx.fillStyle = rgba(p.ring, 0.9);
  ctx.fillRect(0, 0, 40 * u, 6 * u);
  ctx.fillRect(cw - 60 * u, ch - 6 * u, 60 * u, 6 * u);
  ctx.textBaseline = "middle";
  const blink = (period: number, salt: number) => hash01(tick(period, salt), def.seed) > 0.45;
  switch (def.kind) {
    case 0: {
      // number tag with a white value box
      const v = 100 + hash01(tick(9, 1), def.seed) * 900;
      ctx.fillStyle = rgba("#FFFFFF", 0.92);
      ctx.fillRect(18 * u, ch * 0.22, cw * 0.62, ch * 0.56);
      ctx.fillStyle = "#0A2A6A";
      ctx.font = font(800, ch * 0.4, "Inter");
      ctx.fillText(v.toFixed(2), 34 * u, ch * 0.51);
      ctx.fillStyle = rgba(p.text, 0.8);
      ctx.font = font(500, ch * 0.13, "JetBrains Mono");
      for (let i = 0; i < 3; i++) ctx.fillText(String(Math.floor(hash01(tick(15, i), def.seed) * 99999)).padStart(5, "0"), cw * 0.68, ch * (0.3 + i * 0.2));
      if (blink(12, 3)) {
        ctx.fillStyle = p.accent;
        ctx.fillRect(cw - 42 * u, 14 * u, 26 * u, ch * 0.4);
      }
      break;
    }
    case 1: {
      // mini bars
      const n = 14;
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.7 * hash01(i, tick(6, i % 3), def.seed);
        ctx.fillStyle = rgba(i === 9 ? p.accent : p.text, i === 9 ? 1 : 0.75);
        const bw = (cw - 60 * u) / n;
        ctx.fillRect(30 * u + i * bw, ch * 0.85 - v * ch * 0.55, bw * 0.6, v * ch * 0.55);
      }
      ctx.fillStyle = rgba(p.text, 0.85);
      ctx.font = font(600, ch * 0.12, "JetBrains Mono");
      ctx.fillText(`${Math.floor(hash01(tick(10, 9), def.seed) * 100)}%`, 30 * u, ch * 0.14);
      break;
    }
    case 2:
    case 3: {
      // ID string strip
      const id = `GH-${String(85438445 + (def.kind === 3 ? 0 : def.seed * 1117)).padStart(8, "0")}`;
      ctx.fillStyle = rgba(p.text, 0.95);
      ctx.font = font(700, ch * 0.22, "JetBrains Mono");
      ctx.fillText(id, 26 * u, ch * 0.24);
      if (def.kind === 3) {
        ctx.fillStyle = p.accent;
        ctx.fillRect(cw - 70 * u, ch * 0.12, 30 * u, ch * 0.22);
      }
      ctx.font = font(500, ch * 0.1, "JetBrains Mono");
      for (let row = 0; row < 4; row++) {
        let s = "";
        for (let c = 0; c < 16; c++) s += hash01(c, row, tick(5, def.seed)) > 0.5 ? "1" : "0";
        ctx.fillStyle = rgba(p.text, 0.55);
        ctx.fillText(s, 26 * u, ch * (0.48 + row * 0.13));
      }
      // toggle dots
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = blink(8, i + 20) ? rgba(p.text, 0.95) : rgba(p.text, 0.25);
        ctx.beginPath();
        ctx.arc(cw * 0.66 + i * 26 * u, ch * 0.6, 7 * u, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 4: {
      // text lines + small line chart
      ctx.fillStyle = rgba(p.text, 0.6);
      for (let i = 0; i < 6; i++) ctx.fillRect(24 * u, ch * (0.14 + i * 0.12), cw * (0.25 + 0.3 * hash01(i, def.seed)), 5 * u);
      ctx.strokeStyle = rgba(p.ring, 0.95);
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const v = 0.5 + 0.4 * Math.sin(i * 0.7 + def.seed) * hash01(i, tick(7, 2), def.seed);
        const x = cw * 0.6 + (i / 20) * cw * 0.35;
        const y = ch * (0.85 - v * 0.6);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 6: {
      // large glass slab: grid of tiny text, small chart, orange marker
      ctx.fillStyle = rgba(p.ringDim, 0.22);
      ctx.fillRect(0, 0, cw, ch);
      ctx.font = font(500, ch * 0.045, "JetBrains Mono");
      for (let row = 0; row < 14; row++) {
        ctx.fillStyle = rgba(p.text, row % 4 === 0 ? 0.9 : 0.5);
        let s2 = "";
        for (let c = 0; c < 9; c++) s2 += hash01(c, row, tick(7, 3)) > 0.5 ? "1" : "0";
        ctx.fillText(`${s2}  ${String(Math.floor(hash01(row, tick(11, 5), def.seed) * 99999)).padStart(5, "0")}`, 24 * u, ch * (0.1 + row * 0.06));
      }
      ctx.strokeStyle = rgba(p.ring, 0.9);
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(cw * 0.55, ch * 0.12, cw * 0.4, ch * 0.4);
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = rgba(p.text, hash01(i, j, tick(9, 1)) > 0.5 ? 0.85 : 0.25);
          ctx.fillRect(cw * 0.58 + i * cw * 0.06, ch * 0.16 + j * ch * 0.09, cw * 0.04, ch * 0.06);
        }
      ctx.fillStyle = p.accent;
      if (blink(16, 9)) ctx.fillRect(cw * 0.93, ch * 0.62, cw * 0.035, ch * 0.18);
      ctx.strokeStyle = rgba(p.ring, 0.95);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const v = 0.5 + 0.35 * Math.sin(i * 0.6 + def.seed) * hash01(i, tick(8, 2), def.seed);
        const x = cw * 0.55 + (i / 24) * cw * 0.4;
        const y = ch * (0.92 - v * 0.3);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 7: {
      // tall column panel with dotted text columns
      ctx.font = font(500, cw * 0.075, "JetBrains Mono");
      for (let row = 0; row < 30; row++) {
        ctx.fillStyle = rgba(p.text, 0.25 + 0.6 * hash01(row, tick(6, 1), def.seed));
        ctx.fillText(String(Math.floor(hash01(row, 2, def.seed) * 9e5)).padStart(6, "0"), 20 * u, ch * (0.04 + row * 0.032));
      }
      ctx.fillStyle = rgba(p.ring, 0.9);
      ctx.fillRect(cw * 0.8, ch * 0.05, cw * 0.06, ch * 0.9);
      break;
    }
    case 8: {
      // light-blue bar strip
      ctx.fillStyle = rgba("#6AA8FF", 0.4);
      ctx.fillRect(0, ch * 0.2, cw * 0.82, ch * 0.6);
      for (let i = 0; i < 18; i++) {
        const v = 0.3 + 0.6 * hash01(i, tick(6, 3), def.seed);
        ctx.fillStyle = rgba(p.text, 0.8);
        ctx.fillRect(cw * 0.04 + i * cw * 0.042, ch * (0.75 - v * 0.5), cw * 0.02, ch * v * 0.5);
      }
      break;
    }
    case 9: {
      // value bar with orange marker and a white tag
      ctx.fillStyle = rgba(p.ringDim, 0.55);
      ctx.fillRect(0, 0, cw * 0.7, ch);
      ctx.fillStyle = p.accent;
      ctx.fillRect(cw * 0.02, ch * 0.12, cw * 0.025, ch * 0.76);
      ctx.fillStyle = rgba("#FFFFFF", 0.97);
      ctx.font = font(800, ch * 0.62, "Inter");
      ctx.fillText((20 + hash01(tick(9, 1), def.seed) * 9).toFixed(2), cw * 0.08, ch * 0.54);
      ctx.fillRect(cw * 0.76, ch * 0.08, cw * 0.2, ch * 0.84);
      ctx.fillStyle = "#0A2A6A";
      ctx.fillText(String(40 + Math.floor(hash01(tick(25, 2), def.seed) * 9)), cw * 0.79, ch * 0.54);
      break;
    }
    case 10: {
      // three bold orange bars (far side of the rings)
      ctx.clearRect(0, 0, cw, ch);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = blink(10, i + 30) || i === 1 ? p.accent : rgba(p.accent, 0.35);
        ctx.fillRect(cw * (0.12 + i * 0.27), ch * 0.08, cw * 0.2, ch * 0.84);
      }
      break;
    }
    case 5: {
      ctx.fillStyle = rgba("#FFFFFF", 0.95);
      ctx.fillRect(14 * u, ch * 0.16, cw * 0.55, ch * 0.68);
      ctx.fillStyle = "#0A2A6A";
      ctx.font = font(800, ch * 0.52, "Inter");
      ctx.fillText(String(10 + Math.floor(hash01(tick(20, 4), def.seed) * 89)), 40 * u, ch * 0.52);
      if (blink(14, 7)) {
        ctx.fillStyle = p.accent;
        ctx.fillRect(cw * 0.72, ch * 0.2, cw * 0.1, ch * 0.6);
      }
      break;
    }
  }
};

const drawInner = (ctx: Ctx, w: number, h: number, frame: number, p: LockHUDProps) => {
  ctx.clearRect(0, 0, w, h);
  const u = w / 1600;
  ctx.lineCap = "round";
  // three small % rings to the right of the lock
  [15, 15, 10].forEach((v0, i) => {
    const v = clamp(v0 + Math.round(4 * (hash01(Math.floor(frame / 18), i, 3) - 0.5)), 1, 99);
    const cx = w * 0.8 + (i === 1 ? 14 : 0) * u;
    const cy = h * (0.22 + i * 0.25);
    ctx.strokeStyle = rgba(p.text, 0.3);
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, 36 * u, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(p.text, 0.95);
    ctx.beginPath();
    ctx.arc(cx, cy, 36 * u, -Math.PI / 2, -Math.PI / 2 + (v / 100) * TAU * 2.5);
    ctx.stroke();
    ctx.fillStyle = rgba(p.text, 0.95);
    ctx.font = font(700, 22 * u, "Inter");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${v}%`, cx, cy);
  });
  ctx.textAlign = "left";
  // three document / checklist icons, left of and below the lock
  for (let i = 0; i < 3; i++) {
    const x = w * 0.12 + i * 84 * u;
    const y = h * 0.66;
    ctx.strokeStyle = rgba(p.text, 0.9);
    ctx.lineWidth = 4 * u;
    ctx.strokeRect(x, y, 54 * u, 70 * u);
    ctx.fillStyle = rgba(p.text, 0.9);
    for (let j = 0; j < 4; j++) {
      ctx.fillRect(x + 20 * u, y + 13 * u + j * 13 * u, 26 * u, 4 * u);
      ctx.fillRect(x + 8 * u, y + 12 * u + j * 13 * u, 6 * u, 6 * u);
    }
  }
  const hex = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };
  ctx.strokeStyle = rgba(p.text, 0.85);
  ctx.lineWidth = 4 * u;
  // hexagon badges
  hex(w * 0.25, h * 0.3, 28 * u);
  hex(w * 0.25, h * 0.55, 28 * u);
  hex(w * 0.4, h * 0.06, 24 * u);
  ctx.fillStyle = rgba(p.text, 0.9);
  [[0.25, 0.3], [0.25, 0.55], [0.4, 0.06]].forEach(([x, y], i) => {
    ctx.globalAlpha = hash01(Math.floor(frame / 15), i) > 0.3 ? 1 : 0.4;
    ctx.fillRect(x * w - 9 * u, y * h - 9 * u, 18 * u, 18 * u);
  });
  ctx.globalAlpha = 1;
  // person icon
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.04, 12 * u, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.04 + 40 * u, 22 * u, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  // shield icon
  const sx = w * 0.68;
  const sy = h * 0.45;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 26 * u);
  ctx.lineTo(sx + 22 * u, sy - 16 * u);
  ctx.quadraticCurveTo(sx + 20 * u, sy + 16 * u, sx, sy + 28 * u);
  ctx.quadraticCurveTo(sx - 20 * u, sy + 16 * u, sx - 22 * u, sy - 16 * u);
  ctx.closePath();
  ctx.stroke();
  // small data lines
  ctx.fillStyle = rgba(p.text, 0.6);
  ctx.font = font(500, 18 * u, "JetBrains Mono");
  for (let i = 0; i < 3; i++) ctx.fillText(String(Math.floor(hash01(Math.floor(frame / 9), i, 5) * 1e7)).padStart(7, "0"), w * 0.12, h * (0.12 + i * 0.07));
  ctx.fillRect(w * 0.7, h * 0.86, 160 * u, 4 * u);
  ctx.fillRect(w * 0.7, h * 0.9, 100 * u, 4 * u);
};

// ---------------------------------------------------------------------------
export const lockHUDLook: LookFactory<LockHUDProps> = (env, p) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, env.aspect, 0.5, 200);
  const ts = env.texScale;

  // Haze background with a horizontal light streak.
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthWrite: false,
    depthTest: false,
    uniforms: { c0: { value: hexVec(p.hazeCentre) }, c1: { value: hexVec(p.hazeEdge) }, fade: { value: 0 }, streak: { value: 0 }, sc: { value: hexVec(p.ring) }, sy: { value: 0.5 } },
    vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0);} `,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform vec3 c0, c1, sc; uniform float fade, streak, sy;
      void main(){ vec2 q = vUv - vec2(0.5, 0.6); q.x *= 1.0; float r = length(q * vec2(1.25, 1.6));
        vec3 c = mix(c0 * 0.85, c0 * 0.55, smoothstep(0.0, 0.9, r));
        c = mix(c, c1 * 1.6, smoothstep(0.8, 1.5, r));
        float dy = abs(vUv.y - sy);
        float s = exp(-pow(dy / 0.0022, 2.0)) * 0.55 + exp(-dy / 0.014) * 0.16 + exp(-dy / 0.06) * 0.05;
        s *= smoothstep(0.25, 0.5, abs(vUv.x - 0.5));
        c += c0 * 0.35 * exp(-length((vUv - vec2(0.08, 0.62)) * vec2(1.6, 1.0)) / 0.25);   // lighter haze, left
        o = vec4((c + sc * s * streak) * fade, 1.0); }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // Ring plane
  const plane = new THREE.Group();
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);
  const S = Math.round(5120 * ts);
  const ringC = makeCanvas(S, S);
  drawRings(ringC.ctx, S, p);
  const ringTex = canvasTexture(ringC.canvas, env.gl);

  const ringMats: THREE.ShaderMaterial[] = [];
  const ringMeshes = RINGS.map((R, i) => {
    const geo = new THREE.RingGeometry(R.rin, R.rout, 384, 2);
    const pos = geo.getAttribute("position");
    const uv = geo.getAttribute("uv");
    for (let v = 0; v < pos.count; v++) uv.setXY(v, pos.getX(v) / (2 * RMAX) + 0.5, pos.getY(v) / (2 * RMAX) + 0.5);
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { map: { value: ringTex }, reveal: { value: 0 }, a0: { value: hash01(i, 3) * TAU }, gain: { value: 1 } },
      vertexShader: `out vec2 vUv; out vec2 vP; void main(){ vUv=uv; vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; in vec2 vP; out vec4 o; uniform sampler2D map; uniform float reveal, a0, gain;
        void main(){ vec4 c = texture(map, vUv);
          float a = fract((atan(vP.y, vP.x) - a0) / 6.2831853);
          float vis = 1.0 - smoothstep(reveal - 0.02, reveal, a);
          float al = c.a * vis * gain;
          if (al < 0.05) discard;
          o = vec4(c.rgb * al * 0.68, 1.0); }`,
    });
    ringMats.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.renderOrder = 1;
    plane.add(mesh);
    return mesh;
  });

  // Orange accent blocks riding on rings
  const orangeMat = (seed: number) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(p.accent).multiplyScalar(1.15), transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide, name: String(seed) });
  const oranges = ORANGE.map((o) => {
    const R = RINGS[o.ring];
    const g = new THREE.Group();
    const m = orangeMat(o.seed);
    for (let k = 0; k < o.n; k++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.6), m);
      const a = o.ang + k * 0.045;
      const rr = (R.rin + R.rout) / 2;
      q.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.01);
      q.rotation.z = a;
      g.add(q);
    }
    ringMeshes[o.ring].add(g);
    return { o, m };
  });

  // Lock (upright, faces the camera)
  const LW = 3.3;
  const LH = 3.14;
  const lockC = makeCanvas(1024 * Math.max(ts, 0.75), 973 * Math.max(ts, 0.75));
  drawLock(lockC.ctx, lockC.canvas.width, lockC.canvas.height, p);
  const lockMat = layerMaterial(canvasTexture(lockC.canvas, env.gl), { depthWrite: true });
  const lock = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), lockMat);
  lock.position.set(0, 1.75, 0);
  lock.renderOrder = 5;
  lock.rotation.y = -0.55;
  scene.add(lock);
  // soft glow card behind the lock
  const lockGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { col: { value: hexVec(p.lockA) }, k: { value: 0 } },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform vec3 col; uniform float k;
        void main(){ vec2 q = vUv - vec2(0.5, 0.5); float r = length(q*vec2(1.0,0.85))*4.0;
          vec2 b = (vUv - vec2(0.5, 0.115)) * vec2(4.0, 4.0); float flare = exp(-dot(b,b)/0.004) * 2.5 + exp(-abs(b.y)/0.02) * exp(-abs(b.x)/0.5) * 0.4;
          o = vec4(col * (exp(-r/0.6) * 0.3 + flare) * k, 1.0);} `,
    }),
  );
  lockGlow.position.set(0, 1.85, 0.1);
  lockGlow.rotation.y = -0.55;
  scene.add(lockGlow);

  // Inner HUD (gauges, icons) — upright plane just behind the lock
  const IW = 11.5;
  const IH = 4.7;
  const innerC = makeCanvas(1600 * Math.max(ts, 0.6), 650 * Math.max(ts, 0.6));
  const innerTex = canvasTexture(innerC.canvas, env.gl);
  const innerMat = layerMaterial(innerTex, { additive: true });
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), innerMat);
  inner.position.set(0, 1.8, -0.3);
  inner.renderOrder = 4;
  scene.add(inner);

  // Cards
  const cards = CARDS.map((def) => {
    const cw = Math.round(CARD_W * Math.max(ts, 0.6));
    const ch = Math.round((cw * def.h) / def.w);
    const c = makeCanvas(cw, ch);
    const tex = canvasTexture(c.canvas, env.gl);
    const m = layerMaterial(tex, { additive: true, depthWrite: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.h), m);
    // place on the ring plane (x right, z toward camera), standing upright, facing the centre-ish
    const x = Math.cos(def.ang) * def.r;
    const z = -Math.sin(def.ang) * def.r;
    mesh.position.set(x, def.y, z);
    // face the (initial) camera position, with a little per-card yaw jitter
    mesh.rotation.y = Math.atan2(-8.5 - x, 8.5 - z) + (hash01(def.seed) - 0.5) * 0.6;
    mesh.renderOrder = 3;
    scene.add(mesh);
    let lastKey = "";
    return {
      def,
      mesh,
      m,
      redraw: (frame: number) => {
        // values tick on short periods; redraw only when the visible state changes
        const key = String(Math.floor(frame / 5));
        if (key === lastKey) return;
        lastKey = key;
        drawCard(c.ctx, cw, ch, def, Math.floor(frame / 5) * 5, p);
        tex.needsUpdate = true;
      },
    };
  });

  let innerKey = "";

  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.6,
      bloomThreshold: 0.6,
      bloomKnee: 0.3,
      bloomRadius: 0.8,
      vignette: 0.45,
      dof: { focus: 12.9, range: 2.0, ramp: 5, maxNear: 0.013, maxFar: 0.009 },
    },
    update: (frame, post) => {
      const sec = frame / 30;
      // Camera: slow push during build-in, then a slow drift (orbit + rise).
      const build = easeOutCubic((frame - 45) / 90);
      const drift = clamp((frame - 120) / 480);
      const az = -0.75 + 0.14 * Math.sin(drift * Math.PI * 0.9) + 0.06 * (1 - build);
      const el = 0.5 + 0.03 * Math.sin(drift * Math.PI) - 0.03 * (1 - build);
      const dist = 18.6 + 1.8 * (1 - build) - 0.5 * drift;
      camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
      const roll = 0.1 - 0.03 * drift;
      camera.up.set(Math.sin(roll) * Math.cos(az), Math.cos(roll), -Math.sin(roll) * Math.sin(az));
      camera.lookAt(0.3 * Math.cos(az), 0.3, -0.3 * Math.sin(az));
      camera.updateMatrixWorld();
      if (post.opts.dof) post.opts.dof.focus = camera.position.distanceTo(lock.position);

      bgMat.uniforms.fade.value = smoothstep(30, 80, frame);
      bgMat.uniforms.streak.value = smoothstep(60, 110, frame) * (0.85 + 0.15 * Math.sin(sec * 1.3));
      // project the lock height to place the streak
      const lp = new THREE.Vector3(0, 1.2, 0).project(camera);
      bgMat.uniforms.sy.value = lp.y * 0.5 + 0.5;

      RINGS.forEach((R, i) => {
        const start = 45 + i * 5;
        ringMats[i].uniforms.reveal.value = easeOutQuint((frame - start) / 45) * 1.03;
        ringMats[i].uniforms.gain.value = smoothstep(start, start + 12, frame);
        ringMeshes[i].rotation.z = ((R.speed * Math.PI) / 180) * sec;
      });
      oranges.forEach(({ o, m }) => {
        const ph = Math.floor((frame + (o.seed % 97)) / o.period);
        const on = hash01(ph, o.seed) > 0.4 ? 1 : 0.0;
        m.opacity = on * smoothstep(100, 120, frame);
      });

      const lockIn = smoothstep(60, 110, frame);
      lockMat.uniforms.opacity.value = lockIn;
      lockMat.uniforms.gain.value = 0.85 + 0.08 * Math.sin(sec * 2.1);
      (lockGlow.material as THREE.ShaderMaterial).uniforms.k.value = lockIn * (0.9 + 0.1 * Math.sin(sec * 2.1));
      inner.quaternion.copy(camera.quaternion);
      innerMat.uniforms.opacity.value = smoothstep(80, 115, frame);
      const ik = String(Math.floor(frame / 3));
      if (ik !== innerKey) {
        innerKey = ik;
        drawInner(innerC.ctx, innerC.canvas.width, innerC.canvas.height, Math.floor(frame / 3) * 3, p);
        innerTex.needsUpdate = true;
      }

      cards.forEach((c, j) => {
        const st = 70 + j * 3;
        const k = easeOutCubic((frame - st) / 30);
        c.m.uniforms.opacity.value = k;
        c.m.uniforms.gain.value = 0.8;
        c.mesh.position.y = c.def.y - 1.2 * (1 - k);
        c.redraw(frame);
      });
    },
  };
};
