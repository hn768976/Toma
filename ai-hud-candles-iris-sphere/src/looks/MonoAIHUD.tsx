import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Land, landMask, useAssets } from "../lib/assets";
import { CanvasTex, makeCanvasTex, redraw } from "../lib/canvasTex";
import { easeInOutSine, progress, smooth } from "../lib/ease";
import { DOF_TEXTURE, DOF_UNIFORMS, HASH } from "../lib/glsl";
import { premulBlend, STD_VERT } from "../lib/mesh";
import { PostParams } from "../lib/post";
import { digits, hash, mulberry32 } from "../lib/random";
import { makeShared, Shared, Stage } from "../lib/Stage";

// Look 2 — Mono AI HUD. A graphite interface on a plane tilted ~45°:
// raised "AI" chip, turning wireframe/dot globe, "BIG DATA" panels with
// ticking numbers, mint bar meters. Build-in 1.5–4s, then live hold.

export type HudPalette = {
  light: boolean; // light interface (dark ink on an off-white plate)
  bg: string; // plate
  panel: string; // panel fill (light theme)
  white: string; // primary text / highlights
  grey: string; // secondary text
  line: string; // neutral line work (alpha applied per element)
  mint: string; // bar meters
  trace: string; // chip circuit traces
  traceDot: string; // trace terminals
  accent: string; // small bullets / markers
  amber: string; // tiny warm ticks
};

const hexA = (hex: string, a: number) => {
  const c = new THREE.Color(hex);
  c.convertLinearToSRGB();
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};

const lin = (hex: string) => new THREE.Color(hex);

const TW = 8192;
const TH = 4608;
const PW = 20; // plane width in units
const PH = (PW * TH) / TW;
const PX = TW / PW; // texture px per unit
// chip position on the texture (px)
const CHIP_X = 3900;
const CHIP_Y = 3150;
const CHIP_PX = 470;

type Rect = { x: number; y: number; w: number; h: number };
type Dyn = { rect: Rect; kind: "bigdata" | "num2" | "num4" | "pair"; seed: number; delay: number };
type Meter = { rect: Rect; bars: number; seed: number; delay: number; vertical: boolean };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---------- static HUD texture ----------


const buildHud = (pal: HudPalette) => {
  const rnd = mulberry32(7301);
  const base = makeCanvasTex(TW, TH, true);
  const delayTex = makeCanvasTex(512, 288, false, false);
  delayTex.tex.minFilter = delayTex.tex.magFilter = THREE.NearestFilter;
  const dyn: Dyn[] = [];
  const meters: Meter[] = [];

  const chipZone: Rect = { x: CHIP_X - 900, y: CHIP_Y - 620, w: 1800, h: 1240 };
  const globeZone: Rect = { x: CHIP_X - 3050, y: CHIP_Y - 1250, w: 1700, h: 1100 };

  // hand-placed key panels around the chip (match the reference's layout)
  const bigData: Rect = { x: CHIP_X + 1000, y: CHIP_Y - 420, w: 1500, h: 760 };
  dyn.push({ rect: { x: bigData.x, y: bigData.y, w: 1500, h: 560 }, kind: "bigdata", seed: 1, delay: 0.35 });
  meters.push({ rect: { x: bigData.x + 1550, y: bigData.y + 80, w: 600, h: 520 }, bars: 7, seed: 3, delay: 0.5, vertical: false });
  dyn.push({ rect: { x: CHIP_X + 1250, y: CHIP_Y - 1000, w: 1400, h: 220 }, kind: "pair", seed: 5, delay: 0.3 });
  dyn.push({ rect: { x: CHIP_X - 300, y: CHIP_Y - 1700, w: 1500, h: 220 }, kind: "num4", seed: 7, delay: 0.2 });
  dyn.push({ rect: { x: CHIP_X - 1650, y: CHIP_Y - 650, w: 300, h: 200 }, kind: "num2", seed: 9, delay: 0.25 });
  dyn.push({ rect: { x: CHIP_X - 300, y: CHIP_Y + 950, w: 300, h: 200 }, kind: "num2", seed: 11, delay: 0.4 });
  dyn.push({ rect: { x: CHIP_X - 1350, y: CHIP_Y + 450, w: 300, h: 200 }, kind: "num2", seed: 13, delay: 0.45 });
  dyn.push({ rect: { x: CHIP_X - 2850, y: CHIP_Y - 900, w: 700, h: 220 }, kind: "pair", seed: 15, delay: 0.3 });
  dyn.push({ rect: { x: CHIP_X + 2950, y: CHIP_Y - 1300, w: 1100, h: 220 }, kind: "pair", seed: 17, delay: 0.5 });
  dyn.push({ rect: { x: CHIP_X + 500, y: CHIP_Y + 1250, w: 1300, h: 450 }, kind: "bigdata", seed: 19, delay: 0.55 });
  meters.push({ rect: { x: CHIP_X + 2900, y: CHIP_Y - 950, w: 700, h: 420 }, bars: 6, seed: 21, delay: 0.45, vertical: false });
  meters.push({ rect: { x: 600, y: CHIP_Y + 300, w: 500, h: 380 }, bars: 5, seed: 23, delay: 0.6, vertical: false });
  meters.push({ rect: { x: CHIP_X + 2300, y: CHIP_Y + 1000, w: 800, h: 500 }, bars: 9, seed: 25, delay: 0.6, vertical: true });

  const analysis: Rect = { x: CHIP_X + 1350, y: CHIP_Y - 1450, w: 1500, h: 380 };
  const reserved: Rect[] = [chipZone, globeZone, analysis, ...dyn.map((d) => d.rect), ...meters.map((m) => m.rect)];

  // free panels: subdivide the texture into cells and fill the free ones
  const panels: { r: Rect; delay: number }[] = [];
  const split = (r: Rect, depth: number) => {
    if (depth > 10 || (r.w < 760 && r.h < 480) || (r.w < 1200 && r.h < 760 && rnd() < 0.3)) {
      panels.push({ r, delay: rnd() });
      return;
    }
    if (r.w / r.h > 1.4 || (r.w / r.h > 0.7 && rnd() < 0.5)) {
      const s = r.w * (0.3 + rnd() * 0.4);
      split({ x: r.x, y: r.y, w: s, h: r.h }, depth + 1);
      split({ x: r.x + s, y: r.y, w: r.w - s, h: r.h }, depth + 1);
    } else {
      const s = r.h * (0.3 + rnd() * 0.4);
      split({ x: r.x, y: r.y, w: r.w, h: s }, depth + 1);
      split({ x: r.x, y: r.y + s, w: r.w, h: r.h - s }, depth + 1);
    }
  };
  split({ x: 40, y: 40, w: TW - 80, h: TH - 80 }, 0);

  const white = pal.white;
  const grey = pal.grey;
  const ink = (a: number) => hexA(pal.line, a);
  redraw(base, "static", (ctx) => {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, TW, TH);
    // faint large grid
    ctx.strokeStyle = ink(0.10);
    ctx.lineWidth = 2;
    for (let x = 0; x < TW; x += 256) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TH);
      ctx.stroke();
    }
    for (let y = 0; y < TH; y += 256) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(TW, y);
      ctx.stroke();
    }

    const mono = (px: number, w = 400) => `${w} ${px}px 'JetBrains Mono'`;
    for (const p of panels) {
      const r = { x: p.r.x + 30, y: p.r.y + 30, w: p.r.w - 60, h: p.r.h - 60 };
      if (r.w < 120 || r.h < 80) continue;
      if (reserved.some((z) => overlaps(z, r))) {
        // keep the edges near reserved areas sparse: a few rules only
        if (rnd() < 0.5) {
          ctx.strokeStyle = ink(0.25);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + r.w * 0.4, r.y);
          ctx.stroke();
        }
        continue;
      }
      const tr = rnd();
      const type = tr < 0.45 ? 0 : tr < 0.72 ? 1 : 2 + Math.floor(((tr - 0.72) / 0.28) * 5);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      // panel frame: thin full border, corner brackets
      ctx.strokeStyle = ink(0.22);
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - 15, r.y - 15, r.w + 30, r.h + 30);
      ctx.strokeStyle = ink(0.35);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + 40);
      ctx.lineTo(r.x, r.y);
      ctx.lineTo(r.x + 40, r.y);
      ctx.moveTo(r.x + r.w - 40, r.y + r.h);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.lineTo(r.x + r.w, r.y + r.h - 40);
      ctx.stroke();
      if (pal.light) {
        ctx.fillStyle = pal.panel;
        ctx.fillRect(r.x - 15, r.y - 15, r.w + 30, r.h + 30);
      } else if (rnd() < 0.25) {
        ctx.fillStyle = "rgba(140,148,156,0.05)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      if (type === 0) {
        // column text block
        const fs = 19 + Math.floor(rnd() * 8);
        ctx.font = mono(fs);
        const cols = Math.max(1, Math.floor(r.w / 300));
        for (let c = 0; c < cols; c++) {
          for (let y = r.y + 60; y < r.y + r.h - 10; y += fs * 1.35) {
            ctx.fillStyle = rnd() < 0.3 ? white : grey;
            const n = 4 + Math.floor(rnd() * 14);
            ctx.fillText(digits(n, 71, c, y, r.x), r.x + 20 + c * 300, y);
          }
        }
      } else if (type === 1) {
        // header + rows of label/value
        ctx.font = mono(40, 500);
        ctx.fillStyle = white;
        ctx.fillText(`${digits(2, 77, r.x)}.${digits(4, 77, r.y)}`, r.x + 20, r.y + 70);
        ctx.font = mono(24);
        for (let y = r.y + 130; y < r.y + r.h - 10; y += 40) {
          ctx.fillStyle = grey;
          ctx.fillText(digits(8, 78, r.x, y), r.x + 20, y);
          ctx.fillStyle = rnd() < 0.3 ? white : grey;
          ctx.fillText(digits(6, 73, y, r.x), r.x + r.w * 0.6, y);
          if (rnd() < 0.08) {
            ctx.fillStyle = pal.amber;
            ctx.fillRect(r.x + r.w - 40, y - 18, 10, 20);
          }
        }
      } else if (type === 2) {
        // static grey bars
        const n = Math.floor(r.h / 50);
        for (let i = 0; i < n; i++) {
          const w = (0.2 + rnd() * 0.75) * (r.w - 60);
          ctx.fillStyle = i % 3 === 0 ? hexA(pal.white, 0.65) : ink(0.6);
          ctx.fillRect(r.x + 30, r.y + 40 + i * 50, w, 22);
        }
      } else if (type === 3) {
        // button cluster: rows of small keys with a lit dot
        for (let y = r.y + 40; y < r.y + r.h - 50; y += 70) {
          for (let x = r.x + 30; x < r.x + r.w - 140; x += 160) {
            ctx.strokeStyle = ink(0.5);
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, 130, 46);
            ctx.fillStyle = rnd() < 0.3 ? white : ink(0.6);
            ctx.beginPath();
            ctx.arc(x + 24, y + 23, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = mono(18);
            ctx.fillText(digits(4, 81, x, y), x + 44, y + 30);
          }
        }
      } else if (type === 4) {
        // dot matrix
        for (let y = r.y + 30; y < r.y + r.h - 20; y += 22) {
          for (let x = r.x + 30; x < r.x + r.w - 20; x += 22) {
            const k = rnd();
            ctx.fillStyle = k > 0.93 ? white : ink(0.25 + k * 0.3);
            ctx.fillRect(x, y, 7, 7);
          }
        }
      } else if (type === 5) {
        // big static number + caption
        ctx.font = `600 ${Math.min(150, r.h * 0.5)}px Rajdhani`;
        ctx.fillStyle = white;
        ctx.fillText(digits(2 + Math.floor(rnd() * 3), 75, r.x, r.y), r.x + 30, r.y + Math.min(170, r.h * 0.6));
        ctx.font = mono(22);
        ctx.fillStyle = grey;
        ctx.fillText(digits(12, 76, r.x, r.y), r.x + 30, r.y + Math.min(230, r.h * 0.8));
      } else {
        // small blocks + icons
        for (let i = 0; i < 6; i++) {
          const x = r.x + 30 + rnd() * (r.w - 120);
          const y = r.y + 40 + rnd() * (r.h - 100);
          ctx.fillStyle = rnd() < 0.25 ? white : ink(0.5);
          ctx.fillRect(x, y, 30 + rnd() * 90, 12 + rnd() * 18);
        }
        if (rnd() < 0.4) {
          ctx.fillStyle = pal.mint;
          ctx.fillRect(r.x + 30, r.y + r.h - 50, 40, 14);
        }
      }
      ctx.restore();
    }

    // chip surround: fine dot field and circuit traces with mint terminals
    const cx = CHIP_X;
    const cy = CHIP_Y;
    // square mesh pad
    const pad = 620;
    ctx.fillStyle = pal.light ? pal.panel : "rgba(4,5,6,0.9)";
    ctx.fillRect(cx - pad, cy - pad, pad * 2, pad * 2);
    for (let y = -pad; y <= pad; y += 16) {
      for (let x = -pad; x <= pad; x += 16) {
        const e = Math.max(Math.abs(x), Math.abs(y)) / pad;
        const a = 0.28 * (1 - Math.pow(e, 3));
        ctx.fillStyle = ink(a);
        ctx.fillRect(cx + x - 2.5, cy + y - 2.5, 5, 5);
      }
    }
    const half = CHIP_PX / 2;
    const trnd = mulberry32(7411);
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let side = 0; side < 4; side++) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const s = -half * 0.8 + (i / (n - 1)) * half * 1.6;
        const o1 = 30 + trnd() * 80;
        const jog = (Math.sign(s) || 1) * (20 + trnd() * 70);
        const run = 40 + trnd() * 150;
        const pts: [number, number][] = [
          [s, half],
          [s, half + o1],
          [s + jog, half + o1],
          [s + jog, half + o1 + run],
        ];
        const rot = ([x, y]: [number, number]): [number, number] =>
          side === 0 ? [cx + x, cy - y] : side === 1 ? [cx + y, cy + x] : side === 2 ? [cx - x, cy + y] : [cx - y, cy - x];
        const P = pts.map(rot);
        ctx.strokeStyle = hexA(pal.trace, 0.95);
        ctx.beginPath();
        P.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        const [ex, ey] = P[P.length - 1];
        ctx.fillStyle = trnd() < 0.6 ? pal.traceDot : white;
        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // soft shadow under the raised chip
    const sh = ctx.createRadialGradient(cx + 40, cy + 60, 50, cx + 40, cy + 60, 520);
    sh.addColorStop(0, pal.light ? hexA(pal.line, 0.3) : "rgba(0,0,0,0.85)");
    sh.addColorStop(1, pal.light ? hexA(pal.line, 0) : "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(cx - 600, cy - 600, 1300, 1300);
    // ANALYSIS DATA panel (static filler)
    ctx.fillStyle = white;
    ctx.font = "500 64px Rajdhani";
    ctx.fillText("ANALYSIS DATA N", analysis.x + 60, analysis.y + 80);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(analysis.x + 10, analysis.y + 130, 22, 22);
    ctx.fillStyle = white;
    ctx.font = "500 56px Rajdhani";
    ctx.fillText("Data Sector : 001", analysis.x + 60, analysis.y + 160);
    ctx.fillStyle = pal.amber;
    ctx.fillRect(analysis.x + 560, analysis.y + 125, 12, 36);
    ctx.font = "400 26px 'JetBrains Mono'";
    ctx.fillStyle = grey;
    for (let k = 0; k < 4; k++) ctx.fillText(digits(28, 91, k), analysis.x + 60, analysis.y + 220 + k * 36);
    // globe ring on the plate
    ctx.strokeStyle = ink(0.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(globeZone.x + 850, globeZone.y + 550, 600, 600, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // delay map: R = reveal delay (0..1) per panel
  redraw(delayTex, "static", (ctx) => {
    const sx = 512 / TW;
    const sy = 288 / TH;
    ctx.fillStyle = "rgb(40,0,0)";
    ctx.fillRect(0, 0, 512, 288);
    for (const p of panels) {
      ctx.fillStyle = `rgb(${Math.round(p.delay * 220)},0,0)`;
      ctx.fillRect(p.r.x * sx, p.r.y * sy, p.r.w * sx, p.r.h * sy);
    }
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(chipZone.x * sx, chipZone.y * sy, chipZone.w * sx, chipZone.h * sy);
  });
  return { base, delayTex, dyn, meters, globeZone };
};

// ---------- materials ----------

// Theme uniforms shared by the HUD materials. uLight = 0 keeps the graphite
// formulas exactly; uLight = 1 switches to dark ink on a light plate.
type Theme = {
  uLight: THREE.IUniform<number>;
  uBg: THREE.IUniform<THREE.Color>;
  uPanel: THREE.IUniform<THREE.Color>;
  uInk: THREE.IUniform<THREE.Color>;
};
const makeTheme = (pal: HudPalette): Theme => ({
  uLight: { value: pal.light ? 1 : 0 },
  uBg: { value: lin(pal.bg) },
  uPanel: { value: lin(pal.panel) },
  uInk: { value: lin(pal.white) },
});

const hudMaterial = (shared: Shared, th: Theme, map: THREE.Texture, delay: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, ...th, tMap: { value: map }, tDelay: { value: delay }, uReveal: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap, tDelay; uniform float uReveal, uLight; uniform vec3 uBg;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      void main() {
        vec4 c = dofTexture(tMap, vUv, cocFrac(vDepth) * uRes.y);
        float d = texture(tDelay, vUv).r / 0.8627;
        float on = smoothstep(d * 0.75, d * 0.75 + 0.25, uReveal);
        // flicker as panels arrive
        float fl = 1.0 - 0.5 * step(0.5, hash33u(uvec3(uvec2(vUv * 40.0), uint(uReveal * 60.0))).x) * (1.0 - smoothstep(0.0, 0.08, uReveal - d * 0.75 - 0.25)) * step(d * 0.75, uReveal);
        // fade to black at the plate's far edges
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        // graphite fades up from black; the light theme fades up from its plate
        vec3 col = uLight > 0.5 ? mix(uBg, c.rgb, on * fl * edge) : c.rgb * on * fl * edge;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

const overlayMaterial = (shared: Shared, th: Theme, map: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, ...th, tMap: { value: map }, uOpacity: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform float uOpacity, uLight;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      void main() {
        vec4 c = dofTexture(tMap, vUv, cocFrac(vDepth) * uRes.y);
        // white text glows a little on graphite; dark ink stays flat on light
        gl_FragColor = c * uOpacity * vec4(vec3(uLight > 0.5 ? 1.0 : 1.25), 1.0);
      }`,
    ...premulBlend,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

const meterMaterial = (shared: Shared, th: Theme, mint: THREE.Color, bars: number, seed: number, vertical: boolean) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, ...th, uMint: { value: mint }, uBars: { value: bars }, uSeed: { value: seed }, uVertical: { value: vertical ? 1 : 0 }, uOpacity: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uMint, uPanel; uniform float uBars, uSeed, uVertical, uOpacity, uTime, uLight;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      void main() {
        vec2 uv = uVertical > 0.5 ? vec2(1.0 - vUv.y, vUv.x) : vec2(vUv.x, 1.0 - vUv.y);
        float i = floor(uv.y * uBars);
        float fy = fract(uv.y * uBars);
        float n = vnoise(vec2(uTime * 0.9 + i * 3.1, uSeed + i));
        float len = 0.25 + 0.7 * n;
        // soften edges by the circle of confusion (in uv units)
        float coc = cocFrac(vDepth) * uRes.y;
        vec2 fw = fwidth(uv) * (1.0 + coc);
        float bx = 1.0 - smoothstep(len - fw.x, len + fw.x, uv.x);
        float hb = 0.32;
        float by = smoothstep(0.5 - hb - fw.y * uBars, 0.5 - hb + fw.y * uBars, fy) * (1.0 - smoothstep(0.5 + hb - fw.y * uBars, 0.5 + hb + fw.y * uBars, fy));
        float track = by * 0.12;
        float a = max(bx * by, track);
        vec3 col = uLight > 0.5
          ? mix(uPanel * 0.8, uMint, step(track + 0.001, bx * by))
          : mix(vec3(0.25), uMint * 1.4, step(track + 0.001, bx * by));
        gl_FragColor = vec4(col * a, a) * uOpacity;
      }`,
    ...premulBlend,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

// ---------- dynamic overlay drawing ----------

const drawDyn = (ct: CanvasTex, d: Dyn, frame: number, pal: HudPalette) => {
  const period = d.kind === "num2" ? 9 : d.kind === "bigdata" ? 5 : 7;
  const step = Math.floor((frame + d.seed * 3) / period);
  redraw(ct, step, (ctx) => {
    const W = ct.canvas.width;
    const H = ct.canvas.height;
    ctx.fillStyle = pal.white;
    if (d.kind === "num2") {
      ctx.font = "600 150px Rajdhani";
      ctx.fillText(digits(2, d.seed, step), 20, H * 0.75);
    } else if (d.kind === "num4") {
      ctx.font = "600 140px Rajdhani";
      ctx.fillText(`${digits(4, d.seed, step)}  ${digits(4, d.seed + 1, step)}  ${digits(2, d.seed + 2, step)}`, 10, H * 0.72);
    } else if (d.kind === "pair") {
      ctx.font = "600 130px Rajdhani";
      ctx.fillText(`${digits(4, d.seed, step)}  ${digits(2, d.seed + 1, step)}`, 10, H * 0.72);
      ctx.beginPath();
      ctx.arc(W - 40, H * 0.35, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // BIG DATA block
      ctx.fillStyle = pal.white;
      ctx.beginPath();
      ctx.arc(30, 70, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "600 120px Rajdhani";
      ctx.fillText("BIG DATA:", 80, 110);
      ctx.font = "500 130px Rajdhani";
      ctx.fillText(`${digits(4, d.seed, step)} ${digits(6, d.seed + 1, step)}`, 180, 250);
      ctx.font = "400 40px 'JetBrains Mono'";
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = r === 1 ? pal.white : pal.grey;
        const y = 330 + r * 58;
        if (y > H - 10) break;
        ctx.fillText(`${digits(4, d.seed, r, step)}  ${digits(2, d.seed, r)}  ${digits(3, d.seed + 2, r, step)}  ${digits(10, d.seed + 3, r)}`, 120, y);
        // cyan triangle bullets
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.moveTo(56, y - 28);
        ctx.lineTo(84, y - 14);
        ctx.lineTo(56, y);
        ctx.fill();
      }
      ctx.strokeStyle = hexA(pal.line, 0.6);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(60, 150);
      ctx.lineTo(60, H - 20);
      ctx.stroke();
      // cursor tag
      if (hash(d.seed, step) > 0.5) {
        ctx.fillStyle = pal.amber;
        ctx.fillRect(W - 60, H - 100, 14, 40);
      }
    }
  });
};

// ---------- chip & globe ----------

const chipFace = () => {
  const ct = makeCanvasTex(1024, 1024, false);
  redraw(ct, "static", (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = "#fff";
    ctx.font = "700 470px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AI", 512, 530);
  });
  return ct;
};

const chipMesh = (shared: Shared, th: Theme, size: number) => {
  const r = size * 0.12;
  const s = new THREE.Shape();
  const h = size / 2;
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: size * 0.025, bevelEnabled: true, bevelThickness: size * 0.025, bevelSize: size * 0.025, bevelSegments: 4, curveSegments: 10 });
  const face = chipFace();
  const m = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...th, tFace: { value: face.tex }, uSize: { value: size }, uTop: { value: size * 0.05 }, uOn: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uSize;
      varying vec2 vFace; varying vec3 vN; varying float vZ; varying vec3 vView;
      void main() {
        vFace = position.xy / uSize + 0.5;
        vZ = position.z;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tFace; uniform float uTop, uOn, uLight; uniform vec3 uInk;
      varying vec2 vFace; varying vec3 vN; varying float vZ; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN);
        float top = smoothstep(uTop - 0.004, uTop, vZ);
        // brushed silver: gradient + soft specular
        vec3 base = mix(vec3(0.55), vec3(0.92), smoothstep(0.0, 1.0, vFace.y * 0.6 + vFace.x * 0.4));
        vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
        float spec = pow(max(dot(reflect(-L, n), vView), 0.0), 18.0);
        float txt = texture(tFace, vFace).r;
        vec3 topCol = base * 1.05 + spec * 0.4;
        topCol = mix(topCol, vec3(0.03), txt * top);
        vec3 side = vec3(0.32) * (0.5 + 0.5 * max(dot(n, L), 0.0)) + spec * 0.3;
        vec3 col = mix(side, topCol, top);
        if (uLight > 0.5) {
          // light theme: white face, charcoal "AI", charcoal outline and walls
          float e = min(min(vFace.x, 1.0 - vFace.x), min(vFace.y, 1.0 - vFace.y));
          float outline = 1.0 - smoothstep(0.012, 0.022, e);
          vec3 face = mix(vec3(0.97), uInk, txt);
          face = mix(face, uInk, outline);
          vec3 wall = mix(uInk, vec3(0.45), 0.35) * (0.7 + 0.3 * max(dot(n, L), 0.0));
          col = mix(wall, face, top);
          gl_FragColor = vec4(col * uOn, uOn);
          return;
        }
        gl_FragColor = vec4(col * 1.15 * uOn, uOn);
      }`,
    ...premulBlend,
    depthWrite: true,
  });
  return new THREE.Mesh(g, m);
};

const globeMesh = (shared: Shared, th: Theme, land: Land) => {
  const W = 2048;
  const H = 1024;
  const mask = landMask(land, W, H);
  const ct = makeCanvasTex(W, H, false);
  const rnd = mulberry32(8811);
  redraw(ct, "static", (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const l = mask(x / W, y / H);
        const k = rnd();
        if (l) {
          ctx.fillStyle = `rgb(${Math.round(150 + 105 * k)},0,0)`;
          ctx.fillRect(x, y, 3, 3);
        } else if (k > 0.82) {
          ctx.fillStyle = `rgb(${Math.round(40 + 40 * k)},0,0)`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  });
  ct.tex.wrapS = THREE.RepeatWrapping;
  const m = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...th, tLand: { value: ct.tex }, uRot: { value: 0 }, uOn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vP; varying vec3 vN; varying vec3 vView; varying float vDepth;
      void main() {
        vP = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tLand; uniform float uRot, uOn, uLight; uniform vec3 uInk, uPanel;
      varying vec3 vP; varying vec3 vN; varying vec3 vView; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      void main() {
        vec3 p = normalize(vP);
        // polar axis lies along the plate, so the camera sees the continents
        float lon = atan(p.x, p.z) + uRot;
        float lat = asin(clamp(p.y, -1.0, 1.0));
        vec2 uv = vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.14159265);
        float coc = cocFrac(vDepth) * uRes.y;
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        if (abs(dx.x) > 0.5) dx.x = 0.0;
        if (abs(dy.x) > 0.5) dy.x = 0.0;
        float k = 1.0 + coc * 0.5;
        float land = textureGrad(tLand, uv, dx * k, dy * k).r;
        vec3 n = normalize(vN);
        float ndv = max(dot(n, normalize(vView)), 0.0);
        float light = 0.45 + 0.55 * max(dot(n, normalize(vec3(-0.5, 0.4, 0.75))), 0.0);
        vec3 col = vec3(0.04) + vec3(0.5) * land * light;
        // grid lines (wireframe)
        float gl = 0.0;
        vec2 g = vec2(lon * 12.0 / 6.2831853, lat * 9.0 / 3.14159265);
        vec2 fg = abs(fract(g) - 0.5) / fwidth(g);
        gl = (1.0 - smoothstep(0.0, 1.5 + coc * 0.3, min(fg.x, fg.y))) * 0.08;
        col += vec3(gl);
        // sparkling rim
        float rim = pow(1.0 - ndv, 3.0);
        float sp = step(0.7, hash33u(uvec3(uvec2(gl_FragCoord.xy * 0.5), 3u)).x);
        col += vec3(1.3) * rim * (0.3 + 1.4 * sp);
        if (uLight > 0.5) {
          // charcoal wireframe globe on a pale disc
          col = mix(uPanel, uInk, clamp(land * light * 0.75, 0.0, 1.0));
          col = mix(col, uInk, clamp(gl * 7.0, 0.0, 1.0));
          col = mix(col, uInk, clamp(rim * (0.6 + 0.4 * sp), 0.0, 1.0));
        }
        float edgeSoft = 0.05 + coc * 0.004;
        float a = smoothstep(0.0, edgeSoft, ndv) * uOn;
        gl_FragColor = vec4(col * a, a);
      }`,
    ...premulBlend,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), m);
  return mesh;
};

// ---------- scene ----------

const build = (land: Land, pal: HudPalette) => {
  const shared = makeShared();
  const th = makeTheme(pal);
  const group = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  const hud = buildHud(pal);

  // plate: lies on the ground (XZ), texture top = far side
  const plate = new THREE.Group();
  plate.rotation.x = -Math.PI / 2;
  group.add(plate);
  const toLocal = (x: number, y: number) => new THREE.Vector3(x / PX - PW / 2, PH / 2 - y / PX, 0);

  const hudMat = hudMaterial(shared, th, hud.base.tex, hud.delayTex.tex);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), hudMat);
  base.renderOrder = -10;
  plate.add(base);

  const overlays: { ct: CanvasTex; d: Dyn; mat: THREE.ShaderMaterial }[] = [];
  for (const d of hud.dyn) {
    const ct = makeCanvasTex(Math.round(d.rect.w), Math.round(d.rect.h), true);
    const mat = overlayMaterial(shared, th, ct.tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(d.rect.w / PX, d.rect.h / PX), mat);
    mesh.position.copy(toLocal(d.rect.x + d.rect.w / 2, d.rect.y + d.rect.h / 2)).setZ(0.002);
    mesh.renderOrder = -5;
    plate.add(mesh);
    overlays.push({ ct, d, mat });
  }
  const meterMats: { mat: THREE.ShaderMaterial; delay: number }[] = [];
  for (const m of hud.meters) {
    const mat = meterMaterial(shared, th, lin(pal.mint), m.bars, m.seed, m.vertical);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(m.rect.w / PX, m.rect.h / PX), mat);
    mesh.position.copy(toLocal(m.rect.x + m.rect.w / 2, m.rect.y + m.rect.h / 2)).setZ(0.002);
    mesh.renderOrder = -5;
    plate.add(mesh);
    meterMats.push({ mat, delay: m.delay });
  }

  const chipSize = CHIP_PX / PX;
  const chip = chipMesh(shared, th, chipSize);
  chip.position.copy(toLocal(CHIP_X, CHIP_Y)).setZ(0.12);
  chip.renderOrder = 1;
  plate.add(chip);

  const globe = globeMesh(shared, th, land);
  const gz = hud.globeZone;
  globe.position.copy(toLocal(gz.x + 850, gz.y + 550)).setZ(0.3);
  globe.scale.set(1.1, 1.1, 0.34);
  globe.renderOrder = 2;
  plate.add(globe);

  const chipWorld = new THREE.Vector3();
  plate.updateMatrixWorld(true);
  chip.getWorldPosition(chipWorld);

  const update = (frame: number, fps: number) => {
    const t = frame / fps;
    shared.uTime.value = t;
    const reveal = progress(t, 1.5, 4.0);
    hudMat.uniforms.uReveal.value = reveal * 1.0;
    for (const o of overlays) {
      drawDyn(o.ct, o.d, frame, pal);
      o.mat.uniforms.uOpacity.value = smooth(progress(reveal, o.d.delay * 0.75, o.d.delay * 0.75 + 0.25));
    }
    for (const m of meterMats) m.mat.uniforms.uOpacity.value = smooth(progress(reveal, m.delay * 0.75, m.delay * 0.75 + 0.25));
    const chipOn = smooth(progress(t, 2.3, 3.1));
    (chip.material as THREE.ShaderMaterial).uniforms.uOn.value = chipOn;
    chip.position.z = 0.02 + (1 - chipOn) * 0.4;
    (globe.material as THREE.ShaderMaterial).uniforms.uOn.value = smooth(progress(t, 2.0, 3.2));
    (globe.material as THREE.ShaderMaterial).uniforms.uRot.value = t * 0.22;

    // camera: ~45° down onto the plate, slow drift
    const drift = easeInOutSine(progress(t, 0, 20));
    const yaw = THREE.MathUtils.degToRad(26 - 7 * drift);
    const pitch = THREE.MathUtils.degToRad(43 - 2 * drift);
    const dist = 8.9 - 0.55 * drift;
    const target = chipWorld.clone().add(new THREE.Vector3(0.35 - 0.25 * drift, 0, -0.1));
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(THREE.MathUtils.degToRad(5));
    camera.updateMatrixWorld();
    const focus = camera.position.distanceTo(chipWorld);
    shared.uDof.value.set(focus, 0.012, 0.012);
  };
  return { group, camera, shared, update };
};

const graphitePost: PostParams = {
  exposure: 1.0,
  bloomStrength: 1.0,
  bloomThreshold: 0.45,
  bloomKnee: 0.4,
  vignette: 0.45,
  grain: 0.015,
};
// Light theme: almost no bloom (it washes out white), no tonemap shoulder so
// the off-white plate stays at its colour, a whisper of vignette.
const lightPost: PostParams = {
  exposure: 1.0,
  bloomStrength: 0.12,
  bloomThreshold: 0.98,
  bloomKnee: 0.1,
  vignette: 0.12,
  grain: 0.015,
  tonemap: false,
};

const Scene: React.FC<{ land: Land; palette: HudPalette }> = ({ land, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const built = useMemo(() => build(land, palette), [land, palette]);
  built.update(frame, fps);
  return (
    <Stage camera={built.camera} post={palette.light ? lightPost : graphitePost} clear={palette.bg} shared={built.shared}>
      <primitive object={built.group} />
    </Stage>
  );
};

export const MonoAIHUD: React.FC<{ palette: HudPalette }> = ({ palette }) => {
  const assets = useAssets(true);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {assets?.land ? <Scene land={assets.land} palette={palette} /> : null}
    </AbsoluteFill>
  );
};
