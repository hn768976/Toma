import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Land, landMask, useAssets } from "../lib/assets";
import { makeCanvasTex, redraw, roundRect } from "../lib/canvasTex";
import { easeInOutSine, progress } from "../lib/ease";
import { DOF_TEXTURE, DOF_UNIFORMS, HASH } from "../lib/glsl";
import { addBlend, marginPlane, premulBlend, STD_VERT } from "../lib/mesh";
import { PostParams } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { makeShared, Shared, Stage } from "../lib/Stage";

// Look 1 — AI Agents Chip. A glowing "AI" chip with circuit traces over a
// dotted Natural Earth map; glitch build-in 1–3.5s, then a live hold.

export type ChipPalette = {
  bgLow: string;
  bgHigh: string;
  mapDot: string;
  chipEdge: string;
  glass: string;
  rain: string;
  speck: string;
  accent: string;
};

const lin = (hex: string) => new THREE.Color(hex);

const MAP_W = 6.7;
const MAP_ASPECT = 1.69;
const TRACE_SIZE = 3.4; // units covered by the trace texture
const CHIP = 1.3;

// ---------- static textures (deterministic, built once per tab) ----------

const drawDotMap = (land: Land) => {
  const W = 4096;
  const H = Math.round(W / MAP_ASPECT);
  const ct = makeCanvasTex(W, H, true);
  const inLand = landMask(land, 2048, 1024);
  const rnd = mulberry32(1101);
  const cols = 230;
  const step = W / cols;
  const rows = Math.floor(H / step);
  const latTop = 83;
  const latBot = -58;
  redraw(ct, "static", (ctx) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols;
        const v = (r + 0.5) / rows;
        const lon = -180 + u * 360;
        const lat = latTop + (latBot - latTop) * v;
        const land = inLand((lon + 180) / 360, (90 - lat) / 180);
        const x = c * step + step * 0.5;
        const y = r * step + step * 0.5;
        const k = rnd();
        if (land) {
          const a = 0.55 + 0.45 * k;
          const s = step * (k > 0.97 ? 0.72 : 0.6);
          ctx.fillStyle = k > 0.985 ? `rgba(150,215,255,${a})` : `rgba(90,170,225,${a})`;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        } else if (k > 0.55) {
          ctx.fillStyle = `rgba(60,120,180,${0.1 + 0.08 * k})`;
          const s = step * 0.32;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    }
  });
  return ct;
};

type Trace = { pts: [number, number][]; phase: number };

const buildTraces = (): Trace[] => {
  const rnd = mulberry32(2207);
  const out: Trace[] = [];
  const half = CHIP / 2;
  // side: 0 top, 1 right, 2 bottom, 3 left
  for (let side = 0; side < 4; side++) {
    const n = side === 0 ? 7 : side === 2 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const s = -half * 0.78 + (i / (n - 1)) * half * 1.56;
      const out1 = 0.12 + rnd() * 0.18;
      const bendDir = s === 0 ? 0 : Math.sign(s);
      const diag = 0.08 + rnd() * (side === 2 ? 0.12 : 0.25) * Math.abs(s / half);
      const run = 0.08 + rnd() * (side === 0 ? 0.55 : side === 2 ? 0.12 : 0.35);
      const local: [number, number][] = [
        [s, half],
        [s, half + out1],
        [s + bendDir * diag, half + out1 + diag],
        [s + bendDir * diag + (rnd() < 0.35 ? bendDir * run * 0.6 : 0), half + out1 + diag + run],
      ];
      const rot = (p: [number, number]): [number, number] => {
        const [x, y] = p;
        if (side === 0) return [x, y];
        if (side === 1) return [y, -x];
        if (side === 2) return [-x, -y];
        return [-y, x];
      };
      out.push({ pts: local.map(rot), phase: rnd() });
    }
  }
  return out;
};

const drawTraces = (traces: Trace[]) => {
  const S = 2048;
  const look = makeCanvasTex(S, S, false);
  const param = makeCanvasTex(S, S, false, false);
  const toPx = (p: [number, number]) => [((p[0] / TRACE_SIZE) + 0.5) * S, (0.5 - p[1] / TRACE_SIZE) * S];
  const lw = 5.5;
  redraw(look, "static", (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgb(255,0,0)";
    ctx.lineWidth = lw;
    for (const t of traces) {
      ctx.beginPath();
      t.pts.forEach((p, i) => {
        const [x, y] = toPx(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgb(0,255,0)";
    for (const t of traces) {
      const [x, y] = toPx(t.pts[t.pts.length - 1]);
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // Parameter texture: R = distance along the trace (0 at chip), G = phase.
  redraw(param, "static", (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    ctx.lineCap = "butt";
    for (const t of traces) {
      const px = t.pts.map(toPx);
      const segLen = px.slice(1).map((p, i) => Math.hypot(p[0] - px[i][0], p[1] - px[i][1]));
      const total = segLen.reduce((a, b) => a + b, 0);
      let acc = 0;
      for (let i = 0; i < segLen.length; i++) {
        const a0 = acc / total;
        acc += segLen[i];
        const a1 = acc / total;
        const g = ctx.createLinearGradient(px[i][0], px[i][1], px[i + 1][0], px[i + 1][1]);
        const ph = Math.round(t.phase * 255);
        g.addColorStop(0, `rgb(${Math.round(a0 * 255)},${ph},255)`);
        g.addColorStop(1, `rgb(${Math.round(a1 * 255)},${ph},255)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = lw * 3;
        ctx.beginPath();
        ctx.moveTo(px[i][0], px[i][1]);
        ctx.lineTo(px[i + 1][0], px[i + 1][1]);
        ctx.stroke();
      }
      const e = px[px.length - 1];
      ctx.fillStyle = `rgb(255,${Math.round(t.phase * 255)},255)`;
      ctx.beginPath();
      ctx.arc(e[0], e[1], 20, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  param.tex.minFilter = THREE.NearestFilter;
  param.tex.magFilter = THREE.NearestFilter;
  return { look, param };
};

// Chip face: R = "AI" outline, G = border, B = inner circuit lines.
const drawChipFace = () => {
  const S = 1024;
  const ct = makeCanvasTex(S, S, false);
  const rnd = mulberry32(3301);
  redraw(ct, "static", (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = "lighter";
    // inner circuit (B)
    ctx.strokeStyle = "rgb(0,0,255)";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 46; i++) {
      let x = 80 + rnd() * (S - 160);
      let y = 80 + rnd() * (S - 160);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const d = 40 + rnd() * 120;
        const dir = Math.floor(rnd() * 8) * (Math.PI / 4);
        x = Math.min(S - 70, Math.max(70, x + Math.cos(dir) * d));
        y = Math.min(S - 70, Math.max(70, y + Math.sin(dir) * d));
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = "rgb(0,0,255)";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // border (G)
    ctx.strokeStyle = "rgb(0,255,0)";
    ctx.lineWidth = 9;
    roundRect(ctx, 22, 22, S - 44, S - 44, 70);
    ctx.stroke();
    // "AI" outline (R)
    ctx.strokeStyle = "rgb(255,0,0)";
    ctx.lineWidth = 12;
    ctx.lineJoin = "round";
    ctx.font = "500 350px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("AI", S / 2, S * 0.47);
  });
  return ct;
};

const drawGlyphs = () => {
  const ct = makeCanvasTex(256, 128, false);
  redraw(ct, "static", (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#fff";
    ctx.font = "500 104px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("0", 64, 68);
    ctx.fillText("1", 192, 68);
  });
  return ct;
};

// ---------- shaders ----------

const GLITCH = /* glsl */ `
uniform float uReveal;   // seconds since build start (t - 1.0)
uniform float uGlitch;   // glitch intensity 0..1
uniform float uFrameStep;
// returns: x = visibility, y = horizontal uv offset, z = flash
vec3 glitchBlock(vec2 uv, vec2 blocks, float salt) {
  vec2 b = floor(uv * blocks);
  float h = hash33u(uvec3(uvec2(ivec2(b) + 1000), uint(salt))).x;
  float th = 0.15 + h * 2.0;
  float vis = step(th, uReveal);
  vec3 r = hash33u(uvec3(uvec2(ivec2(b) + 1000), uint(uFrameStep) * 7u + uint(salt) + 3u));
  float near = 1.0 - smoothstep(0.0, 0.45, abs(uReveal - th));
  float act = max(near, uGlitch * step(0.88, r.x));
  float off = (r.y - 0.5) * 0.08 * act;
  float flash = act * step(0.6, r.z);
  return vec3(vis * (1.0 - 0.6 * act * step(0.5, r.z)), off, flash);
}
`;

const mapMaterial = (shared: Shared, map: THREE.Texture, pal: ChipPalette) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      tMap: { value: map },
      uTint: { value: lin(pal.mapDot) },
      uReveal: { value: 0 },
      uGlitch: { value: 0 },
      uFrameStep: { value: 0 },
    },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform vec3 uTint; uniform float uTime;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      ${GLITCH}
      void main() {
        vec3 g = glitchBlock(vUv, vec2(34.0, 20.0), 11.0);
        vec2 uv = vUv + vec2(g.y, 0.0);
        float coc = cocFrac(vDepth) * uRes.y;
        vec4 c = dofTexture(tMap, uv, coc);
        // brighter toward the middle, with a slow drifting light
        vec2 q = (vUv - vec2(0.5, 0.45)) * vec2(1.69, 1.0);
        float center = 0.55 + 0.75 * exp(-dot(q, q) * 2.2);
        float drift = 0.85 + 0.3 * fbm(vUv * vec2(3.0, 1.8) + vec2(uTime * 0.03, -uTime * 0.02));
        vec3 col = c.rgb * center * drift * 1.15;
        // split-channel ghost while glitching
        col += vec3(0.0, 0.25, 0.6) * g.z * c.a;
        float a = c.a * g.x;
        gl_FragColor = vec4(col * g.x, a);
      }`,
    ...premulBlend,
  });

const traceMaterial = (shared: Shared, look: THREE.Texture, param: THREE.Texture, pal: ChipPalette) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      tLook: { value: look },
      tParam: { value: param },
      uEdge: { value: lin(pal.chipEdge) },
      uReveal: { value: 0 },
      uGlitch: { value: 0 },
      uFrameStep: { value: 0 },
      uGrow: { value: 0 },
    },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tLook; uniform sampler2D tParam; uniform vec3 uEdge; uniform float uTime, uGrow;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      ${GLITCH}
      void main() {
        vec3 g = glitchBlock(vUv, vec2(16.0, 16.0), 23.0);
        vec2 uv = vUv + vec2(g.y * 0.5, 0.0);
        float coc = cocFrac(vDepth) * uRes.y;
        vec4 L = dofTexture(tLook, uv, coc);
        vec4 P = texture(tParam, uv);
        float along = P.r, ph = P.g;
        // traces draw outward from the chip
        float grown = smoothstep(along - 0.04, along, uGrow);
        float line = L.r * grown;
        float dot_ = L.g * step(0.98, uGrow);
        // pulses running outward
        float s = fract(along * 1.6 - uTime * 0.42 + ph * 7.0);
        float pulse = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.08, 0.22, s));
        vec3 base = uEdge * 0.55;
        vec3 col = line * (base + uEdge * pulse * 3.2);
        float tw = 0.75 + 0.25 * sin(uTime * 2.3 + ph * 40.0);
        col += dot_ * mix(uEdge, vec3(1.0), 0.75) * (1.5 + 0.8 * tw);
        float a = clamp(line + dot_, 0.0, 1.0) * g.x;
        gl_FragColor = vec4(col * g.x, a * 0.9);
      }`,
    ...premulBlend,
  });

const chipMaterial = (shared: Shared, face: THREE.Texture, pal: ChipPalette) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      tFace: { value: face },
      uEdge: { value: lin(pal.chipEdge) },
      uGlass: { value: lin(pal.glass) },
      uReveal: { value: 0 },
      uGlitch: { value: 0 },
      uFrameStep: { value: 0 },
      uOn: { value: 0 },
    },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tFace; uniform vec3 uEdge, uGlass; uniform float uTime, uOn;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      ${GLITCH}
      float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec3 g = glitchBlock(vUv, vec2(10.0, 10.0), 37.0);
        vec2 uv = vUv + vec2(g.y * 0.6, 0.0);
        float coc = cocFrac(vDepth) * uRes.y;
        vec4 F = dofTexture(tFace, uv, coc);
        vec2 p = uv - 0.5;
        float d = rbox(p, vec2(0.478), 0.07);
        float inside = 1.0 - smoothstep(-0.004, 0.004, d);
        // glass: deep blue with marbled light wisps (shimmer)
        vec2 w = uv * 3.2;
        float warp = fbm(w * 0.8 + vec2(uTime * 0.05, uTime * 0.03));
        float m = fbm(w + vec2(warp * 2.2, -warp * 1.6) + vec2(-uTime * 0.04, uTime * 0.06));
        float wisps = pow(smoothstep(0.42, 0.9, m), 2.4);
        float veins = pow(1.0 - abs(fbm(w * 1.7 + warp * 3.0 - uTime * 0.05) - 0.5) * 2.0, 10.0);
        vec3 glass = uGlass * (0.55 + 0.6 * (1.0 - uv.y));
        float bottom = exp(-pow(length((uv - vec2(0.5, 0.0)) * vec2(1.4, 2.4)), 2.0) * 3.0);
        glass += vec3(0.3, 0.7, 1.0) * wisps * (0.3 + 1.2 * bottom);
        glass += vec3(0.35, 0.8, 1.0) * veins * 0.22;
        glass += uEdge * bottom * 1.6;
        // shimmer sweep across the face every few seconds
        float sweep = fract(uTime / 5.5);
        float band = exp(-pow((uv.x + uv.y * 0.6 - sweep * 2.6 + 0.4) * 9.0, 2.0));
        glass += vec3(0.5, 0.85, 1.0) * band * 0.35;
        vec3 col = glass * inside;
        col += uEdge * F.b * 0.35 * inside;
        col += mix(uEdge, vec3(1.0), 0.6) * F.r * 1.8;
        col += mix(uEdge, vec3(1.0), 0.35) * F.g * 2.4;
        // outer edge glow
        float halo = exp(-max(d, 0.0) * 60.0) * (1.0 - inside);
        col += uEdge * halo * 0.5;
        float a = max(inside * 0.96, max(F.g, halo * 0.5));
        col += vec3(0.2, 0.6, 1.0) * g.z;
        a *= g.x * uOn; col *= g.x * uOn;
        gl_FragColor = vec4(col, a);
      }`,
    ...premulBlend,
  });

const glowMaterial = (shared: Shared, color: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: color }, uAmp: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmp;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float core = exp(-dot(p * vec2(3.0, 9.0), p * vec2(3.0, 9.0)));
        float soft = exp(-dot(p * vec2(1.2, 3.2), p * vec2(1.2, 3.2))) * 0.35;
        float streak = exp(-abs(p.y) * 40.0) * exp(-abs(p.x) * 2.2) * 0.6;
        vec3 col = uColor * (soft + streak) + mix(uColor, vec3(1.0), 0.7) * core * 2.5;
        gl_FragColor = vec4(col * uAmp, 0.0);
      }`,
    ...addBlend,
  });

const bgMaterial = (shared: Shared, pal: ChipPalette) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uLow: { value: lin(pal.bgLow) }, uHigh: { value: lin(pal.bgHigh) }, uFade: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uLow, uHigh; uniform float uFade, uTime;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vec2 q = (vUv - vec2(0.5, 0.58)) * vec2(1.78, 1.0);
        float g = exp(-dot(q, q) * 3.2);
        vec3 col = mix(uLow * 0.55, uHigh * 1.25, g);
        // faint vertical light streaks
        float col_ = floor(vUv.x * 160.0);
        float s = hash11(col_);
        float streak = step(0.86, s) * (0.25 + 0.75 * fbm(vec2(col_ * 0.3, vUv.y * 3.0 - uTime * 0.08 * (0.5 + s))));
        col += uHigh * streak * 0.18;
        gl_FragColor = vec4(col * uFade, 1.0);
      }`,
    depthWrite: false,
  });

// Binary rain: procedural columns of 0/1 glyphs falling slowly.
const rainMaterial = (shared: Shared, glyphs: THREE.Texture, pal: ChipPalette, cols: number, rows: number, seed: number, amp: number) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      tGlyph: { value: glyphs },
      uColor: { value: lin(pal.rain) },
      uGrid: { value: new THREE.Vector2(cols, rows) },
      uSeed: { value: seed },
      uAmp: { value: amp },
      uFade: { value: 0 },
    },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tGlyph; uniform vec3 uColor; uniform vec2 uGrid; uniform float uSeed, uAmp, uFade, uTime;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      void main() {
        float c = floor(vUv.x * uGrid.x);
        vec3 hc = hash33u(uvec3(uint(c + 5000.0), uint(uSeed), 1u));
        if (hc.x < 0.55) discard;
        float speed = 0.6 + hc.y * 1.8;           // cells per second
        float y = (1.0 - vUv.y) * uGrid.y - uTime * speed - hc.z * 400.0;
        float r = floor(y);
        vec2 cell = vec2(fract(vUv.x * uGrid.x), fract(y));
        float gid = step(0.5, hash33u(uvec3(uint(c + 5000.0), uint(r + 90000.0), uint(uSeed) + 2u)).x);
        // glyph aspect: cell is narrow; glyph occupies the middle
        vec2 guv = vec2((gid + 0.2 + cell.x * 0.6) * 0.5, 1.0 - cell.y);
        float coc = cocFrac(vDepth) * uRes.y;
        vec2 dx = dFdx(guv) * (1.0 + coc * 0.6), dy = dFdy(guv) * (1.0 + coc * 0.6);
        float gl = textureGrad(tGlyph, guv, dx, dy).r;
        // trail brightness: a head travels down each column
        float head = fract(uTime * (0.05 + hc.y * 0.08) + hc.z) * (uGrid.y + 30.0);
        float rowFromTop = (1.0 - vUv.y) * uGrid.y;
        float behind = head - rowFromTop;
        float trail = behind > 0.0 ? exp(-behind / (8.0 + hc.x * 18.0)) : 0.0;
        float base = 0.18 + 0.2 * hash33u(uvec3(uint(c + 5000.0), uint(r + 90000.0), 9u)).x;
        float a = gl * (base + trail * 1.4) * uAmp * uFade / (1.0 + coc * 0.08);
        gl_FragColor = vec4(uColor * a, 0.0);
      }`,
    ...addBlend,
  });

// Light specks: points with in-shader depth of field (size grows with CoC,
// brightness falls with area).
const speckGeometry = (n: number) => {
  const rnd = mulberry32(4441);
  const pos = new Float32Array(n * 3);
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rnd() - 0.5) * 16;
    pos[i * 3 + 1] = (rnd() - 0.5) * 9;
    pos[i * 3 + 2] = -6 + rnd() * 10.5;
    data[i * 4] = 0.006 + Math.pow(rnd(), 3) * 0.05; // size
    data[i * 4 + 1] = rnd(); // phase
    data[i * 4 + 2] = rnd() < 0.06 ? 1 : 0; // warm accent
    data[i * 4 + 3] = rnd(); // brightness
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aData", new THREE.BufferAttribute(data, 4));
  return g;
};

const speckMaterial = (shared: Shared, pal: ChipPalette) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: lin(pal.speck) }, uAccent: { value: lin(pal.accent) }, uFade: { value: 0 }, uFovScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec4 aData;
      uniform float uTime, uFovScale;
      varying float vAlpha; varying float vWarm; varying float vSoft;
      ${DOF_UNIFORMS}
      void main() {
        vec3 p = position;
        p.y = mod(position.y + uTime * (0.03 + aData.y * 0.05) + 4.5, 9.0) - 4.5;
        p.x += sin(uTime * 0.2 + aData.y * 20.0) * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        float px = aData.x * uRes.y * uFovScale / depth;
        float coc = cocFrac(depth) * uRes.y * 2.0;
        float sz = max(px, 1.0) + coc;
        gl_PointSize = sz;
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aData.y * 3.0) + aData.y * 50.0);
        vAlpha = (0.25 + 0.75 * aData.w) * tw * min(1.0, (px * px) / (sz * sz) * 1.0 + 0.0) * (px < 1.0 ? px : 1.0);
        vWarm = aData.z;
        vSoft = coc / sz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uAccent; uniform float uFade;
      varying float vAlpha; varying float vWarm; varying float vSoft;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float sq = max(abs(p.x), abs(p.y));
        float disk = length(p);
        float shape = mix(1.0 - smoothstep(0.75, 1.0, sq), 1.0 - smoothstep(0.6, 1.0, disk), clamp(vSoft * 1.5, 0.0, 1.0));
        vec3 c = mix(uColor, uAccent, vWarm) * 1.6;
        gl_FragColor = vec4(c * shape * vAlpha * uFade, 0.0);
      }`,
    ...addBlend,
  });

// ---------- scene ----------

type Built = {
  group: THREE.Group;
  camera: THREE.PerspectiveCamera;
  shared: Shared;
  update: (frame: number, fps: number) => void;
};

const build = (land: Land, pal: ChipPalette): Built => {
  const shared = makeShared();
  const group = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);

  const bg = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), bgMaterial(shared, pal));
  bg.position.set(0.14, -0.43, -8);
  bg.renderOrder = -10;
  group.add(bg);

  const glyphs = drawGlyphs();
  const rainFar = new THREE.Mesh(new THREE.PlaneGeometry(20, 11.5), rainMaterial(shared, glyphs.tex, pal, 330, 230, 5, 0.26));
  rainFar.position.set(0.14, -0.43, -4);
  rainFar.renderOrder = -9;
  group.add(rainFar);

  const dotMap = drawDotMap(land);
  const mapMat = mapMaterial(shared, dotMap.tex, pal);
  const mapMesh = new THREE.Mesh(marginPlane(MAP_W, MAP_W / MAP_ASPECT, 0.02), mapMat);
  mapMesh.position.set(-0.05, -0.21, -0.25);
  mapMesh.renderOrder = -5;
  group.add(mapMesh);

  const traces = drawTraces(buildTraces());
  const traceMat = traceMaterial(shared, traces.look.tex, traces.param.tex, pal);
  const traceMesh = new THREE.Mesh(new THREE.PlaneGeometry(TRACE_SIZE, TRACE_SIZE), traceMat);
  traceMesh.position.set(0, 0, -0.02);
  traceMesh.renderOrder = -3;
  group.add(traceMesh);

  const bigGlow = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), glowMaterial(shared, lin(pal.chipEdge)));
  bigGlow.position.set(0, -0.2, -0.1);
  bigGlow.renderOrder = -4;
  group.add(bigGlow);

  const face = drawChipFace();
  const chipMat = chipMaterial(shared, face.tex, pal);
  const chip = new THREE.Mesh(marginPlane(CHIP, CHIP, 0.06), chipMat);
  chip.renderOrder = -1;
  group.add(chip);

  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), glowMaterial(shared, lin(pal.chipEdge)));
  pool.position.set(0, -CHIP / 2 + 0.02, 0.05);
  pool.renderOrder = 2;
  group.add(pool);

  const label = makeCanvasTex(1024, 192, true);
  const labelMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, tMap: { value: label.tex }, uOpacity: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform float uOpacity;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      void main() {
        vec4 c = dofTexture(tMap, vUv, cocFrac(vDepth) * uRes.y);
        gl_FragColor = vec4(c.rgb * 1.15, c.a) * uOpacity;
      }`,
    ...premulBlend,
  });
  const labelW = 1.62;
  const labelMesh = new THREE.Mesh(marginPlane(labelW, (labelW * 192) / 1024, 0.03), labelMat);
  labelMesh.position.set(0.04, -1.47, 0.0);
  labelMesh.renderOrder = 3;
  group.add(labelMesh);

  const specks = new THREE.Points(speckGeometry(520), speckMaterial(shared, pal));
  specks.frustumCulled = false;
  specks.renderOrder = 5;
  group.add(specks);

  const rainNear = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.2), rainMaterial(shared, glyphs.tex, pal, 130, 90, 9, 0.06));
  rainNear.position.set(0.14, -0.43, 3.2);
  rainNear.renderOrder = 6;
  group.add(rainNear);

  const glitchMats = [mapMat, traceMat, chipMat];
  const fovScale = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
  (specks.material as THREE.ShaderMaterial).uniforms.uFovScale.value = fovScale;

  const update = (frame: number, fps: number) => {
    const t = frame / fps;
    shared.uTime.value = t;
    // mild depth of field, focus on the chip
    const push = easeInOutSine(progress(t, 2.5, 20));
    const camZ = 10.2 - 1.25 * push;
    shared.uDof.value.set(camZ, 0.012, 0.03);

    const fade = progress(t, 0.0, 1.2);
    (bg.material as THREE.ShaderMaterial).uniforms.uFade.value = 0.35 + 0.65 * fade;
    for (const m of [rainFar.material, rainNear.material, specks.material] as THREE.ShaderMaterial[]) {
      m.uniforms.uFade.value = 0.3 + 0.7 * progress(t, 0.6, 2.2);
    }
    const reveal = t - 1.0;
    const glitch = t < 1 ? 0 : t < 3.6 ? 1 - progress(t, 2.8, 3.6) : 0;
    for (const m of glitchMats) {
      m.uniforms.uReveal.value = reveal;
      m.uniforms.uGlitch.value = glitch;
      m.uniforms.uFrameStep.value = Math.floor(frame / 2);
    }
    chipMat.uniforms.uOn.value = progress(t, 1.5, 1.9);
    traceMat.uniforms.uGrow.value = progress(t, 1.9, 3.1) * 1.02;
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.7);
    (pool.material as THREE.ShaderMaterial).uniforms.uAmp.value = progress(t, 1.8, 2.6) * 1.1 * pulse;
    (bigGlow.material as THREE.ShaderMaterial).uniforms.uAmp.value = progress(t, 1.8, 3.0) * 0.16;

    // label types in 2.6 – 3.5 s, cursor blinks briefly after
    const full = "AI Agents";
    const n = Math.floor(progress(t, 2.6, 3.4) * full.length + 1e-6);
    const cursor = t > 2.5 && t < 4.3 && Math.floor(t * 4) % 2 === 0;
    const boxOn = progress(t, 2.4, 2.65);
    labelMat.uniforms.uOpacity.value = boxOn;
    redraw(label, `${n}|${cursor ? 1 : 0}`, (ctx) => {
      ctx.fillStyle = "rgba(8,40,70,0.55)";
      roundRect(ctx, 8, 8, 1008, 176, 22);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,200,240,0.85)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.font = "500 112px Inter";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#F2FAFF";
      const fullW = ctx.measureText(full).width;
      const x0 = 512 - fullW / 2;
      const s = full.slice(0, n);
      ctx.fillText(s, x0, 100);
      if (cursor && n < full.length + 1) {
        const w = ctx.measureText(s).width;
        ctx.fillRect(x0 + w + 6, 46, 9, 104);
      }
    });

    const drift = Math.sin(t * 0.25) * 0.06;
    camera.position.set(0.14 + drift, -0.43 + 0.03 * Math.sin(t * 0.19), camZ);
    camera.lookAt(0.14 + drift * 0.6, -0.43, 0);
    camera.updateMatrixWorld();
  };

  return { group, camera, shared, update };
};

const post: PostParams = {
  exposure: 1.0,
  bloomStrength: 1.1,
  bloomThreshold: 0.75,
  bloomKnee: 0.45,
  vignette: 0.35,
  grain: 0.015,
};

const Scene: React.FC<{ land: Land; palette: ChipPalette }> = ({ land, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const built = useMemo(() => build(land, palette), [land, palette]);
  built.update(frame, fps);
  return (
    <Stage camera={built.camera} post={post} clear={palette.bgLow} shared={built.shared}>
      <primitive object={built.group} />
    </Stage>
  );
};

export const AIAgentsChip: React.FC<{ palette: ChipPalette }> = ({ palette }) => {
  const assets = useAssets(true);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {assets?.land ? <Scene land={assets.land} palette={palette} /> : null}
    </AbsoluteFill>
  );
};
