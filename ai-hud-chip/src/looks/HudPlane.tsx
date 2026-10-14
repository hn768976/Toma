import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { HudPlaneRow } from "../colorways";
import { CameraRig } from "../kit/Camera";
import { FONT_AI, FONT_HEAD, FONT_MONO } from "../kit/fonts";
import { GLSL_DOF, GLSL_HASH } from "../kit/glsl";
import { codeBlock, digits } from "../kit/hudText";
import { DofSettings, dofUniforms, makeHudMaterial, makeTexMaterial } from "../kit/materials";
import { LiveLabel, makeCanvas, canvasTexture, Painter } from "../kit/painter";
import { makeBokeh } from "../kit/bokeh";
import { Pipeline } from "../kit/Pipeline";
import { mulberry32, tickDigits } from "../kit/random";
import { Stage } from "../kit/Stage";

// ---------------------------------------------------------------------------
// Look 1 — AI HUD Plane. A large HUD screen tilted back ~30°, building itself
// over a blurred violet (or teal) background. 15 s story.
// ---------------------------------------------------------------------------

const FPS = 30;
const BUILD_START = 1.5; // s
const BUILD_END = 7.0; // s
/** seconds → painter build timeline (0..1) */
const tl = (sec: number) => (sec - BUILD_START) / (BUILD_END - BUILD_START);

// Plane and its design space
const PW = 24;
const PH = 13.5;
const DW = 4096;
const DH = 2304;
const TEX_SCALE = 1.25; // 5120×2880 texture
const toLocal = (dx: number, dy: number): [number, number] => [(dx / DW - 0.5) * PW, (0.5 - dy / DH) * PH];
const CX = DW / 2;
const CY = DH / 2;

const DOF: DofSettings = { mode: 0, a: 0.5, b: 0.17, c: 0.3, max: 26, min: 1.5 };

const mono = (px: number, w = 500) => `${w} ${px}px "${FONT_MONO}"`;
const head = (px: number, w = 600) => `${w} ${px}px "${FONT_HEAD}"`;

// Times (s) for the story
const T_FRAMES = [1.5, 4.0];
const T_TEXT = [4.0, 7.0];

/** The static HUD sheet. Built once per thread (module-level seed). */
const buildSheet = () => {
  const rng = mulberry32(0x4a1d);
  const p = new Painter(DW * TEX_SCALE, DH * TEX_SCALE);
  p.setScale(TEX_SCALE);
  const fr = (a: number) => tl(T_FRAMES[0] + (T_FRAMES[1] - T_FRAMES[0]) * a);
  const tx = (a: number) => tl(T_TEXT[0] + (T_TEXT[1] - T_TEXT[0]) * a);

  const codeCol = (x: number, y: number, lines: number, a0: number, a1: number, size = 24, lh = 34, maxLen = 32, alpha = 0.85) => {
    const block = codeBlock(rng, lines, maxLen);
    block.forEach((ln, i) => {
      const s0 = a0 + ((a1 - a0) * i) / lines;
      const s1 = a0 + ((a1 - a0) * (i + 0.9)) / lines;
      p.text(ln, x, y + i * lh, mono(size), tx(s0), tx(s1), alpha);
    });
  };

  // --- Panel: ELEMENTS*TX05 (upper left of ring)
  p.text("ELEMENTS*/TX05", 1190, 505, head(50), fr(0.15), fr(0.35), 0.95);
  p.frame(1160, 525, 900, 430, fr(0.05), fr(0.55), { width: 3, bevel: 46, ticks: 20 });
  p.frame(1180, 545, 860, 390, fr(0.25), fr(0.7), { width: 1.4, alpha: 0.45 });
  p.text("01/USR/BIN/PERL", 1195, 582, mono(19), tx(0.0), tx(0.08), 0.8);
  p.text("DATA 01", 1880, 582, mono(19), tx(0.02), tx(0.06), 0.8);
  codeCol(1195, 618, 9, 0.04, 0.5, 23, 34, 34);
  p.bar(1190, 686, 600, 20, fr(0.6), fr(0.85), 1);
  p.bar(1190, 716, 430, 10, fr(0.65), fr(0.9), 0.9);
  p.frame(1185, 683, 610, 26, fr(0.55), fr(0.75), { width: 1.4, alpha: 0.6 });

  // --- Command prompt box (left of ring)
  p.frame(1300, 1075, 420, 62, fr(0.4), fr(0.75), { width: 3, ticks: 10 });
  p.fill(1306, 1081, 408, 50, fr(0.7), 0.18);
  p.text("COMMAND PROMPT", 1324, 1116, mono(24, 600), tx(0.1), tx(0.2), 1);
  for (let i = 0; i < 4; i++) p.fill(1620 + i * 20, 1094, 14, 26, tx(0.2 + i * 0.03), 0.8);
  p.frame(1240, 1040, 520, 132, fr(0.5), fr(0.85), { width: 1.2, alpha: 0.35 });

  // --- Right-top panel TXT//02
  p.text("TXT//02", 2930, 330, head(84, 700), fr(0.1), fr(0.3), 1);
  p.frame(2880, 360, 780, 650, fr(0.0), fr(0.5), { width: 3, bevel: 60, ticks: 24, corner: 1 });
  p.line(2900, 400, 2900, 980, fr(0.3), fr(0.6), 6, 0.8);
  codeCol(2940, 420, 16, 0.1, 0.75, 24, 34, 30);

  // --- Lower-left panel ELEMENTS*TXT01
  p.text("ELEMENTS*TXT01", 1300, 1560, head(50), fr(0.3), fr(0.5), 0.9);
  p.frame(1280, 1580, 900, 560, fr(0.2), fr(0.7), { width: 2.4, bevel: 50, ticks: 18, corner: 3 });
  codeCol(1320, 1640, 13, 0.2, 0.85, 25, 36, 36);
  codeCol(700, 1500, 18, 0.3, 0.9, 24, 34, 26, 0.7);
  p.text("2674010536", 1080, 2045, mono(22), tx(0.6), tx(0.65), 0.7);

  // --- Lower-right ELEMENTS*T06 (large heading + code)
  p.text("ELEMENTS*T06", 2560, 1500, head(84, 700), fr(0.35), fr(0.6), 1);
  p.line(2540, 1520, 3600, 1520, fr(0.35), fr(0.75), 2.4);
  codeCol(2600, 1590, 12, 0.3, 0.95, 28, 42, 34);
  p.frame(2520, 1430, 1140, 720, fr(0.5), fr(0.95), { width: 1.4, alpha: 0.4, corner: 2 });

  // --- Far-left column
  p.text("SYS_MAP//A", 190, 330, head(46), fr(0.2), fr(0.4), 0.85);
  p.frame(160, 350, 600, 640, fr(0.1), fr(0.6), { width: 2, ticks: 14 });
  codeCol(190, 400, 17, 0.0, 0.6, 22, 34, 30, 0.75);
  p.text("SYS_MAP//B", 190, 1360, head(46), fr(0.4), fr(0.6), 0.85);
  codeCol(190, 1420, 16, 0.3, 0.9, 22, 34, 30, 0.7);

  // --- Far-right column
  codeCol(3740, 420, 22, 0.15, 0.8, 22, 34, 18, 0.7);
  codeCol(3740, 1280, 18, 0.4, 0.95, 22, 34, 18, 0.65);

  // --- Top strip
  p.text("ELEMENTS*TXT03", 2120, 240, head(46), fr(0.4), fr(0.6), 0.8);
  p.line(1160, 262, 2700, 262, fr(0.0), fr(0.6), 1.6, 0.6);
  codeCol(2140, 300, 6, 0.0, 0.3, 22, 32, 24, 0.7);

  // --- CHATBOT label + block grid (right of ring)
  p.frame(2500, 955, 340, 56, fr(0.45), fr(0.75), { width: 2.4, ticks: 10 });
  p.text("CHATBOT", 2590, 995, head(40, 700), tx(0.12), tx(0.2), 1, { spacing: 2 });
  p.dot(2530, 983, 7, tx(0.1), 0.9, true);
  const gx = 2470;
  const gy = 1060;
  const cs = 70;
  const gap = 16;
  const icons = ["num", "tri", "dia", "num", "", "fill", "", "x", "fill", "num", "", "tri", "", "fill", "num", "", "dia", "", "fill", "", "num", "x", "", "fill"];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const x = gx + c * (cs + gap);
      const y = gy + r * (cs + gap);
      const i = r * 6 + c;
      const a = 0.05 + (i / 24) * 0.55;
      p.frame(x, y, cs, cs, tx(a), tx(a + 0.05), { width: 2.2 });
      const kind = icons[i];
      if (kind === "fill") p.fill(x + 8, y + 8, cs - 16, cs - 16, tx(a + 0.1), 0.9);
      if (kind === "num") p.label(digits(rng, 3), x + cs / 2, y + cs / 2 + 9, mono(24, 600), tx(a + 0.08), 1, "center");
      if (kind === "tri") p.path([[x + 18, y + cs - 18], [x + cs / 2, y + 16], [x + cs - 18, y + cs - 18], [x + 18, y + cs - 18]], tx(a + 0.06), tx(a + 0.12), 2.4);
      if (kind === "dia") p.path([[x + cs / 2, y + 14], [x + cs - 14, y + cs / 2], [x + cs / 2, y + cs - 14], [x + 14, y + cs / 2], [x + cs / 2, y + 14]], tx(a + 0.06), tx(a + 0.12), 2.4);
      if (kind === "x") {
        p.line(x + 18, y + 18, x + cs - 18, y + cs - 18, tx(a + 0.06), tx(a + 0.1), 2.4);
        p.line(x + cs - 18, y + 18, x + 18, y + cs - 18, tx(a + 0.08), tx(a + 0.12), 2.4);
      }
    }
  }
  p.frame(gx - 18, gy - 18, 6 * (cs + gap) + 20, 4 * (cs + gap) + 20, fr(0.5), fr(0.9), { width: 1.4, alpha: 0.5 });
  p.text("MODEL//STATE", gx, gy + 4 * (cs + gap) + 30, mono(20), tx(0.5), tx(0.6), 0.7);

  // --- faint glass fills behind panels
  for (const [x, y, w, h] of [
    [1160, 525, 900, 430],
    [2880, 360, 780, 650],
    [1280, 1580, 900, 560],
    [160, 350, 600, 640],
    [2520, 1430, 1140, 720],
  ]) p.fill(x, y, w, h, fr(0.6), 0.14);

  // --- extra dense text columns (top / bottom strips, outer edges)
  codeCol(1200, 40, 5, 0.0, 0.3, 22, 32, 40, 0.6);
  codeCol(2900, 40, 7, 0.1, 0.4, 22, 32, 40, 0.6);
  codeCol(200, 2100, 6, 0.5, 0.9, 24, 34, 40, 0.6);
  codeCol(1300, 2120, 5, 0.6, 1.0, 24, 34, 40, 0.6);
  codeCol(820, 380, 18, 0.1, 0.7, 20, 30, 12, 0.55);
  codeCol(2100, 1820, 9, 0.5, 1.0, 24, 36, 18, 0.65);

  // --- Connectors from the ring out to small widgets
  const rr = 270;
  const at = (deg: number, r = rr): [number, number] => [CX + Math.cos((deg * Math.PI) / 180) * r, CY - Math.sin((deg * Math.PI) / 180) * r];
  const widget = (x: number, y: number, t: number) => {
    p.frame(x - 22, y - 22, 44, 44, tx(t), tx(t + 0.05), { width: 2.4 });
    p.fill(x - 8, y - 8, 16, 16, tx(t + 0.05), 1);
  };
  const conn = (a: [number, number], b: [number, number], c1: [number, number], c2: [number, number], t0: number, t1: number) => {
    p.dot(a[0], a[1], 7, tx(t0), 1);
    p.bezier(a, c1, c2, b, tx(t0), tx(t1), 2.6, 0.95);
  };
  conn(at(40), [2780, 700], [2420, 980], [2500, 700], 0.0, 0.25);
  widget(2802, 700, 0.25);
  conn(at(-5), [2495, 983], [2400, 1140], [2440, 990], 0.05, 0.2);
  conn(at(-60), [2380, 1720], [2250, 1500], [2300, 1720], 0.1, 0.35);
  widget(2402, 1720, 0.35);
  conn(at(200), [1720, 1106], [1790, 1180], [1760, 1106], 0.05, 0.25);
  widget(600, 1260, 0.45);
  p.bezier([1300, 1106], [950, 1150], [800, 1260], [622, 1260], tx(0.3), tx(0.45), 2.4, 0.9);

  // --- long thin guide lines
  p.line(160, 1240, 700, 1240, fr(0.3), fr(0.8), 1.4, 0.5);
  p.line(2100, 2160, 3900, 2160, fr(0.2), fr(0.9), 1.4, 0.4);
  p.line(3700, 300, 3700, 2200, fr(0.0), fr(0.8), 1.4, 0.4);
  p.line(1100, 120, 1100, 2240, fr(0.1), fr(0.9), 1.2, 0.3);

  return p.pack(8);
};

/** Ring layers (draw on by angle). */
const buildRing = (layer: 0 | 1 | 2) => {
  const S = 1024;
  const p = new Painter(S * 2, S * 2);
  p.setScale(2);
  const c = S / 2;
  const fr = (sec: number) => tl(sec);
  const full = (r: number, t0: number, t1: number, w: number, a = 1, start = -Math.PI / 2) => p.arc(c, c, r, start, start + Math.PI * 2, fr(t0), fr(t1), w, a);
  if (layer === 0) {
    // main bright double ring
    full(250, 2.2, 3.4, 7, 1);
    full(232, 2.4, 3.6, 2.5, 0.9, Math.PI / 2);
    full(200, 2.6, 3.8, 1.6, 0.55);
    // dots on the ring
    for (const a of [0.3, 2.2, 4.1]) p.dot(c + Math.cos(a) * 250, c + Math.sin(a) * 250, 12, fr(3.6), 1);
  } else if (layer === 1) {
    // tick ring (slow turn)
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * Math.PI * 2;
      const long = i % 12 === 0;
      const r0 = 300;
      const r1 = long ? 330 : 314;
      const t = fr(2.0 + (i / 144) * 1.6);
      p.line(c + Math.cos(a) * r0, c + Math.sin(a) * r0, c + Math.cos(a) * r1, c + Math.sin(a) * r1, t, t + 0.01, long ? 3 : 1.6, long ? 0.95 : 0.6);
    }
    p.arc(c, c, 360, -0.4, 1.2, fr(2.4), fr(3.2), 3, 0.9);
    p.arc(c, c, 360, 2.6, 3.9, fr(2.6), fr(3.4), 3, 0.9);
    p.arc(c, c, 360, 4.4, 5.3, fr(2.8), fr(3.5), 3, 0.9);
  } else {
    // octagonal bracket + faint outer halo (counter-turn)
    const oct: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      oct.push([c + Math.cos(a) * 395, c + Math.sin(a) * 395]);
    }
    p.path(oct, fr(1.8), fr(3.4), 2.2, 0.5);
    p.arc(c, c, 410, 0, Math.PI * 2, fr(1.8), fr(3.4), 1.4, 0.35);
    p.arc(c, c, 455, 0.9, 2.2, fr(2.5), fr(3.4), 1.6, 0.6);
    p.arc(c, c, 455, 4.1, 5.4, fr(2.7), fr(3.6), 1.6, 0.6);
    for (const a of [0.9, 2.2, 4.1, 5.4]) p.dot(c + Math.cos(a) * 455, c + Math.sin(a) * 455, 7, fr(3.6), 1);
  }
  return p.pack(8);
};

const buildCentreText = (text: string) => {
  const { cv, ctx } = makeCanvas(1024, 512);
  ctx.clearRect(0, 0, 1024, 512);
  ctx.font = `600 260px "${FONT_AI}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(160,230,255,0.55)";
  ctx.shadowBlur = 26;
  ctx.fillText(text, 512, 270);
  ctx.shadowBlur = 0;
  ctx.fillText(text, 512, 270);
  return canvasTexture(cv, 8);
};

// --------------------------------------------------------------- background
const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 fragColor;
#define NB 11
uniform float uTime; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uAspect;
uniform vec4 uBlob[NB]; uniform vec3 uBlobC[NB];
${GLSL_HASH}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  uvec2 q = uvec2(ivec2(i) + 4096);
  float a = h2(q.x, q.y), b = h2(q.x + 1u, q.y), c = h2(q.x, q.y + 1u), d = h2(q.x + 1u, q.y + 1u);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
  float t = uTime;
  // base: deep colour, a little lighter towards the top
  vec3 col = mix(mix(uC3, uC1, 0.25) * 0.95, mix(uC3, uC1, 0.5) * 0.95, smoothstep(-0.5, 0.5, p.y));
  // art-directed out-of-focus light shapes on slow closed paths
  for (int i = 0; i < NB; i++) {
    vec4 b = uBlob[i];
    vec2 c = b.xy + 0.05 * vec2(sin(t * 0.19 + float(i) * 1.7), cos(t * 0.15 + float(i) * 2.3));
    vec2 d = (p - c) / b.zw;
    col += uBlobC[i] * exp(-dot(d, d) * 2.0);
  }
  // vertical out-of-focus streaks (light shapes)
  float sx = vnoise(vec2(p.x * 3.0 + t * 0.03, 0.5));
  col += uC2 * 0.10 * smoothstep(0.55, 0.9, sx) * smoothstep(-0.5, 0.4, p.y);
  // low-frequency mottling
  float n = vnoise(p * 2.2 + vec2(t * 0.02, -t * 0.015)) * 0.6 + vnoise(p * 4.7 - t * 0.02) * 0.4;
  col *= 0.8 + 0.4 * n;
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  col = mix(vec3(lum) * vec3(0.92, 0.97, 1.1), col, 0.6) * 0.9;
  fragColor = vec4(col, 1.0);
}
`;

// [x, y, sx, sy, colour slot (0 main, 1 highlight, 2 deep×2.4, 3 light), gain]
const BLOBS: [number, number, number, number, number, number][] = [
  [-0.25, 0.44, 0.5, 0.3, 1, 0.75],
  [-0.55, 0.3, 0.4, 0.28, 1, 0.45],
  [0.7, 0.36, 0.55, 0.42, 3, 0.85],
  [-0.78, -0.05, 0.36, 0.5, 4, 0.4],
  [0.75, -0.2, 0.45, 0.45, 4, 0.22],
  [-0.1, -0.1, 0.55, 0.3, 0, 0.45],
  [0.3, 0.12, 0.35, 0.22, 4, 0.35],
  [-0.4, -0.42, 0.45, 0.22, 2, 0.2],
  [0.25, -0.3, 0.4, 0.25, 1, 0.3],
  [-0.12, 0.02, 0.32, 0.26, 1, 0.5],
  [-0.6, -0.35, 0.4, 0.25, 4, 0.4],
];
const blobColour = (row: HudPlaneRow, slot: number, gain: number) => {
  const c = new THREE.Color(row.bg[Math.min(slot, 2)]);
  // slots: 0 main, 1 highlight, 2 deep×2.4, 3 pale cyan-white, 4 teal haze
  if (slot === 2) c.multiplyScalar(2.4);
  if (slot === 3) c.set(row.bg[0]).lerp(new THREE.Color("#d8ecff"), 0.6);
  if (slot === 4) c.set(row.bg[2]).lerp(new THREE.Color("#3ab0c8"), 0.55);
  return c.multiplyScalar(gain);
};

// --------------------------------------------------------------- plane grid
const GRID_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; in float vViewZ; out vec4 fragColor;
uniform vec3 uColor; uniform float uOpacity; uniform vec2 uCells;
${GLSL_DOF}
float gridLine(float x, float w) {
  float fw = fwidth(x);
  float d = abs(fract(x + 0.5) - 0.5) / max(fw, 1e-5);
  return 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, d);
}
void main() {
  float r = cocPx(vViewZ);
  float w = 1.6 * uPxScale + r * 1.4;
  vec2 g = vUv * uCells;
  float l = max(gridLine(g.x, w), gridLine(g.y, w));
  float sub = max(gridLine(g.x * 4.0, w), gridLine(g.y * 4.0, w)) * 0.18;
  float e = (l + sub) * (1.6 * uPxScale + 0.5) / (w + 0.5);
  fragColor = vec4(uColor * e * uOpacity, 1.0);
}
`;
const GRID_VERT = /* glsl */ `
out vec2 vUv; out float vViewZ;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewZ = -mv.z; gl_Position = projectionMatrix * mv; }
`;

// -------------------------------------------------------------- live labels
type Live = { label: LiveLabel; x: number; y: number; w: number; h: number; len: number; slot: number; prefix?: string; suffix?: string; show: number };
const LIVE_DEFS: Omit<Live, "label">[] = [
  { x: CX + 10, y: CY + 360, w: 360, h: 50, len: 10, slot: 1, show: 5.6 },
  { x: CX + 0, y: CY + 300, w: 520, h: 34, len: 16, slot: 2, prefix: "91.", suffix: "//09", show: 5.2 },
  { x: 2700, y: 1035, w: 420, h: 34, len: 16, slot: 3, show: 5.0 },
  { x: 1380, y: 1000, w: 260, h: 30, len: 10, slot: 4, show: 4.6 },
  { x: 1230, y: 2110, w: 260, h: 30, len: 10, slot: 5, show: 6.0 },
  { x: 3360, y: 2200, w: 280, h: 30, len: 10, slot: 6, show: 6.4 },
  { x: 3500, y: 330, w: 300, h: 30, len: 12, slot: 7, show: 4.2 },
];
const HOLDS = [5, 9, 15, 25];

// ------------------------------------------------------------------ scene
const Scene: React.FC<{ row: HudPlaneRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sec = frame / FPS;
  const now = tl(sec);

  const assets = useMemo(() => {
    const sheet = buildSheet();
    const rings = [buildRing(0), buildRing(1), buildRing(2)];
    const centre = buildCentreText(row.centre);
    const sheetMat = makeHudMaterial({ map: sheet, line: row.hud, fill: row.fill, dof: DOF, fillOpacity: 0.55 });
    sheetMat.uniforms.uOpacity.value = 0.88;
    const ringMats = rings.map((t) => makeHudMaterial({ map: t, line: row.hud, dof: DOF }));
    const centreMat = makeTexMaterial({ map: centre, dof: DOF, tint: row.hud, additive: true, depthTest: false });
    const lives = LIVE_DEFS.map((d) => {
      const label = new LiveLabel(Math.round(d.w * 2), Math.round(d.h * 2), mono(Math.round(d.h * 2 * 0.72), 500), "center");
      const tex = label.draw("".padStart(d.len, "0"));
      const mat = makeHudMaterial({ map: tex, line: row.hud, dof: DOF });
      mat.uniforms.uNow.value = 2;
      return { ...d, label, mat };
    });
    const gridMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
      uniforms: { uColor: { value: new THREE.Color(row.hud).lerp(new THREE.Color("#6fdcff"), 0.45) }, uOpacity: { value: 0 }, uCells: { value: new THREE.Vector2(32, 18) }, ...dofUniforms(DOF) },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const bgMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uC1: { value: new THREE.Color(row.bg[0]) },
        uC2: { value: new THREE.Color(row.bg[1]) },
        uC3: { value: new THREE.Color(row.bg[2]) },
        uAspect: { value: 16 / 9 },
        uBlob: { value: BLOBS.map((b) => new THREE.Vector4(b[0], b[1], b[2], b[3])) },
        uBlobC: { value: BLOBS.map((b) => blobColour(row, b[4], b[5])) },
      },
      depthTest: false,
      depthWrite: false,
    });
    // fine dust specks and a few soft orbs drifting in front of the plane
    const drng = mulberry32(0xd057);
    const dust = makeBokeh(
      Array.from({ length: 140 }, (_, i) => ({
        x: (drng() * 2 - 1) * 7,
        y: (drng() * 2 - 1) * 4,
        z: -1 + drng() * 4,
        size: i < 12 ? 40 + drng() * 70 : 4 + drng() * 10,
        color: new THREE.Color(row.hud),
        gain: i < 12 ? 0.05 + drng() * 0.06 : 0.25 + drng() * 0.4,
      })),
      0xd058,
    );
    const g = new THREE.Color(row.bg[0]).lerp(new THREE.Color("#9fb0c8"), 0.5);
    const lift: [number, number, number] = [g.r * 0.04, g.g * 0.04, g.b * 0.04];
    return { sheetMat, ringMats, centreMat, lives, gridMat, bgMat, dust, lift };
  }, [row]);

  // ---- per-frame state: pure functions of `frame`
  assets.bgMat.uniforms.uTime.value = sec;
  assets.dust.material.uniforms.uPhase.value = frame / 450;
  assets.dust.material.uniforms.uGain.value = interpolate(sec, [0, 2], [0.3, 1], { extrapolateRight: "clamp" });
  assets.gridMat.uniforms.uOpacity.value = interpolate(sec, [0, 1.5, 4], [0, 0.42, 0.36], { extrapolateRight: "clamp" });
  assets.sheetMat.uniforms.uNow.value = now;
  assets.ringMats.forEach((m) => (m.uniforms.uNow.value = now));
  const aiOn = interpolate(sec, [4.9, 5.0, 5.08, 5.16, 5.3, 5.8], [0, 0.7, 0.15, 0.9, 0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const aiPulse = 1 + 0.06 * Math.sin((frame / 450) * Math.PI * 2 * 6);
  assets.centreMat.uniforms.uOpacity.value = aiOn * aiPulse * 1.35;
  assets.lives.forEach((l) => {
    const digitsStr = tickDigits(l.slot, frame, l.len, HOLDS, durationInFrames);
    const str = (l.prefix ?? "") + digitsStr + (l.suffix ?? "");
    l.mat.uniforms.uMap.value = l.label.draw(str);
    l.mat.uniforms.uOpacity.value = interpolate(sec, [l.show, l.show + 0.2], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  });

  // ring rotation (slow turn on the hold)
  const rot1 = (frame / 450) * Math.PI * 0.5;
  const rot2 = -(frame / 450) * Math.PI * 0.35;
  const rot0 = (frame / 450) * Math.PI * 0.12;
  const ringSize = 1024 * (PW / DW) * 0.84; // design px → world
  const [rcx, rcy] = toLocal(CX, CY);

  // camera: looking down at the tilted plane; slow closed drift + gentle push
  const push = interpolate(frame, [0, 450], [0, 1], { easing: Easing.inOut(Easing.sin) });
  const dist = 8.9 - 0.7 * push;
  const dx = 0.35 * Math.sin((frame / 450) * Math.PI * 2) ;
  const dy = 0.18 * Math.sin((frame / 450) * Math.PI * 2 + 1.2) ;

  return (
    <>
      <CameraRig position={[dx, dy, dist]} target={[dx * 0.4, dy * 0.4, 0]} fov={50} />
      <mesh frustumCulled={false} renderOrder={-10} material={assets.bgMat}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <group rotation={[-0.7, 0.22, 0.26]} position={[-1.15, 0.3, 0]}>
        <mesh renderOrder={1} material={assets.gridMat}>
          <planeGeometry args={[PW * 2, PH * 2]} />
        </mesh>
        <mesh renderOrder={2} material={assets.sheetMat}>
          <planeGeometry args={[PW, PH]} />
        </mesh>
        {[rot0, rot1, rot2].map((r, i) => (
          <mesh key={i} renderOrder={3} position={[rcx, rcy, 0.002]} rotation={[0, 0, r]} material={assets.ringMats[i]}>
            <planeGeometry args={[ringSize, ringSize]} />
          </mesh>
        ))}
        <mesh renderOrder={4} position={[rcx, rcy + 0.02, 0.004]} material={assets.centreMat}>
          <planeGeometry args={[ringSize * 0.5, ringSize * 0.25]} />
        </mesh>
        {assets.lives.map((l, i) => {
          const [lx, ly] = toLocal(l.x, l.y);
          return (
            <mesh key={i} renderOrder={5} position={[lx, ly, 0.003]} material={l.mat}>
              <planeGeometry args={[(l.w / DW) * PW, (l.h / DH) * PH]} />
            </mesh>
          );
        })}
      </group>
      <primitive object={assets.dust} />
      <Pipeline frame={frame} period={durationInFrames} bloomStrength={1.3} bloomThreshold={0.3} vignette={0.5} grain={0.015} saturation={0.95} chroma={11} lift={assets.lift} />
    </>
  );
};

export const AIHudPlane: React.FC<{ row: HudPlaneRow }> = ({ row }) => (
  <Stage fov={50}>
    <Scene row={row} />
  </Stage>
);
