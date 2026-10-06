import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useAssets } from "../lib/assets";
import { CanvasTex, makeCanvasTex, redraw, roundRect } from "../lib/canvasTex";
import { easeInOutSine, easeOutCubic, progress } from "../lib/ease";
import { DOF_TEXTURE, DOF_UNIFORMS, HASH } from "../lib/glsl";
import { premulBlend, STD_VERT } from "../lib/mesh";
import { PostParams } from "../lib/post";
import { digits, gaussian, hash, mulberry32 } from "../lib/random";
import { makeShared, Shared, Stage } from "../lib/Stage";

// Look 3 — Candle Dashboard. Trading panels at slightly different depths,
// tilted ~25°, strong depth of field. Candles print and scroll, gauges sweep,
// tags tick. Build-in 1.5–3.5s (panels slide in), then live hold.

export type CandlePalette = {
  bg: string;
  bgTop: string;
  panel: string;
  up: string;
  down: string;
  bar: string;
  ui: string;
  text: string;
};

const lin = (hex: string) => new THREE.Color(hex);
const PANEL_W = 4.6;
const PANEL_H = 4.4;
const TEX_W = 2048;
const TEX_H = Math.round((TEX_W * PANEL_H) / PANEL_W);

type R = { u: number; v: number; w: number; h: number }; // uv rect, v from top
type Widget =
  | { type: "candles"; r: R; seed: number; count: number; speed: number }
  | { type: "bars"; r: R; seed: number; count: number }
  | { type: "gauge"; r: R; seed: number }
  | { type: "tag"; r: R; seed: number; big: boolean }
  | { type: "rows"; r: R; seed: number }
  | { type: "area"; r: R; seed: number }
  | { type: "header"; r: R; seed: number };

// ---------- deterministic market data ----------
type OHLC = { o: number; h: number; l: number; c: number };
const series = (seed: number, n: number): OHLC[] => {
  const rnd = mulberry32(seed);
  const out: OHLC[] = [];
  let p = 0.5;
  let trend = 0;
  for (let i = 0; i < n; i++) {
    trend = trend * 0.9 + gaussian(rnd) * 0.025;
    const o = p;
    // mean-reverting walk keeps the chart inside its frame
    const c = Math.min(0.9, Math.max(0.1, o + trend + gaussian(rnd) * 0.08 + (0.5 - o) * 0.05));
    const h = Math.max(o, c) + Math.abs(gaussian(rnd)) * 0.06;
    const l = Math.min(o, c) - Math.abs(gaussian(rnd)) * 0.06;
    out.push({ o, h: Math.min(0.98, h), l: Math.max(0.02, l), c });
    p = c;
  }
  return out;
};

// ---------- layouts ----------
const layouts: Widget[][] = [
  [
    { type: "header", r: { u: 0.04, v: 0.03, w: 0.92, h: 0.06 }, seed: 1 },
    { type: "candles", r: { u: 0.04, v: 0.12, w: 0.6, h: 0.56 }, seed: 11, count: 34, speed: 0.55 },
    { type: "gauge", r: { u: 0.68, v: 0.12, w: 0.28, h: 0.27 }, seed: 12 },
    { type: "gauge", r: { u: 0.68, v: 0.42, w: 0.28, h: 0.27 }, seed: 13 },
    { type: "bars", r: { u: 0.04, v: 0.72, w: 0.6, h: 0.2 }, seed: 14, count: 22 },
    { type: "tag", r: { u: 0.68, v: 0.74, w: 0.28, h: 0.08 }, seed: 15, big: false },
    { type: "rows", r: { u: 0.68, v: 0.84, w: 0.28, h: 0.12 }, seed: 16 },
  ],
  [
    { type: "header", r: { u: 0.04, v: 0.03, w: 0.92, h: 0.06 }, seed: 2 },
    { type: "rows", r: { u: 0.04, v: 0.12, w: 0.3, h: 0.22 }, seed: 21 },
    { type: "gauge", r: { u: 0.38, v: 0.12, w: 0.24, h: 0.23 }, seed: 22 },
    { type: "tag", r: { u: 0.66, v: 0.14, w: 0.3, h: 0.12 }, seed: 23, big: true },
    { type: "candles", r: { u: 0.04, v: 0.38, w: 0.92, h: 0.42 }, seed: 24, count: 46, speed: 0.75 },
    { type: "area", r: { u: 0.04, v: 0.83, w: 0.6, h: 0.13 }, seed: 25 },
    { type: "tag", r: { u: 0.68, v: 0.86, w: 0.28, h: 0.08 }, seed: 26, big: false },
  ],
  [
    { type: "header", r: { u: 0.04, v: 0.03, w: 0.92, h: 0.06 }, seed: 3 },
    { type: "bars", r: { u: 0.04, v: 0.12, w: 0.5, h: 0.3 }, seed: 31, count: 18 },
    { type: "tag", r: { u: 0.58, v: 0.14, w: 0.38, h: 0.12 }, seed: 32, big: true },
    { type: "rows", r: { u: 0.58, v: 0.29, w: 0.38, h: 0.14 }, seed: 33 },
    { type: "candles", r: { u: 0.04, v: 0.46, w: 0.92, h: 0.5 }, seed: 34, count: 40, speed: 0.6 },
  ],
  [
    { type: "header", r: { u: 0.04, v: 0.03, w: 0.92, h: 0.06 }, seed: 4 },
    { type: "gauge", r: { u: 0.08, v: 0.12, w: 0.4, h: 0.36 }, seed: 41 },
    { type: "gauge", r: { u: 0.08, v: 0.54, w: 0.4, h: 0.36 }, seed: 42 },
    { type: "tag", r: { u: 0.54, v: 0.14, w: 0.42, h: 0.08 }, seed: 43, big: false },
    { type: "candles", r: { u: 0.54, v: 0.26, w: 0.42, h: 0.5 }, seed: 44, count: 20, speed: 0.5 },
    { type: "rows", r: { u: 0.54, v: 0.8, w: 0.42, h: 0.16 }, seed: 45 },
  ],
  [
    { type: "header", r: { u: 0.04, v: 0.03, w: 0.92, h: 0.06 }, seed: 5 },
    { type: "candles", r: { u: 0.04, v: 0.12, w: 0.92, h: 0.46 }, seed: 51, count: 42, speed: 0.65 },
    { type: "bars", r: { u: 0.04, v: 0.62, w: 0.55, h: 0.22 }, seed: 52, count: 20 },
    { type: "gauge", r: { u: 0.64, v: 0.62, w: 0.3, h: 0.3 }, seed: 53 },
    { type: "area", r: { u: 0.04, v: 0.87, w: 0.55, h: 0.09 }, seed: 54 },
  ],
];

// ---------- static panel texture ----------
const drawPanel = (ws: Widget[], pal: CandlePalette, seed: number) => {
  const ct = makeCanvasTex(TEX_W, TEX_H, true);
  const rnd = mulberry32(seed);
  const X = (u: number) => u * TEX_W;
  const Y = (v: number) => v * TEX_H;
  redraw(ct, "static", (ctx) => {
    // panel glass
    const g = ctx.createLinearGradient(0, 0, 0, TEX_H);
    g.addColorStop(0, "rgba(16,76,104,0.9)");
    g.addColorStop(1, "rgba(8,46,72,0.9)");
    ctx.fillStyle = g;
    roundRect(ctx, 6, 6, TEX_W - 12, TEX_H - 12, 26);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,200,224,0.55)";
    ctx.lineWidth = 5;
    ctx.stroke();
    const mono = (px: number) => `500 ${px}px 'JetBrains Mono'`;
    for (const w of ws) {
      const x = X(w.r.u);
      const y = Y(w.r.v);
      const W = X(w.r.w);
      const H = Y(w.r.h);
      if (w.type === "header") {
        ctx.fillStyle = "rgba(90,200,224,0.18)";
        ctx.fillRect(x, y, W, H);
        ctx.fillStyle = pal.text;
        ctx.font = `600 ${H * 0.55}px Rajdhani`;
        ctx.fillText(`DATA  ${digits(2, w.seed)}-${digits(3, w.seed, 1)}`, x + 20, y + H * 0.72);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? "rgba(90,200,224,0.7)" : "rgba(200,240,250,0.6)";
          ctx.fillRect(x + W * 0.45 + i * W * 0.085, y + H * 0.3, W * 0.06, H * 0.4);
        }
      } else if (w.type === "candles") {
        ctx.strokeStyle = "rgba(90,200,224,0.14)";
        ctx.lineWidth = 2;
        for (let i = 0; i <= 6; i++) {
          ctx.beginPath();
          ctx.moveTo(x, y + (H * i) / 6);
          ctx.lineTo(x + W, y + (H * i) / 6);
          ctx.stroke();
        }
        ctx.font = mono(22);
        ctx.fillStyle = "rgba(160,220,235,0.6)";
        for (let i = 0; i <= 6; i++) ctx.fillText(digits(4, w.seed, i), x + W - 70, y + (H * i) / 6 - 6);
        // faint area under the price
        ctx.fillStyle = "rgba(90,200,224,0.07)";
        ctx.beginPath();
        ctx.moveTo(x, y + H);
        let v = 0.5;
        for (let i = 0; i <= 40; i++) {
          v = Math.min(0.9, Math.max(0.2, v + (rnd() - 0.5) * 0.15));
          ctx.lineTo(x + (W * i) / 40, y + H * (1 - v * 0.6));
        }
        ctx.lineTo(x + W, y + H);
        ctx.fill();
      } else if (w.type === "bars") {
        ctx.strokeStyle = "rgba(90,200,224,0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, W, H);
      } else if (w.type === "gauge") {
        const cx = x + W / 2;
        const cy = y + H / 2;
        const rr = Math.min(W, H) * 0.42;
        ctx.strokeStyle = "rgba(90,200,224,0.25)";
        ctx.lineWidth = rr * 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rr * 1.18, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * rr * 1.22, cy + Math.sin(a) * rr * 1.22);
          ctx.lineTo(cx + Math.cos(a) * rr * (i % 4 ? 1.27 : 1.32), cy + Math.sin(a) * rr * (i % 4 ? 1.27 : 1.32));
          ctx.stroke();
        }
      } else if (w.type === "rows") {
        ctx.font = mono(24);
        const n = Math.floor(H / 40);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i === 0 ? pal.text : "rgba(150,210,225,0.65)";
          ctx.fillText(`${digits(3, w.seed, i)}.${digits(2, w.seed, i, 1)}`, x + 10, y + 34 + i * 40);
          ctx.fillText(`${digits(3, w.seed, i, 2)}.${digits(2, w.seed, i, 3)}`, x + W * 0.4, y + 34 + i * 40);
          ctx.fillStyle = "rgba(90,200,224,0.45)";
          ctx.fillRect(x + W * 0.75, y + 18 + i * 40, W * 0.22 * (0.3 + rnd() * 0.7), 12);
        }
      } else if (w.type === "area") {
        ctx.fillStyle = "rgba(90,200,224,0.35)";
        ctx.strokeStyle = "rgba(140,230,245,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + H);
        let v = 0.5;
        for (let i = 0; i <= 60; i++) {
          v = Math.min(0.95, Math.max(0.1, v + (rnd() - 0.5) * 0.25));
          ctx.lineTo(x + (W * i) / 60, y + H * (1 - v));
        }
        ctx.lineTo(x + W, y + H);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (w.type === "tag") {
        ctx.strokeStyle = "rgba(90,200,224,0.6)";
        ctx.lineWidth = 3;
        roundRect(ctx, x, y, W, H, 8);
        ctx.stroke();
      }
    }
    // tiny filler text along the bottom edge
    ctx.font = mono(18);
    ctx.fillStyle = "rgba(120,200,220,0.45)";
    for (let i = 0; i < 6; i++) ctx.fillText(digits(10, seed, i), 30 + i * 330, TEX_H - 22);
  });
  return ct;
};

// ---------- instanced blurred rectangles (candles, wicks, bars) ----------
// Each rect is drawn as its box convolved with a box of the CoC radius, so a
// thin wick out of focus becomes a wide, dim smear with the same energy.
const rectMaterial = (shared: Shared) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: 0 }, uClip: { value: new THREE.Vector4(-9, 9, -9, 9) } },
    vertexShader: /* glsl */ `
      attribute vec4 aRect;  // cx, cy, hw, hh (panel units)
      attribute vec4 aColor; // linear rgb, alpha
      uniform vec4 uClip;
      varying vec2 vL; varying vec2 vH; varying float vB; varying vec4 vC; varying vec2 vP;
      ${DOF_UNIFORMS}
      void main() {
        vec4 mvc = modelViewMatrix * vec4(aRect.xy, 0.0, 1.0);
        float depth = -mvc.z;
        float pxPerUnit = uRes.y * projectionMatrix[1][1] * 0.5 / depth;
        float cocPx = cocFrac(depth) * uRes.y;
        float b = max(cocPx * 0.5, 0.75) / pxPerUnit;
        vec2 ext = aRect.zw + b;
        vec2 p = aRect.xy + position.xy * ext;
        vL = position.xy * ext; vH = aRect.zw; vB = b; vC = aColor; vP = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec4 uClip;
      varying vec2 vL; varying vec2 vH; varying float vB; varying vec4 vC; varying vec2 vP;
      float cov(float x, float h, float b) { return (clamp(x + h, -b, b) - clamp(x - h, -b, b)) / (2.0 * b); }
      void main() {
        float a = cov(vL.x, vH.x, vB) * cov(vL.y, vH.y, vB);
        float clip = smoothstep(uClip.x, uClip.x + 0.12, vP.x) * (1.0 - smoothstep(uClip.y - 0.02, uClip.y, vP.x));
        a *= clip * vC.a * uOpacity;
        gl_FragColor = vec4(vC.rgb * a, a);
      }`,
    ...premulBlend,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });

const rectMesh = (shared: Shared, n: number) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aRect", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  g.instanceCount = n;
  const m = new THREE.Mesh(g, rectMaterial(shared));
  m.frustumCulled = false;
  return m;
};

const gaugeMaterial = (shared: Shared, pal: CandlePalette) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uSweep: { value: 0.5 }, uSpin: { value: 0 }, uColor: { value: lin(pal.bar) }, uOpacity: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform float uSweep, uSpin, uOpacity; uniform vec3 uColor;
      varying vec2 vUv; varying float vDepth;
      ${DOF_UNIFORMS}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0 * 1.5; // quad is 1.5x the dial so blur has room
        float r = length(p);
        float coc = cocFrac(vDepth) * uRes.y;
        float px = fwidth(r);
        float soft = px * (1.0 + coc * 0.5);
        float ang = fract(atan(p.x, p.y) / 6.2831853 + 1.0);
        float ring = smoothstep(0.86 - soft, 0.86, r) * (1.0 - smoothstep(0.9, 0.9 + soft, r));
        float arcOn = smoothstep(uSweep + 0.004, uSweep - 0.004, ang);
        float inner = smoothstep(0.58 - soft, 0.58, r) * (1.0 - smoothstep(0.62, 0.62 + soft, r));
        float a2 = fract(ang - uSpin);
        float spinArc = inner * step(a2, 0.3);
        float dotc = 1.0 - smoothstep(0.1, 0.1 + soft, r);
        float dring = smoothstep(0.16 - soft, 0.16, r) * (1.0 - smoothstep(0.2, 0.2 + soft, r));
        float a = ring * (0.3 + 0.7 * arcOn) + spinArc * 0.6 + dotc * 0.7 + dring * 0.6;
        a = min(a, 1.0) * clamp(soft / max(px, 1e-5) > 1.5 ? 1.0 / (1.0 + coc * 0.02) : 1.0, 0.3, 1.0);
        vec3 col = uColor * 1.25 * a + vec3(0.6, 1.0, 1.0) * ring * arcOn * 0.5;
        a = clamp(a, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(col * uOpacity, a);
      }`,
    ...premulBlend,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });

const panelMaterial = (shared: Shared, map: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, tMap: { value: map }, uOpacity: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform float uOpacity;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      void main() {
        vec4 c = dofTexture(tMap, vUv, cocFrac(vDepth) * uRes.y);
        gl_FragColor = c * uOpacity;
      }`,
    ...premulBlend,
  });

const bgMaterial = (pal: CandlePalette) =>
  new THREE.ShaderMaterial({
    uniforms: { uA: { value: lin(pal.bg) }, uB: { value: lin(pal.bgTop) } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uA, uB; varying vec2 vUv;
      void main() {
        vec2 q = vUv - vec2(0.5, 0.65);
        float g = exp(-dot(q, q) * 4.0);
        gl_FragColor = vec4(mix(uA * 0.6, uB, g), 1.0);
      }`,
    depthWrite: false,
  });

// ---------- scene ----------

type PanelRT = {
  group: THREE.Group;
  mats: THREE.ShaderMaterial[];
  update: (frame: number, t: number) => void;
  base: THREE.Vector3;
  delay: number;
};

const buildPanel = (shared: Shared, ws: Widget[], pal: CandlePalette, seed: number): PanelRT => {
  const group = new THREE.Group();
  const tex = drawPanel(ws, pal, seed);
  const pm = panelMaterial(shared, tex.tex);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), pm);
  plane.renderOrder = 0;
  group.add(plane);
  const mats: THREE.ShaderMaterial[] = [pm];
  const toL = (u: number, v: number) => [(u - 0.5) * PANEL_W, (0.5 - v) * PANEL_H] as const;
  const up = lin(pal.up).multiplyScalar(1.9);
  const down = lin(pal.down).multiplyScalar(1.9);
  const barC = lin(pal.bar).multiplyScalar(0.9);
  const updaters: ((frame: number, t: number) => void)[] = [];

  for (const w of ws) {
    const [x0, y0] = toL(w.r.u, w.r.v);
    const [x1, y1] = toL(w.r.u + w.r.w, w.r.v + w.r.h);
    if (w.type === "candles") {
      const data = series(w.seed * 977, 4000);
      const n = w.count + 2;
      const mesh = rectMesh(shared, n * 2);
      mesh.renderOrder = 2;
      group.add(mesh);
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uClip.value.set(x0, x1, y1, y0);
      mats.push(mat);
      const rect = mesh.geometry.getAttribute("aRect") as THREE.InstancedBufferAttribute;
      const col = mesh.geometry.getAttribute("aColor") as THREE.InstancedBufferAttribute;
      const step = (x1 - x0) / w.count;
      updaters.push((frame) => {
        // one new candle every 1/speed seconds; the newest one prints live
        const scroll = (frame / 30) * w.speed + 200;
        const k0 = Math.floor(scroll);
        const f = scroll - k0;
        for (let i = 0; i < n; i++) {
          const k = k0 - (n - 1) + i;
          const d = data[k];
          const live = i === n - 1;
          const c = live ? d.o + (d.c - d.o) * Math.min(1, f * 1.6) : d.c;
          const h = live ? Math.max(d.o, c) + (d.h - Math.max(d.o, d.c)) * Math.min(1, f * 1.3) : d.h;
          const l = live ? Math.min(d.o, c) - (Math.min(d.o, d.c) - d.l) * Math.min(1, f * 1.3) : d.l;
          // smooth scroll: the live candle slides in from the right edge while it prints
          const x = x1 - 0.5 * step - (scroll - k - 1) * step;
          const yy = (v: number) => y1 + (y0 - y1) * Math.min(0.97, Math.max(0.03, 0.5 + (v - 0.5) * 1.5));
          const isUp = c >= d.o;
          const bodyTop = yy(Math.max(d.o, c));
          const bodyBot = yy(Math.min(d.o, c));
          rect.setXYZW(i * 2, x, (bodyTop + bodyBot) / 2, step * 0.3, Math.max(0.006, (bodyTop - bodyBot) / 2));
          rect.setXYZW(i * 2 + 1, x, (yy(h) + yy(l)) / 2, step * 0.045, (yy(h) - yy(l)) / 2);
          const cc = isUp ? up : down;
          const flash = live ? 1.25 : 1;
          col.setXYZW(i * 2, cc.r * flash, cc.g * flash, cc.b * flash, 0.95);
          col.setXYZW(i * 2 + 1, cc.r, cc.g, cc.b, 0.85);
        }
        rect.needsUpdate = true;
        col.needsUpdate = true;
      });
    } else if (w.type === "bars") {
      const mesh = rectMesh(shared, w.count);
      mesh.renderOrder = 2;
      group.add(mesh);
      const mat = mesh.material as THREE.ShaderMaterial;
      mats.push(mat);
      const rect = mesh.geometry.getAttribute("aRect") as THREE.InstancedBufferAttribute;
      const col = mesh.geometry.getAttribute("aColor") as THREE.InstancedBufferAttribute;
      const step = (x1 - x0) / w.count;
      updaters.push((_f, t) => {
        for (let i = 0; i < w.count; i++) {
          const base = 0.35 + 0.4 * hash(w.seed, i);
          const v = Math.min(0.95, base + 0.18 * Math.sin(t * (0.8 + hash(w.seed, i, 1)) + i * 0.7));
          const hh = (v * (y0 - y1)) / 2;
          rect.setXYZW(i, x0 + step * (i + 0.5), y1 + hh, step * 0.32, hh);
          const hi = i % 5 === 2 ? 1.6 : 1;
          col.setXYZW(i, barC.r * hi, barC.g * hi, barC.b * hi, 0.85);
        }
        rect.needsUpdate = true;
        col.needsUpdate = true;
      });
    } else if (w.type === "gauge") {
      const size = Math.min(x1 - x0, y0 - y1) * 0.9;
      const gm = gaugeMaterial(shared, pal);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, size * 1.5), gm);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      mesh.renderOrder = 2;
      group.add(mesh);
      mats.push(gm);
      updaters.push((_f, t) => {
        gm.uniforms.uSweep.value = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.45 + w.seed));
        gm.uniforms.uSpin.value = t * (0.12 + 0.05 * hash(w.seed));
      });
    } else if (w.type === "tag") {
      const cw = Math.round(w.r.w * TEX_W);
      const ch = Math.round(w.r.h * TEX_H);
      const ct: CanvasTex = makeCanvasTex(cw, ch, true);
      const tm = panelMaterial(shared, ct.tex);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y0 - y1), tm);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      mesh.renderOrder = 3;
      tm.polygonOffset = true;
      tm.polygonOffsetFactor = -1;
      tm.polygonOffsetUnits = -6;
      group.add(mesh);
      mats.push(tm);
      updaters.push((frame) => {
        const stepK = Math.floor((frame + w.seed) / 8);
        redraw(ct, stepK, (ctx) => {
          ctx.fillStyle = pal.text;
          ctx.textBaseline = "middle";
          if (w.big) {
            ctx.font = `600 ${ch * 0.75}px Rajdhani`;
            ctx.fillText(`${(1 + hash(w.seed, stepK) * 8).toFixed(2)} %`, 16, ch * 0.55);
          } else {
            ctx.font = `600 ${ch * 0.6}px Rajdhani`;
            ctx.fillText(`TM: ${digits(6, w.seed, stepK)}`, 20, ch * 0.55);
          }
        });
      });
    }
  }
  return {
    group,
    mats,
    update: (frame, t) => updaters.forEach((u) => u(frame, t)),
    base: new THREE.Vector3(),
    delay: 0,
  };
};

const build = (pal: CandlePalette) => {
  const shared = makeShared();
  const group = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 100);

  const bg = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), bgMaterial(pal));
  bg.position.set(0, 0, -14);
  bg.renderOrder = -10;
  group.add(bg);

  // the wall of panels, turned ~25° away from the camera
  const wall = new THREE.Group();
  wall.rotation.y = THREE.MathUtils.degToRad(-25);
  group.add(wall);
  const placement = [
    { x: -9.8, y: 0.15, z: 0.5 },
    { x: -4.95, y: -0.1, z: -0.35 },
    { x: 0, y: 0.1, z: 0.25 },
    { x: 4.9, y: -0.15, z: -0.5 },
    { x: 9.8, y: 0.05, z: 0.1 },
    // second row, above and below, mostly out of focus
    { x: -7.3, y: 4.65, z: -0.2 },
    { x: -2.4, y: 4.5, z: 0.3 },
    { x: 2.5, y: 4.7, z: -0.3 },
    { x: -7.3, y: -4.6, z: 0.2 },
    { x: -2.4, y: -4.55, z: -0.25 },
    { x: 2.5, y: -4.65, z: 0.3 },
    { x: 7.4, y: -4.5, z: -0.1 },
    { x: 7.4, y: 4.6, z: 0.15 },
  ];
  const panels = placement.map((p, i) => {
    const pr = buildPanel(shared, layouts[i % layouts.length], pal, 9000 + i * 31);
    pr.base.set(p.x, p.y, p.z);
    pr.delay = hash(i, 77) * 0.6;
    wall.add(pr.group);
    return pr;
  });

  const update = (frame: number, fps: number) => {
    const t = frame / fps;
    shared.uTime.value = t;
    for (const p of panels) {
      const k = easeOutCubic(progress(t, 1.5 + p.delay, 2.9 + p.delay));
      p.group.position.set(p.base.x + (1 - k) * 2.5, p.base.y, p.base.z - (1 - k) * 3.0);
      for (const m of p.mats) m.uniforms.uOpacity.value = k;
      p.update(frame, t);
    }
    // slow sideways drift
    const d = easeInOutSine(progress(t, 0, 20));
    const camX = -1.6 + 3.0 * d;
    camera.position.set(camX, 0.15, 7.6);
    camera.lookAt(camX * 0.85 + 0.4, 0.05, 0);
    camera.updateMatrixWorld();
    shared.uDof.value.set(7.5, 0.13, 0.045);
  };
  return { group, camera, shared, update };
};

const post: PostParams = {
  exposure: 1.05,
  bloomStrength: 1.0,
  bloomThreshold: 0.8,
  bloomKnee: 0.4,
  vignette: 0.5,
  grain: 0.015,
};

const Scene: React.FC<{ palette: CandlePalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const built = useMemo(() => build(palette), [palette]);
  built.update(frame, fps);
  return (
    <Stage camera={built.camera} post={post} clear={palette.bg} shared={built.shared}>
      <primitive object={built.group} />
    </Stage>
  );
};

export const CandleDashboard: React.FC<{ palette: CandlePalette }> = ({ palette }) => {
  const assets = useAssets(false);
  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{assets ? <Scene palette={palette} /> : null}</AbsoluteFill>;
};
