// Look 5 — Bright Bar Chart (three.js). One large Canvas-2D chart texture,
// redrawn every frame from formulas of the loop phase, on a plane tilted back
// ~30° and seen from low on the left. Mipmapped + anisotropic so the grid
// doesn't shimmer while the camera glides.
import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { loadFonts, useAssets } from "../lib/assets";
import { HEIGHT, LOOP, TAU, WIDTH } from "../lib/constants";
import { irange, mulberry32, range } from "../lib/random";
import { GLSL_HEADER } from "../lib/glsl";
import { GLStage, type GLFactory } from "../lib/three/GLStage";
import { FullscreenPass, halfFloatTarget, makeFinalPass, srgb } from "../lib/three/pipeline";
import { CODES } from "../data/tickers";
import type { BarChartPalette } from "../versions";

// ---------------------------------------------------------------------------
// Seeded chart data (module level)

const N_BARS = 14;
const N_CANDLES = 72;

const DATA = (() => {
  const rng = mulberry32(1010978468);
  const bars = Array.from({ length: N_BARS }, (_, i) => ({
    u: 0.06 + (i / N_BARS) * 0.9 + range(rng, -0.01, 0.01),
    w: range(rng, 0.036, 0.046),
    base: range(rng, 5200, 7800),
    amp: range(rng, 900, 2000),
    m: irange(rng, 1, 3), // whole cycles per loop
    ph: rng() * TAU,
  }));
  // closed random walk: increments sum to zero, so the series is periodic
  const inc = Array.from({ length: N_CANDLES }, () => range(rng, -1, 1));
  const mean = inc.reduce((a, b) => a + b, 0) / N_CANDLES;
  let level = 0;
  const candles = inc.map((d) => {
    const open = level;
    level += d - mean;
    const close = level;
    return { open, close, hi: Math.max(open, close) + range(rng, 0.1, 0.6), lo: Math.min(open, close) - range(rng, 0.1, 0.6) };
  });
  const lines = Array.from({ length: 3 }, (_, l) => ({
    v: 0.42 + l * 0.17,
    harm: Array.from({ length: 4 }, (_, k) => ({
      n: irange(rng, 2, 5) * (k + 1), // whole waves across the plane
      m: irange(rng, 1, 2) * (k % 2 ? 1 : -1), // whole scroll cycles per loop
      a: range(rng, 0.02, 0.05) / (k + 1),
      ph: rng() * TAU,
    })),
  }));
  const labels = Array.from({ length: 12 }, (_, i) => ({
    code: CODES[(i * 5 + 3) % CODES.length],
    u: range(rng, 0.03, 0.92),
    v: range(rng, 0.06, 0.9),
    price: range(rng, 120, 99000),
    chg: range(rng, 0.05, 140),
    up: rng() > 0.3,
  }));
  return { bars, candles, lines, labels };
})();

// ---------------------------------------------------------------------------
// Chart texture

const drawChart = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, ink: string, line: string) => {
  ctx.clearRect(0, 0, W, H);
  const px = W / 4096; // texture pixels per "design pixel"
  const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // grid
  ctx.strokeStyle = rgba(ink, 0.42);
  ctx.lineWidth = 2.2 * px;
  ctx.beginPath();
  const gx = 40;
  const gy = 20;
  for (let i = 0; i <= gx; i++) {
    const x = (W * i) / gx;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let j = 0; j <= gy; j++) {
    const y = (H * j) / gy;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  const baseY = H * 0.97;
  const vToY = (val: number) => baseY - (val / 10000) * H * 0.82;

  // translucent bars with values
  for (const b of DATA.bars) {
    const val = b.base + b.amp * Math.sin(TAU * b.m * t + b.ph);
    const shown = Math.round(val / 100) * 100;
    const x = b.u * W;
    const bw = b.w * W;
    const top = vToY(val);
    ctx.fillStyle = rgba(ink, 0.4);
    ctx.fillRect(x, top, bw, baseY - top);
    ctx.fillStyle = rgba(ink, 0.55);
    ctx.fillRect(x, top, bw, 5 * px);
    ctx.fillStyle = rgba(ink, 0.95);
    ctx.font = `500 ${Math.round(92 * px)}px Inter`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(shown), x + bw * 0.02, top - 26 * px);
  }

  // wavy lines
  for (const l of DATA.lines) {
    ctx.strokeStyle = rgba(line, 0.85);
    ctx.lineWidth = 6 * px;
    ctx.beginPath();
    const N = 400;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      let v = l.v;
      for (const h of l.harm) v += h.a * Math.sin(TAU * (h.n * u - h.m * t) + h.ph);
      if (i === 0) ctx.moveTo(u * W, v * H);
      else ctx.lineTo(u * W, v * H);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(line, 0.25);
    ctx.lineWidth = 18 * px;
    ctx.stroke();
  }

  // candlesticks: periodic series, scrolled by exactly two whole periods per loop
  const cw = W / N_CANDLES;
  const shift = (2 * t * N_CANDLES) % N_CANDLES;
  const yC = (lv: number) => H * 0.5 - lv * H * 0.028;
  ctx.lineWidth = 3 * px;
  for (let k = -1; k <= N_CANDLES; k++) {
    const idx = (((k + Math.floor(shift)) % N_CANDLES) + N_CANDLES) % N_CANDLES;
    const c = DATA.candles[idx];
    const x = (k - (shift - Math.floor(shift))) * cw + cw / 2;
    const a = c.close >= c.open ? 0.95 : 0.7;
    ctx.strokeStyle = rgba(ink, a);
    ctx.fillStyle = rgba(ink, a);
    ctx.beginPath();
    ctx.moveTo(x, yC(c.hi));
    ctx.lineTo(x, yC(c.lo));
    ctx.stroke();
    const y0 = yC(Math.max(c.open, c.close));
    const y1 = yC(Math.min(c.open, c.close));
    if (c.close >= c.open) ctx.fillRect(x - cw * 0.28, y0, cw * 0.56, Math.max(3 * px, y1 - y0));
    else ctx.strokeRect(x - cw * 0.28, y0, cw * 0.56, Math.max(3 * px, y1 - y0));
  }

  // ticker labels (invented codes), values step 20 times per loop
  const step = Math.floor(t * 20);
  for (let i = 0; i < DATA.labels.length; i++) {
    const L = DATA.labels[i];
    const wob = 1 + 0.004 * Math.sin(TAU * (step + i) * 0.37);
    const price = (L.price * wob).toFixed(L.price > 1000 ? 0 : 2);
    ctx.font = `500 ${Math.round(40 * px)}px "JetBrains Mono"`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = rgba(ink, 0.9);
    ctx.fillText(`${L.code} ${price}`, L.u * W, L.v * H);
    ctx.font = `500 ${Math.round(34 * px)}px "JetBrains Mono"`;
    ctx.fillText(`${L.up ? "▲" : "▼"} ${(L.chg * (1 + 0.01 * ((step + i) % 5))).toFixed(2)}`, L.u * W + 60 * px, L.v * H + 44 * px);
  }
};

// ---------------------------------------------------------------------------

const BG_FRAG =
  GLSL_HEADER +
  /* glsl */ `
uniform vec2 uRes;
uniform vec3 cFrom, cTo;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = vUv;
  float g = smoothstep(-0.1, 1.15, dot(p, vec2(0.78, 0.62)));
  vec3 c = mix(cFrom, cTo, g);
  vec2 d = (p - vec2(1.0, 1.0)) * vec2(uRes.x / uRes.y, 1.0);
  c += vec3(0.75, 0.9, 1.0) * 0.22 * exp(-dot(d, d) / 0.35);  // brighter top right
  c *= 1.0 - 0.25 * smoothstep(0.5, 1.3, length((p - vec2(0.6, 0.6)) * vec2(1.4, 1.0)));
  outColor = vec4(c, 1.0);
}
`;

const PLANE_W = 22;
const PLANE_H = 11;

export const BarChart: React.FC<BarChartPalette> = (p) => {
  const ready = useAssets([loadFonts]);

  const factory = useCallback<GLFactory>(
    (gl, pw, ph) => {
      const camera = new THREE.PerspectiveCamera(42, WIDTH / HEIGHT, 0.05, 200);
      const scene = new THREE.Scene();

      // texture size follows output resolution (2048 wide at 720p, 8192 at 4K)
      const TW = Math.min(gl.capabilities.maxTextureSize, Math.max(2048, Math.round((pw / 1280) * 2048 * 1.0)));
      const TH = TW / 2;
      const canvas = document.createElement("canvas");
      canvas.width = TW;
      canvas.height = TH;
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.NoColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = gl.capabilities.getMaxAnisotropy();
      tex.premultiplyAlpha = true;
      // texture is uploaded premultiplied, so blend (ONE, 1 − srcα) without
      // letting the material multiply by alpha a second time
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), mat);
      // chart wall receding to the right and tilted back ~30°
      plane.rotation.order = "YXZ";
      plane.rotation.y = -0.62;
      plane.rotation.x = -0.52;
      plane.position.set(2.5, 1.2, -6);
      plane.frustumCulled = false;
      scene.add(plane);

      const target = halfFloatTarget(pw, ph, { samples: 0 });
      const bg = new FullscreenPass(BG_FRAG, {
        uRes: { value: new THREE.Vector2(pw, ph) },
        cFrom: { value: srgb(p.bgFrom) },
        cTo: { value: srgb(p.bgTo) },
      });
      const final = makeFinalPass();
      final.uniforms.uSrc.value = target.texture;
      final.uniforms.uRes.value.set(pw, ph);

      const render = (f: number) => {
        const t = f / LOOP;
        drawChart(ctx, TW, TH, t, p.ink, p.line);
        tex.needsUpdate = true;
        // one whole cosine cycle: glide right and ease back, never accumulated
        const g = 0.5 - 0.5 * Math.cos(TAU * t);
        camera.position.set(-3.2 + 2.6 * g, -1.6, 2.2);
        camera.lookAt(0.6 + 2.6 * g, 0.6, -6.5);
        gl.autoClear = false;
        bg.render(gl, target);
        gl.setRenderTarget(target);
        gl.render(scene, camera);
        final.uniforms.uFrame.value = f;
        final.render(gl, null);
      };

      return {
        render,
        dispose: () => {
          tex.dispose();
          mat.dispose();
          plane.geometry.dispose();
          target.dispose();
          bg.dispose();
          final.dispose();
        },
      };
    },
    [p],
  );

  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{ready ? <GLStage factory={factory} /> : null}</AbsoluteFill>;
};
