import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { easeInOutCubic, easeOutCubic, range } from "../../lib/anim";
import { INTER, loadFonts, MONO } from "../../lib/fonts";
import { GLSL_HASH } from "../../lib/gl/glslHash";
import { GLStage, LookFactory } from "../../lib/gl/Stage";
import { canvasTexture, hexToVec3, makeCanvas, premulBlend, rgba } from "../../lib/gl/tex";
import { hash, mulberry32 } from "../../lib/random";
import { useAssets } from "../../lib/useAssets";
import { getLandMask, HUBS, loadLandMask } from "../../lib/worldmap";
import type { MapRow } from "../../versions";

// Texture / plane layout ----------------------------------------------------
const TW = 8192;
const TH = 5120;
const PW = 24; // plane size in world units
const PH = 15;
const SX = 8; // reveal sections
const SY = 5;
const MAP = { x: 2250, y: 1380, w: 3700, h: 2200, latTop: 80, latBot: -58 };

const lonLatToPx = (lon: number, lat: number): [number, number] => [
  MAP.x + ((lon + 180) / 360) * MAP.w,
  MAP.y + ((MAP.latTop - lat) / (MAP.latTop - MAP.latBot)) * MAP.h,
];
// Rows of small donut rings (donut widgets) or a short row under a readout.
const donutLayout = (w: { type: string; x: number; y: number; w: number; h: number }) => {
  const top = w.y + 70;
  const ih = w.h - 80;
  if (w.type === "readout") {
    const rad = Math.min(ih * 0.18, 45);
    const n = Math.max(3, Math.min(6, Math.floor(w.w / (rad * 2.6))));
    return Array.from({ length: n }, (_, k) => ({ cx: w.x + rad + k * rad * 2.6, cy: top + ih * 0.78, rad }));
  }
  const rad = Math.min(ih / 2, 110) * 0.85;
  const n = Math.max(2, Math.min(6, Math.floor(w.w / (rad * 2.4))));
  return Array.from({ length: n }, (_, k) => ({ cx: w.x + ((k + 0.5) * w.w) / n, cy: top + ih / 2, rad }));
};
const sectionOf = (px: number, py: number) =>
  Math.min(SY - 1, Math.floor((py / TH) * SY)) * SX + Math.min(SX - 1, Math.floor((px / TW) * SX));

// Section reveal frames (1.5s–3.5s), shared by JS and shaders.
const REVEAL: number[] = Array.from({ length: SX * SY }, (_, i) => 45 + Math.floor(hash(i, 41) * 60));

// Widget layout (seeded) --------------------------------------------------------
type WType = "bars" | "hist" | "donut" | "strip" | "ticker" | "wave" | "readout" | "table";
type Widget = { type: WType; x: number; y: number; w: number; h: number; seed: number };

const CAPTIONS = [
  "DATA NODE", "SYNC RATE", "NET LOAD", "FLOW 07", "UPLINK", "PACKETS", "SIGNAL", "LATENCY",
  "NODE MAP", "CORE 3", "STREAM", "BUFFER", "ROUTE 12", "INDEX", "QUEUE", "GRID 5",
];

const WIDGETS: Widget[] = (() => {
  const r = mulberry32(8080);
  const out: Widget[] = [];
  // weighted: bar charts and strips dominate, like the reference
  const types: WType[] = ["bars", "bars", "bars", "hist", "hist", "donut", "strip", "strip", "ticker", "wave", "readout", "readout", "table"];
  const pickType = () => types[Math.floor(r() * types.length)];
  const bands = [
    { x0: 160, y0: 130, x1: 8030, y1: 640, dir: "h" },
    { x0: 160, y0: 700, x1: 8030, y1: 1200, dir: "h" },
    { x0: 160, y0: 3760, x1: 8030, y1: 4320, dir: "h" },
    { x0: 160, y0: 4380, x1: 8030, y1: 4990, dir: "h" },
    { x0: 140, y0: 1340, x1: 2050, y1: 3620, dir: "v" },
    { x0: 6150, y0: 1340, x1: 8060, y1: 3620, dir: "v" },
  ];
  let k = 0;
  for (const b of bands) {
    if (b.dir === "h") {
      let x = b.x0;
      while (x < b.x1 - 300) {
        const w = Math.min(b.x1 - x, 300 + Math.floor(r() * 420));
        const split = r() < 0.7;
        const hh = b.y1 - b.y0;
        if (split) {
          const h1 = Math.floor(hh * (0.4 + r() * 0.2));
          out.push({ type: pickType(), x, y: b.y0, w, h: h1 - 30, seed: k++ });
          out.push({ type: pickType(), x, y: b.y0 + h1 + 30, w, h: hh - h1 - 30, seed: k++ });
        } else out.push({ type: pickType(), x, y: b.y0, w, h: hh, seed: k++ });
        x += w + 50 + Math.floor(r() * 40);
      }
    } else {
      let y = b.y0;
      while (y < b.y1 - 200) {
        const h = Math.min(b.y1 - y, 260 + Math.floor(r() * 260));
        if (r() < 0.5) {
          const w1 = Math.floor((b.x1 - b.x0) * (0.45 + r() * 0.15));
          out.push({ type: pickType(), x: b.x0, y, w: w1 - 25, h, seed: k++ });
          out.push({ type: pickType(), x: b.x0 + w1 + 25, y, w: b.x1 - b.x0 - w1 - 25, h, seed: k++ });
        } else out.push({ type: pickType(), x: b.x0, y, w: b.x1 - b.x0, h, seed: k++ });
        y += h + 50;
      }
    }
  }
  return out;
})();

// Network: hub pairs and draw order (seeded)
const LINKS: { a: number; b: number; t0: number }[] = (() => {
  const r = mulberry32(3131);
  const pts = HUBS.map(([lon, lat]) => lonLatToPx(lon, lat));
  const set = new Set<string>();
  const out: { a: number; b: number }[] = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: Math.hypot(q[0] - p[0], q[1] - p[1]) }))
      .filter((o) => o.j !== i)
      .sort((u, v) => u.d - v.d);
    const picks = [near[0].j, near[1].j, near[2].j, near[3].j, near[4 + Math.floor(r() * 6)].j];
    for (const j of picks) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!set.has(key)) {
        set.add(key);
        out.push({ a: i, b: j });
      }
    }
  });
  const order = out.map((l, i) => ({ l, k: r() + (i % 3) * 0.05 })).sort((u, v) => u.k - v.k);
  return order.map((o, i) => ({ ...o.l, t0: 112 + i * 2 }));
})();

// Static base texture --------------------------------------------------------------
let baseCache: { key: string; canvas: HTMLCanvasElement } | null = null;

const drawBase = (row: MapRow) => {
  if (baseCache?.key === row.id) return baseCache.canvas;
  const c = makeCanvas(TW, TH);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(555);
  const [cMag, cCyan, cYel, cTeal] = row.widgets;
  const pal = [cMag, cCyan, cYel, cTeal];

  ctx.fillStyle = row.base;
  ctx.fillRect(0, 0, TW, TH);
  const g = ctx.createRadialGradient(TW * 0.5, TH * 0.48, 200, TW * 0.5, TH * 0.5, TW * 0.55);
  g.addColorStop(0, "rgba(10,60,210,0.3)");
  g.addColorStop(0.55, "rgba(6,40,170,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TW, TH);

  // fine grid
  ctx.strokeStyle = "rgba(130,180,255,0.07)";
  ctx.lineWidth = 2;
  for (let x = 0; x < TW; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TH);
    ctx.stroke();
  }
  for (let y = 0; y < TH; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TW, y);
    ctx.stroke();
  }

  // angled HUD frame lines around the map
  ctx.strokeStyle = "rgba(140,190,255,0.45)";
  ctx.lineWidth = 6;
  const hud = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  const mx0 = MAP.x;
  const my0 = MAP.y;
  const mx1 = MAP.x + MAP.w;
  const my1 = MAP.y + MAP.h;
  hud([[mx0 - 120, my0 - 60], [mx0 + 700, my0 - 60], [mx0 + 760, my0 - 120], [mx0 + 2300, my0 - 120]]);
  hud([[mx1 + 120, my1 + 60], [mx1 - 700, my1 + 60], [mx1 - 760, my1 + 120], [mx1 - 2300, my1 + 120]]);
  hud([[mx0 - 120, my1 + 60], [mx0 - 120, my0 + 1200]]);
  hud([[150, my0 - 60], [900, my0 - 60], [980, my0 + 20], [mx0 - 180, my0 + 20], [mx0 - 180, my0 + 600]]);
  hud([[mx0 - 60, my1 + 140], [mx0 + 800, my1 + 140], [mx0 + 880, my1 + 60], [mx0 + 1700, my1 + 60]]);
  hud([[mx1 + 80, my0 - 100], [mx1 + 700, my0 - 100], [mx1 + 780, my0 - 20], [8050, my0 - 20]]);
  hud([[mx1 + 120, my0], [mx1 + 120, my0 + 1000]]);
  // long digit strings and segmented strips along the frame lines
  ctx.font = `500 40px ${MONO}`;
  ctx.fillStyle = "rgba(200,220,255,0.75)";
  for (const [x, y] of [
    [mx0 + 300, my1 + 200],
    [300, my0 - 20],
    [mx0 + 1700, my0 - 170],
    [mx1 - 1300, my1 + 200],
    [mx1 + 300, my0 + 1150],
  ] as [number, number][]) {
    ctx.fillText(Array.from({ length: 22 }, (_, q) => Math.floor(hash(x, y, q) * 10)).join(""), x, y);
    for (let q = 0; q < 14; q++) {
      ctx.fillStyle = q % 5 === 4 ? rgba(row.widgets[1], 0.8) : `rgba(225,235,255,${0.35 + 0.5 * hash(x, q)})`;
      ctx.fillRect(x + q * 46, y + 22, 36, 18);
    }
    ctx.fillStyle = "rgba(200,220,255,0.75)";
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(140,190,255,0.3)";
  hud([[200, 1280], [mx0 - 250, 1280]]);
  hud([[200, 3670], [mx0 - 250, 3670]]);
  hud([[mx1 + 250, 1280], [8000, 1280]]);
  hud([[mx1 + 250, 3670], [8000, 3670]]);

  // dotted world map (hex-offset round dots)
  const { isLand } = getLandMask();
  const pitch = 16.5;
  const rows = Math.floor(MAP.h / (pitch * 0.9));
  const cols = Math.floor(MAP.w / pitch);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const px = MAP.x + (i + (j % 2 ? 0.5 : 0)) * pitch;
      const py = MAP.y + j * pitch * 0.9;
      const lon = ((px - MAP.x) / MAP.w) * 360 - 180;
      const lat = MAP.latTop - ((py - MAP.y) / MAP.h) * (MAP.latTop - MAP.latBot);
      if (!isLand(lon, lat)) continue;
      const cx = (px - TW / 2) / (TW / 2);
      const cy = (py - TH / 2) / (TH / 2);
      const center = Math.exp(-(cx * cx * 2.2 + cy * cy * 3));
      const b = Math.min(1, 0.35 + 0.55 * center + 0.3 * hash(i, j, 2));
      const white = hash(i >> 2, j >> 2, 9) < 0.18 ? 0.6 : 0;
      ctx.fillStyle = white > 0 || hash(i, j, 5) < 0.6 ? `rgba(220,230,245,${0.4 + 0.45 * b})` : rgba(row.dots, 0.35 + 0.45 * b);
      ctx.fillRect(px - 5, py - 5, 10, 10);
    }
  }

  // widgets: static parts
  const caption = (w: Widget, text: string) => {
    ctx.font = `500 44px ${MONO}`;
    ctx.fillStyle = "rgba(170,205,255,0.85)";
    ctx.textBaseline = "top";
    ctx.fillText(text, w.x, w.y);
    ctx.font = `400 30px ${MONO}`;
    ctx.fillStyle = "rgba(140,180,240,0.6)";
    ctx.fillText(`${Math.floor(hash(w.seed, 3) * 9000 + 1000)} / ${Math.floor(hash(w.seed, 4) * 90 + 10)}`, w.x + Math.min(w.w - 300, 380), w.y + 8);
  };
  const bracket = (x: number, y: number, w: number, h: number, a: number) => {
    const L = Math.min(60, w / 5, h / 4);
    ctx.strokeStyle = `rgba(160,200,255,${a})`;
    ctx.lineWidth = 4;
    for (const [bx, by, dx, dy] of [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(bx + dx * L, by);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx, by + dy * L);
      ctx.stroke();
    }
  };
  for (const w of WIDGETS) {
    caption(w, CAPTIONS[w.seed % CAPTIONS.length]);
    const top = w.y + 70;
    const ih = w.h - 80;
    if (r() < 0.5) bracket(w.x - 20, w.y - 20, w.w + 40, w.h + 40, 0.35);
    ctx.strokeStyle = "rgba(150,190,255,0.35)";
    ctx.lineWidth = 3;
    if (w.type === "bars" || w.type === "hist") {
      ctx.beginPath();
      ctx.moveTo(w.x, top + ih);
      ctx.lineTo(w.x + w.w, top + ih);
      ctx.stroke();
      ctx.font = `400 28px ${MONO}`;
      ctx.fillStyle = "rgba(150,190,255,0.5)";
      for (let k = 0; k < 4; k++) ctx.fillText(`${k * 25}`, w.x + (k * w.w) / 4, top + ih + 12);
    } else if (w.type === "readout" || w.type === "table") {
      if (w.type === "readout") {
        const big = Math.min(ih * 0.42, 150);
        ctx.font = `600 ${big}px ${INTER}`;
        ctx.fillStyle = "rgba(235,242,255,0.92)";
        ctx.fillText(`${Math.floor(hash(w.seed, 7) * 9000 + 1000)} ${Math.floor(hash(w.seed, 8) * 90 + 10)}`, w.x, top);
      } else {
        ctx.font = `400 30px ${MONO}`;
        const rowsN = Math.max(3, Math.floor(ih / 44));
        for (let rr = 0; rr < rowsN; rr++) {
          ctx.fillStyle = rr === 0 ? "rgba(220,235,255,0.8)" : "rgba(150,180,225,0.55)";
          const cells = Array.from({ length: 4 }, (_, q) => String(Math.floor(hash(w.seed, rr, q) * 9999)).padStart(4, "0"));
          ctx.fillText(cells.join("   "), w.x, top + rr * 44);
          ctx.fillStyle = "rgba(220,235,255,0.35)";
          ctx.fillRect(w.x + w.w - 180, top + rr * 44 + 8, 40 + hash(w.seed, rr) * 140, 16);
        }
      }
      if (w.type === "readout")
        for (const d of donutLayout(w)) {
          ctx.strokeStyle = "rgba(120,170,255,0.18)";
          ctx.lineWidth = d.rad * 0.22;
          ctx.beginPath();
          ctx.arc(d.cx, d.cy, d.rad * 0.78, 0, Math.PI * 2);
          ctx.stroke();
        }
    } else if (w.type === "donut") {
      for (const d of donutLayout(w)) {
        const { cx, cy, rad } = d;
        ctx.strokeStyle = "rgba(120,170,255,0.18)";
        ctx.lineWidth = rad * 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.78, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (w.type === "strip") {
      const rowsN = Math.max(2, Math.floor(ih / 70));
      for (let rr = 0; rr < rowsN; rr++) {
        const y = top + rr * (ih / rowsN);
        let x = w.x;
        while (x < w.x + w.w - 40) {
          const cw = 40 + Math.floor(r() * 120);
          const on = r();
          ctx.fillStyle =
            on < 0.15
              ? rgba(pal[Math.floor(r() * 4)], 0.85)
              : on < 0.6
                ? "rgba(220,235,255,0.75)"
                : "rgba(120,160,230,0.25)";
          ctx.fillRect(x, y, Math.min(cw, w.x + w.w - x), Math.min(28, ih / rowsN - 14));
          x += cw + 14;
        }
      }
    } else if (w.type === "wave") {
      const n = 40;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const x = w.x + (k / n) * w.w;
        const y = top + ih * (0.5 + 0.35 * Math.sin(k * 0.5 + w.seed) * Math.cos(k * 0.13 + w.seed * 2));
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(pal[w.seed % 4], 0.9);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.lineTo(w.x + w.w, top + ih);
      ctx.lineTo(w.x, top + ih);
      ctx.closePath();
      ctx.fillStyle = rgba(pal[w.seed % 4], 0.15);
      ctx.fill();
    } else if (w.type === "ticker") {
      ctx.font = `400 30px ${MONO}`;
      ctx.fillStyle = "rgba(150,190,255,0.55)";
      for (let k = 0; k < 3; k++) {
        const s = Array.from({ length: 18 }, (_, q) => Math.floor(hash(w.seed, k, q) * 10)).join("");
        ctx.fillText(s, w.x, top + ih * 0.62 + k * 40);
      }
    }
  }

  // scattered small readouts and crosshairs
  for (let i = 0; i < 220; i++) {
    const x = r() * TW;
    const y = r() * TH;
    const inMap = x > MAP.x && x < MAP.x + MAP.w && y > MAP.y && y < MAP.y + MAP.h;
    if (inMap && r() < 0.8) continue;
    const t = r();
    if (t < 0.4) {
      ctx.font = `400 ${26 + Math.floor(r() * 16)}px ${MONO}`;
      ctx.fillStyle = `rgba(160,200,255,${0.25 + r() * 0.4})`;
      ctx.fillText(Array.from({ length: 4 + Math.floor(r() * 10) }, () => Math.floor(r() * 10)).join(""), x, y);
    } else if (t < 0.6) {
      ctx.strokeStyle = "rgba(170,210,255,0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 18, y);
      ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y + 18);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(200,225,255,${0.2 + r() * 0.5})`;
      for (let k = 0; k < 6; k++) if (r() < 0.7) ctx.fillRect(x + k * 34, y, 24, 12);
    }
  }
  // a few labels in the map
  ctx.font = `600 54px ${INTER}`;
  ctx.fillStyle = "rgba(230,240,255,0.85)";
  ctx.fillText("NODE 2207", MAP.x + 1150, MAP.y + 1450);
  ctx.font = `400 36px ${MONO}`;
  ctx.fillStyle = "rgba(190,215,255,0.7)";
  ctx.fillText("53 43 · 0045 2346 1904 4561", MAP.x + 900, MAP.y + 2050);
  ctx.fillText("SYNC 0.82  ROUTE 12", MAP.x + 2300, MAP.y + 420);

  baseCache = { key: row.id, canvas: c };
  return c;
};

// Shaders ------------------------------------------------------------------------
const VIS_GLSL = /* glsl */ `
uniform float uFrame;
uniform float uReveal[${SX * SY}];
float visAt(float sec) {
  float t = uFrame - uReveal[int(sec)];
  if (t < 0.0) return 0.0;
  if (t < 10.0) return step(0.42, hashF(sec + 3.0, uFrame)) * (0.35 + 0.05 * t);
  return min(1.0, 0.75 + 0.25 * (t - 10.0) / 15.0);
}
float glitchAt(float sec) {
  float t = uFrame - uReveal[int(sec)];
  if (t < 0.0 || t >= 10.0) return 0.0;
  return (hashF(sec * 7.0 + 1.0, uFrame) - 0.5) * (1.0 - t / 10.0);
}`;

const makeLook = (row: MapRow): LookFactory => ({ renderer, aspect, pixelHeight }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, aspect, 0.2, 120);
  const pal = row.widgets.map(hexToVec3);
  const uniformsShared = {
    uFrame: { value: 0 },
    uReveal: { value: REVEAL.slice() },
  };

  const plane = new THREE.Group();
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // base texture plane with section reveal + glitch
  const baseTex = canvasTexture(drawBase(row), renderer);
  const baseMat = new THREE.ShaderMaterial({
    uniforms: { ...uniformsShared, tMap: { value: baseTex } },
    vertexShader: `out vec2 vUv; void main(){ vUv = uv * 3.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      in vec2 vUv; uniform sampler2D tMap;
      ${GLSL_HASH}
      ${VIS_GLSL}
      void main() {
        vec2 s = floor(vec2(vUv.x * ${SX}.0, (1.0 - vUv.y) * ${SY}.0));
        float sec = clamp(s.y, 0.0, ${SY - 1}.0) * ${SX}.0 + clamp(s.x, 0.0, ${SX - 1}.0);
        float v = visAt(sec);
        vec2 uv = vUv + vec2(glitchAt(sec) * 0.03, 0.0);
        vec3 c = texture(tMap, uv).rgb;
        // outside the dashboard: mirrored continuation, dimmed
        float outside = max(max(-vUv.x, vUv.x - 1.0), max(-vUv.y, vUv.y - 1.0));
        float dim = outside <= 0.0 ? 1.0 : 0.6;
        gl_FragColor = vec4(c * v * dim, 1.0);
      }`,
  });
  // the plane extends beyond the texture with a dark border so edges never show
  baseTex.wrapS = baseTex.wrapT = THREE.MirroredRepeatWrapping;
  const base = new THREE.Mesh(new THREE.PlaneGeometry(PW * 3, PH * 3), baseMat);
  plane.add(base);

  // overlay group in texture-pixel coordinates
  const ov = new THREE.Group();
  ov.position.set(-PW / 2, PH / 2, 0.002);
  ov.scale.set(PW / TW, -PH / TH, 1);
  plane.add(ov);

  // --- instanced bars (bar charts + histograms), heights computed in-shader
  {
    const pos: number[] = [];
    const size: number[] = [];
    const col: number[] = [];
    const seed: number[] = [];
    const sec: number[] = [];
    WIDGETS.forEach((w) => {
      if (w.type !== "bars" && w.type !== "hist") return;
      const n = w.type === "bars" ? 8 + (w.seed % 9) : 36 + (w.seed % 30);
      const top = w.y + 70;
      const ih = w.h - 90;
      const step = w.w / n;
      const bw = step * (w.type === "bars" ? 0.62 : 0.55);
      for (let k = 0; k < n; k++) {
        const x = w.x + (k + 0.5) * step;
        pos.push(x, top + ih);
        size.push(bw, ih);
        const t = k / Math.max(1, n - 1);
        // gradient across the chart: magenta → cyan → yellow (or teal)
        const a = w.seed % 2 ? pal[0] : pal[3];
        const b = pal[1];
        const cEnd = w.seed % 3 ? pal[2] : pal[0];
        const mode = w.seed % 5;
        let c = t < 0.5 ? a.clone().lerp(b, t * 2) : b.clone().lerp(cEnd, (t - 0.5) * 2);
        if (mode <= 1) c = pal[0].clone().lerp(new THREE.Vector3(1, 0.62, 0.92), t * 0.6); // magenta / hot pink
        if (mode === 2) c = new THREE.Vector3(0.82, 0.86, 0.95).multiplyScalar(0.7 + 0.3 * hash(w.seed, k)); // white/grey
        col.push(c.x, c.y, c.z);
        seed.push(w.seed * 100 + k);
        sec.push(sectionOf(x, top + ih / 2));
      }
    });
    const n = pos.length / 2;
    const geo = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    q.translate(0, 0.5, 0);
    geo.index = q.index;
    geo.setAttribute("position", q.getAttribute("position"));
    geo.setAttribute("uv", q.getAttribute("uv"));
    geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(new Float32Array(pos), 2));
    geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array(size), 2));
    geo.setAttribute("aCol", new THREE.InstancedBufferAttribute(new Float32Array(col), 3));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(seed), 1));
    geo.setAttribute("aSec", new THREE.InstancedBufferAttribute(new Float32Array(sec), 1));
    geo.instanceCount = n;
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { ...uniformsShared },
        vertexShader: /* glsl */ `
          in vec2 aPos; in vec2 aSize; in vec3 aCol; in float aSeed; in float aSec;
          out vec3 vCol; out float vVis; out vec2 vUv;
          ${GLSL_HASH}
          ${VIS_GLSL}
          void main() {
            float grow = clamp((uFrame - uReveal[int(aSec)] - 4.0) / 24.0, 0.0, 1.0);
            grow = 1.0 - pow(1.0 - grow, 3.0);
            // value updates: eased steps every 20 frames
            float e = floor(uFrame / 20.0);
            float t = fract(uFrame / 20.0);
            float v0 = hashF(aSeed, e);
            float v1 = hashF(aSeed, e + 1.0);
            float v = mix(v0, v1, smoothstep(0.0, 0.5, t));
            float h = aSize.y * (0.18 + 0.82 * v) * grow;
            vec2 p = aPos + vec2(position.x * aSize.x, -position.y * h);
            vCol = aCol; vVis = visAt(aSec); vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          in vec3 vCol; in float vVis; in vec2 vUv;
          void main() {
            float a = vVis * (0.55 + 0.45 * vUv.y);
            gl_FragColor = vec4(vCol * 1.15 * a, a);
          }`,
        side: THREE.DoubleSide,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    ov.add(mesh);
  }

  // --- donut rings, segments animated in-shader
  {
    const data: number[] = [];
    WIDGETS.forEach((w) => {
      if (w.type !== "donut" && w.type !== "readout") return;
      donutLayout(w).forEach((d, k) => {
        const { cx, cy, rad } = d;
        data.push(cx, cy, rad, w.seed * 10 + k, sectionOf(cx, cy));
      });
    });
    const n = data.length / 5;
    const geo = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(2, 2);
    geo.index = q.index;
    geo.setAttribute("position", q.getAttribute("position"));
    const arr = new Float32Array(data);
    const ib = new THREE.InstancedInterleavedBuffer(arr, 5);
    geo.setAttribute("aC", new THREE.InterleavedBufferAttribute(ib, 2, 0));
    geo.setAttribute("aR", new THREE.InterleavedBufferAttribute(ib, 1, 2));
    geo.setAttribute("aSeed", new THREE.InterleavedBufferAttribute(ib, 1, 3));
    geo.setAttribute("aSec", new THREE.InterleavedBufferAttribute(ib, 1, 4));
    geo.instanceCount = n;
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { ...uniformsShared, uPal: { value: pal } },
        vertexShader: /* glsl */ `
          in vec2 aC; in float aR; in float aSeed; in float aSec;
          out vec2 vQ; out float vSeed; out float vSec; out float vR;
          void main() {
            vQ = position.xy; vSeed = aSeed; vSec = aSec; vR = aR;
            vec2 p = aC + position.xy * aR;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          in vec2 vQ; in float vSeed; in float vSec; in float vR;
          uniform vec3 uPal[4];
          ${GLSL_HASH}
          ${VIS_GLSL}
          void main() {
            float d = length(vQ);
            float ang = atan(vQ.x, -vQ.y) / 6.2831853 + 0.5; // 0..1 clockwise from top
            float grow = clamp((uFrame - uReveal[int(vSec)] - 6.0) / 30.0, 0.0, 1.0);
            grow = 1.0 - pow(1.0 - grow, 3.0);
            float e = floor(uFrame / 45.0);
            float t = smoothstep(0.0, 0.6, fract(uFrame / 45.0));
            vec3 col = vec3(0.0); float a = 0.0;
            // outer ring: 3 segments
            if (d > 0.68 && d < 0.88) {
              float s1 = mix(hashF(vSeed, e), hashF(vSeed, e + 1.0), t) * 0.4 + 0.15;
              float s2 = s1 + mix(hashF(vSeed + 50.0, e), hashF(vSeed + 50.0, e + 1.0), t) * 0.3 + 0.1;
              float s3 = s2 + 0.15;
              float A = ang / max(grow, 1e-3);
              if (A < s1) { col = uPal[0]; a = 1.0; }
              else if (A < s2) { col = uPal[1]; a = 1.0; }
              else if (A < s3) { col = uPal[2]; a = 1.0; }
              a *= step(ang, grow) * smoothstep(0.68, 0.70, d) * smoothstep(0.88, 0.86, d);
              // segment gaps
              a *= smoothstep(0.0, 0.004, abs(fract(A * 12.0) - 0.0));
            }
            // inner ring: single value
            if (d > 0.48 && d < 0.6) {
              float v = mix(hashF(vSeed + 9.0, e), hashF(vSeed + 9.0, e + 1.0), t) * 0.8 + 0.15;
              float on = step(ang, v * grow);
              col = mix(uPal[3], vec3(1.0), 0.15); a = on * 0.9 * smoothstep(0.48, 0.5, d) * smoothstep(0.6, 0.58, d);
            }
            a *= visAt(vSec);
            gl_FragColor = vec4(col * a * 1.1, a);
          }`,
        side: THREE.DoubleSide,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    ov.add(mesh);
  }

  // --- ticking digits (atlas 0–9), values computed in-shader
  {
    const dc = makeCanvas(1280, 160);
    const dctx = dc.getContext("2d")!;
    dctx.font = `500 120px ${MONO}`;
    dctx.textAlign = "center";
    dctx.textBaseline = "middle";
    dctx.fillStyle = "#fff";
    for (let d = 0; d < 10; d++) dctx.fillText(String(d), d * 128 + 64, 84);
    const dTex = canvasTexture(dc, renderer);
    const data: number[] = [];
    const rr = mulberry32(99);
    WIDGETS.forEach((w) => {
      if (w.type !== "ticker") return;
      const top = w.y + 70;
      const ih = w.h - 80;
      const dh = Math.min(ih * 0.45, 150);
      const dw = dh * 0.62;
      const nd = Math.min(8, Math.floor((w.w * 0.9) / dw));
      const colIdx = w.seed % 4;
      for (let k = 0; k < nd; k++) {
        const x = w.x + (k + 0.5) * dw + (k >= nd / 2 ? dw * 0.4 : 0);
        const y = top + dh * 0.6;
        // right-most digits tick faster
        const period = [60, 30, 12, 6][Math.min(3, Math.floor((k / nd) * 4))];
        data.push(x, y, dw, dh, w.seed * 20 + k, period, sectionOf(x, y), colIdx === 0 && rr() < 0.5 ? 1 : 0);
      }
    });
    const n = data.length / 8;
    const geo = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    geo.index = q.index;
    geo.setAttribute("position", q.getAttribute("position"));
    geo.setAttribute("uv", q.getAttribute("uv"));
    const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(data), 8);
    geo.setAttribute("aPos", new THREE.InterleavedBufferAttribute(ib, 2, 0));
    geo.setAttribute("aSize", new THREE.InterleavedBufferAttribute(ib, 2, 2));
    geo.setAttribute("aSeed", new THREE.InterleavedBufferAttribute(ib, 1, 4));
    geo.setAttribute("aPeriod", new THREE.InterleavedBufferAttribute(ib, 1, 5));
    geo.setAttribute("aSec", new THREE.InterleavedBufferAttribute(ib, 1, 6));
    geo.setAttribute("aHot", new THREE.InterleavedBufferAttribute(ib, 1, 7));
    geo.instanceCount = n;
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { ...uniformsShared, tDigits: { value: dTex }, uHot: { value: pal[2] } },
        vertexShader: /* glsl */ `
          in vec2 aPos; in vec2 aSize; in float aSeed; in float aPeriod; in float aSec; in float aHot;
          out vec2 vUv; out float vDigit; out float vVis; out float vHot;
          ${GLSL_HASH}
          ${VIS_GLSL}
          void main() {
            vUv = uv;
            vDigit = floor(hashF(aSeed, floor(uFrame / aPeriod)) * 10.0);
            vVis = visAt(aSec); vHot = aHot;
            vec2 p = aPos + vec2(position.x * aSize.x, -position.y * aSize.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          in vec2 vUv; in float vDigit; in float vVis; in float vHot;
          uniform sampler2D tDigits; uniform vec3 uHot;
          void main() {
            float a = texture(tDigits, vec2((vDigit + vUv.x) / 10.0, vUv.y)).a * vVis;
            vec3 c = mix(vec3(0.92, 0.96, 1.0), uHot, vHot);
            gl_FragColor = vec4(c * a, a);
          }`,
        side: THREE.DoubleSide,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    ov.add(mesh);
  }

  // --- network lines, nodes, pulses (geometry rebuilt from the frame)
  const hubPx = HUBS.map(([lon, lat]) => lonLatToPx(lon, lat));
  const lineGeo = new THREE.BufferGeometry();
  const maxQuads = LINKS.length * 2 + 4;
  const linePos = new Float32Array(maxQuads * 6 * 3);
  const lineA = new Float32Array(maxQuads * 6);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setAttribute("aA", new THREE.BufferAttribute(lineA, 1).setUsage(THREE.DynamicDrawUsage));
  const lineMat = premulBlend(
    new THREE.ShaderMaterial({
      uniforms: { uCol: { value: hexToVec3(row.lines) } },
      vertexShader: `in float aA; out float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `in float vA; uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol * vA, vA); }`,
      side: THREE.DoubleSide,
    }),
    true,
  );
  const lines = new THREE.Mesh(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 4;
  ov.add(lines);

  // node + pulse sprites (instanced quads with a radial glow)
  const glowC = makeCanvas(256, 256);
  {
    const gctx = glowC.getContext("2d")!;
    const g = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,250,230,0.95)");
    g.addColorStop(0.2, "rgba(255,230,160,0.35)");
    g.addColorStop(0.5, "rgba(160,200,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, 256, 256);
  }
  const maxSprites = HUBS.length + LINKS.length;
  const spGeo = new THREE.InstancedBufferGeometry();
  {
    const q = new THREE.PlaneGeometry(1, 1);
    spGeo.index = q.index;
    spGeo.setAttribute("position", q.getAttribute("position"));
    spGeo.setAttribute("uv", q.getAttribute("uv"));
  }
  const spData = new Float32Array(maxSprites * 4); // x, y, size, alpha
  const spBuf = new THREE.InstancedInterleavedBuffer(spData, 4).setUsage(THREE.DynamicDrawUsage);
  spGeo.setAttribute("aP", new THREE.InterleavedBufferAttribute(spBuf, 2, 0));
  spGeo.setAttribute("aS", new THREE.InterleavedBufferAttribute(spBuf, 1, 2));
  spGeo.setAttribute("aA", new THREE.InterleavedBufferAttribute(spBuf, 1, 3));
  const spMat = premulBlend(
    new THREE.ShaderMaterial({
      uniforms: { tMap: { value: canvasTexture(glowC, renderer) } },
      vertexShader: `in vec2 aP; in float aS; in float aA; out vec2 vUv; out float vA;
        void main(){ vUv = uv; vA = aA; vec2 p = aP + position.xy * aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0); }`,
      fragmentShader: `in vec2 vUv; in float vA; uniform sampler2D tMap; void main(){ gl_FragColor = texture(tMap, vUv) * vA; }`,
      side: THREE.DoubleSide,
    }),
    true,
  );
  const sprites = new THREE.Mesh(spGeo, spMat);
  sprites.frustumCulled = false;
  sprites.renderOrder = 5;
  ov.add(sprites);

  // scanning brackets (a few moving corner-bracket quads)
  const brC = makeCanvas(256, 256);
  {
    const b = brC.getContext("2d")!;
    b.strokeStyle = "#fff";
    b.lineWidth = 10;
    const L = 70;
    for (const [x, y, dx, dy] of [
      [8, 8, 1, 1],
      [248, 8, -1, 1],
      [8, 248, 1, -1],
      [248, 248, -1, -1],
    ]) {
      b.beginPath();
      b.moveTo(x + dx * L, y);
      b.lineTo(x, y);
      b.lineTo(x, y + dy * L);
      b.stroke();
    }
  }
  const brTex = canvasTexture(brC, renderer);
  const scanners = [0, 1, 2, 3].map((i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      premulBlend(
        new THREE.MeshBasicMaterial({ map: brTex, color: new THREE.Color(i % 2 ? row.widgets[1] : "#ffffff"), side: THREE.DoubleSide }),
        true,
      ),
    );
    m.renderOrder = 6;
    ov.add(m);
    return m;
  });

  const update = (frame: number) => {
    uniformsShared.uFrame.value = frame;

    // camera glide: slow lateral move with a slight yaw change
    const g = easeInOutCubic(frame / 599);
    const tx = -1.3 + 2.6 * g;
    const tz = 0.8 - 0.2 * g;
    const yaw = 0.52 - 0.1 * g;
    const pitch = (45 * Math.PI) / 180;
    const dist = 14.8 - 0.8 * g;
    camera.position.set(
      tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(tx, 0, tz);
    camera.rotateZ(0.05);
    camera.updateMatrixWorld();

    // network lines
    let q = 0;
    const quad = (x0: number, y0: number, x1: number, y1: number, wpx: number, a: number) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * wpx * 0.5;
      const ny = (dx / L) * wpx * 0.5;
      const v = [
        [x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 + nx, y1 + ny],
        [x1 + nx, y1 + ny], [x0 - nx, y0 - ny], [x1 - nx, y1 - ny],
      ];
      v.forEach(([x, y], k) => {
        linePos.set([x, y, 0], (q * 6 + k) * 3);
        lineA[q * 6 + k] = a;
      });
      q++;
    };
    const nodeOn = new Array(HUBS.length).fill(0);
    let s = 0;
    LINKS.forEach((l, i) => {
      const p = easeOutCubic(range(frame, l.t0, l.t0 + 26));
      if (p <= 0) return;
      const [ax, ay] = hubPx[l.a];
      const [bx, by] = hubPx[l.b];
      const ex = ax + (bx - ax) * p;
      const ey = ay + (by - ay) * p;
      const flick = frame - l.t0 < 4 ? 0.5 : 1;
      quad(ax, ay, ex, ey, 2.6, 0.42 * flick);
      nodeOn[l.a] = Math.max(nodeOn[l.a], range(frame, l.t0, l.t0 + 6));
      if (p > 0.98) nodeOn[l.b] = Math.max(nodeOn[l.b], 1);
      // travelling pulse once drawn
      if (p >= 1) {
        const per = 70 + (i % 5) * 12;
        const u = (((frame - l.t0 - 26) / per + hash(i, 8)) % 1 + 1) % 1;
        spData.set([ax + (bx - ax) * u, ay + (by - ay) * u, 50, 0.5 * Math.sin(Math.PI * u)], s * 4);
        s++;
      } else {
        spData.set([ex, ey, 60, 0.7], s * 4);
        s++;
      }
    });
    for (let k = q * 6; k < linePos.length / 3; k++) lineA[k] = 0;
    lineGeo.attributes.position.needsUpdate = true;
    (lineGeo.attributes.aA as THREE.BufferAttribute).needsUpdate = true;
    lineGeo.setDrawRange(0, q * 6);
    hubPx.forEach(([x, y], i) => {
      if (nodeOn[i] <= 0) return;
      const tw = 0.8 + 0.2 * Math.sin(frame * 0.15 + i);
      spData.set([x, y, 70, 0.7 * nodeOn[i] * tw], s * 4);
      s++;
    });
    spBuf.needsUpdate = true;
    spGeo.instanceCount = s;

    // scanning brackets glide over widgets
    scanners.forEach((m, i) => {
      const w = WIDGETS[(i * 7 + Math.floor(frame / 75)) % WIDGETS.length];
      const t = (frame % 75) / 75;
      const vis = range(frame, 120, 135);
      const x = w.x + w.w * (0.15 + 0.7 * t);
      const y = w.y + w.h * 0.55;
      const sz = Math.min(w.h, 260) * 0.8;
      m.position.set(x, y, 0);
      m.scale.set(sz, sz, 1);
      // additive, premultiplied: fade by scaling the colour
      (m.material as THREE.MeshBasicMaterial).color
        .set(i % 2 ? row.widgets[1] : "#ffffff")
        .multiplyScalar(0.8 * vis * Math.sin(Math.PI * t));
    });

    const fadeIn = range(frame, 45, 70);
    return {
      frame,
      bloom: { strength: 0.45, threshold: 0.75, knee: 0.3, radius: 1.0 },
      dof: { focus: camera.position.distanceTo(new THREE.Vector3(tx, 0, tz)), aperture: 0.008, maxBlur: 0.006, nearScale: 0.8 },
      exposure: 0.25 + 0.75 * fadeIn,
      vignette: 0.55,
      grain: 0.015,
    };
  };
  void pixelHeight;
  return { scene, camera, update };
};

export const MapDashboard: React.FC<{ row: MapRow }> = ({ row }) => {
  const ready = useAssets(() => Promise.all([loadFonts(), loadLandMask()]), "map assets");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeLook(row), [row.id]);
  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{ready ? <GLStage create={create} /> : null}</AbsoluteFill>;
};
