import * as THREE from "three";
import type { LookFactory } from "../core/Stage";
import { canvasTexture, font, hexVec, landPath, makeCanvas, rgba, type Ctx } from "../core/canvas";
import { getLand } from "../core/assets";
import { layerMaterial } from "../core/layers";
import { clamp, easeInOutCubic, easeOutCubic, hash01, mulberry32, range, smoothstep, TAU } from "../core/random";

// Look 3 — Commodity Board. A dense commodity-market terminal drawn into one
// large canvas (8192×4608 at 4K) on a plane tilted ~50°, with a diagonal
// camera glide. 0–1.5 s soft blue gradient; 1.5–3.5 s bands fade/slide in
// one by one; then live. The canvas is rebuilt from scratch every frame:
// pre-rendered static bands + every live element, all from the frame number.

export type CommodityBoardProps = {
  names: string[];
  bg: string;
  panel: string;
  text: string;
  highlight: string;
  up: string;
  down: string;
};

const DW = 8192;
const DH = 4608;
const PW = 34;
const PH = (PW * DH) / DW;

type Kind = "bars" | "line" | "table" | "chips" | "tile" | "donuts" | "gauge" | "list" | "hitable" | "dotline";
type Cell = { kind: Kind; x: number; w: number; seed: number; name?: string; gauge?: number };
type Band = { y: number; h: number; cells: Cell[]; chart?: boolean };

const tick = (frame: number, period: number, salt: number) => Math.floor((frame + salt * 13) / period);

// ---- Layout (module level, seeded) ---------------------------------------
const buildBands = (names: string[]): Band[] => {
  const rng = mulberry32(46349);
  const bands: Band[] = [];
  let y = 40;
  const row = (h: number, kinds: Kind[], widths: [number, number], extra: Partial<Band> = {}) => {
    const cells: Cell[] = [];
    let x = 40;
    let i = 0;
    while (x < DW - 200) {
      const w = Math.min(DW - 40 - x, Math.round(range(rng, widths[0], widths[1])));
      cells.push({ kind: kinds[i % kinds.length], x, w, seed: Math.floor(rng() * 1e6) });
      x += w + 24;
      i++;
    }
    bands.push({ y, h, cells, ...extra });
    y += h + 30;
  };
  row(330, ["bars", "line", "table", "bars", "donuts", "line", "bars", "table"], [560, 900]);
  row(250, ["table", "bars", "table", "line", "table", "bars"], [480, 760]);
  // commodity tiles: every name once, plus a pair of small donuts
  {
    const cells: Cell[] = [];
    let x = 40;
    names.forEach((n, i) => {
      if (i === 2) {
        cells.push({ kind: "donuts", x, w: 260, seed: 77 });
        x += 280;
      }
      cells.push({ kind: "tile", x, w: 470, seed: 100 + i, name: n });
      x += 490;
    });
    if (x < DW - 300) cells.push({ kind: "table", x, w: DW - 40 - x, seed: 5 });
    bands.push({ y, h: 300, cells });
    y += 330;
  }
  row(250, ["chips"], [1400, 2000]);
  row(250, ["chips"], [1300, 2100]);
  bands.push({ y, h: 1050, cells: [], chart: true });
  y += 1080;
  row(560, ["table", "dotline", "table", "hitable", "hitable", "list"], [900, 1300]);
  row(620, ["bars", "gauge", "gauge", "bars", "line", "donuts"], [900, 1400]);
  const rest = DH - 40 - y;
  if (rest > 120) row(rest, ["list", "bars", "table", "bars", "list"], [1000, 1500]);
  // two of the gauges carry the headline numbers
  let gi = 0;
  bands.forEach((b) =>
    b.cells.forEach((c) => {
      if (c.kind === "gauge") c.gauge = [46.3, 49.7, 17.8, 19.5][gi++ % 4];
    }),
  );
  return bands;
};

// ---- Drawing helpers ------------------------------------------------------
const tri = (ctx: Ctx, x: number, y: number, s: number, up: boolean) => {
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y - s * 0.55);
    ctx.lineTo(x + s * 0.55, y + s * 0.45);
    ctx.lineTo(x - s * 0.55, y + s * 0.45);
  } else {
    ctx.moveTo(x, y + s * 0.55);
    ctx.lineTo(x + s * 0.55, y - s * 0.45);
    ctx.lineTo(x - s * 0.55, y - s * 0.45);
  }
  ctx.closePath();
  ctx.fill();
};

const walk = (() => {
  const N = 1400;
  const v: number[] = [];
  const r = mulberry32(9917);
  let x = 0.5;
  for (let i = 0; i < N; i++) {
    x += (r() - 0.5) * 0.16 + (0.5 + 0.25 * Math.sin(i / 23) - x) * 0.08;
    v.push(x + 0.1 * Math.sin(i / 5) + (r() < 0.04 ? (r() - 0.5) * 0.5 : 0));
  }
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return (i: number) => 0.08 + (0.84 * (v[Math.max(0, Math.min(N - 1, i))] - lo)) / (hi - lo);
})();

const drawStaticBand = (ctx: Ctx, b: Band, p: CommodityBoardProps) => {
  const T = p.text;
  // bright separator rule above each band
  ctx.fillStyle = rgba(p.highlight, 0.55);
  ctx.fillRect(0, b.y - 16, DW, 4);
  if (b.chart) {
    ctx.fillStyle = rgba(p.panel, 0.35);
    ctx.fillRect(0, b.y, DW, b.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, b.y, DW, b.h);
    ctx.clip();
    landPath(ctx, getLand(), { x: 600, y: b.y - 250, w: 7000, h: b.h + 600, latTop: 80, latBottom: -58 });
    ctx.fillStyle = rgba(p.highlight, 0.07);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(T, 0.1);
    ctx.lineWidth = 3;
    for (let k = 1; k < 8; k++) {
      ctx.beginPath();
      ctx.moveTo(0, b.y + (k * b.h) / 8);
      ctx.lineTo(DW, b.y + (k * b.h) / 8);
      ctx.stroke();
    }
    return;
  }
  for (const c of b.cells) {
    const r = mulberry32(c.seed);
    // patchwork: some panels lighter, some near-black navy
    ctx.fillStyle = rgba(p.panel, 0.25 + 0.5 * r());
    ctx.fillRect(c.x, b.y, c.w, b.h);
    ctx.strokeStyle = rgba(p.highlight, 0.32);
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x, b.y, c.w, b.h);
    ctx.textBaseline = "middle";
    if (c.kind === "tile" && c.name) {
      ctx.fillStyle = T;
      ctx.font = font(800, 64, "Inter");
      ctx.fillText(c.name, c.x + 26, b.y + 64);
      ctx.font = font(500, 40, "Inter");
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = rgba(p.highlight, 0.95);
        ctx.fillRect(c.x + 34, b.y + 150 + k * 66 - 14, 28, 28);
        ctx.fillStyle = rgba(T, 0.85);
        ctx.fillText(range(r, 100, 999).toFixed(2), c.x + 80, b.y + 150 + k * 66);
      }
    } else if (c.kind === "table" || c.kind === "list") {
      ctx.fillStyle = rgba(T, 0.5);
      for (let k = 0; k < 3; k++) ctx.fillRect(c.x + 30, b.y + 30 + k * 26, range(r, 80, 220), 10);
    }
  }
};

const drawLiveCell = (ctx: Ctx, b: Band, c: Cell, frame: number, p: CommodityBoardProps) => {
  const T = p.text;
  const H = p.highlight;
  const r = mulberry32(c.seed + 1);
  const grow = easeOutCubic((frame - 60) / 45);
  const val = (base: number, period: number, salt: number) => base * (1 + 0.04 * (hash01(tick(frame, period, salt), salt, c.seed) - 0.5));
  const x0 = c.x + 24;
  const x1 = c.x + c.w - 24;
  const y0 = b.y + 24;
  const y1 = b.y + b.h - 24;
  ctx.textBaseline = "middle";
  switch (c.kind) {
    case "bars": {
      const n = Math.max(6, Math.floor((x1 - x0) / (b.h > 500 ? 90 : 46)));
      const bw = (x1 - x0) / n;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgba("#FFFFFF", 0.95));
      g.addColorStop(1, rgba(H, 0.55));
      for (let i = 0; i < n; i++) {
        const v = 0.15 + 0.8 * hash01(i, tick(frame, 10 + (c.seed % 9), i % 3), c.seed) * (0.6 + 0.4 * Math.sin(i * 0.4 + c.seed));
        const hh = Math.abs(v) * (y1 - y0) * grow;
        ctx.fillStyle = i % 7 === 3 ? rgba(H, 0.95) : g;
        ctx.fillRect(x0 + i * bw, y1 - hh, bw * 0.62, hh);
      }
      break;
    }
    case "line":
    case "dotline": {
      ctx.strokeStyle = rgba(c.kind === "line" ? "#FFFFFF" : H, 0.9);
      ctx.lineWidth = 6;
      ctx.beginPath();
      const n = c.kind === "line" ? 40 : 9;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const v = 0.5 + 0.3 * Math.sin(i * 0.5 + c.seed) * (0.5 + hash01(i, c.seed)) + 0.1 * Math.sin(frame * 0.03 + i);
        const px = x0 + ((x1 - x0) * i) / n;
        const py = y1 - clamp(v) * (y1 - y0) * grow;
        pts.push([px, py]);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      if (c.kind === "dotline")
        pts.forEach(([px, py]) => {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, TAU);
          ctx.fill();
        });
      break;
    }
    case "table":
    case "list": {
      const rowH = 54;
      const rows = Math.floor((y1 - y0 - 80) / rowH);
      const cols = Math.max(1, Math.floor((x1 - x0) / 360));
      const scroll = c.kind === "list" ? (frame * 1.6) % rowH : 0;
      const base = c.kind === "list" ? Math.floor((frame * 1.6) / rowH) : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0 + 80, x1 - x0, y1 - y0 - 80);
      ctx.clip();
      ctx.font = font(500, 40, "JetBrains Mono");
      for (let k = 0; k <= rows; k++)
        for (let q = 0; q < cols; q++) {
          const id = base + k;
          const v = hash01(id, q, c.seed) * (q % 2 ? 99 : 99999);
          ctx.fillStyle = rgba(q % 2 ? H : T, 0.85);
          const tv = q % 2 ? `${val(v, 30, id + q).toFixed(2)}%` : v.toFixed(2);
          ctx.fillText(tv, x0 + q * 360, y0 + 110 + k * rowH - scroll);
        }
      ctx.restore();
      break;
    }
    case "chips":
    case "hitable": {
      const cw = c.kind === "chips" ? 430 : 520;
      const ch = c.kind === "chips" ? 96 : 110;
      const cols = Math.max(1, Math.floor((x1 - x0) / cw));
      const rows = Math.max(1, Math.floor((y1 - y0) / (ch + 14)));
      for (let k = 0; k < rows; k++)
        for (let q = 0; q < cols; q++) {
          const i = k * cols + q;
          const hi = hash01(i, c.seed, 1) < (c.kind === "hitable" ? 0.7 : 0.45);
          const x = x0 + q * cw;
          const y = y0 + k * (ch + 14) + ch / 2;
          if (hi) {
            ctx.fillStyle = rgba(H, c.kind === "hitable" ? 0.42 : 0.36);
            ctx.fillRect(x, y - ch / 2, cw - 24, ch);
          }
          const up = hash01(tick(frame, 50 + (i % 5) * 10, i), c.seed, i) > 0.3;
          ctx.fillStyle = up ? p.up : p.down;
          tri(ctx, x + 34, y, 34, up);
          ctx.fillStyle = rgba(T, 0.97);
          ctx.font = font(700, c.kind === "chips" ? 56 : 64, "Inter");
          ctx.fillText(`${val(100 + hash01(i, c.seed, 2) * 899, 18 + (i % 7) * 5, i).toFixed(2)}%`, x + 66, y + 2);
        }
      break;
    }
    case "tile": {
      const v = val(1 + hash01(c.seed, 3) * 9, 24, c.seed);
      const up = hash01(tick(frame, 60, 1), c.seed, 4) > 0.35;
      ctx.fillStyle = up ? p.up : p.down;
      tri(ctx, c.x + 290, b.y + 184, 28, up);
      ctx.font = font(700, 40, "Inter");
      ctx.fillStyle = rgba(T, 0.95);
      ctx.fillText(`${v.toFixed(2)}%`, c.x + 316, b.y + 186);
      break;
    }
    case "donuts": {
      const n = Math.max(1, Math.floor((x1 - x0) / 200));
      for (let i = 0; i < n; i++) {
        const cx = x0 + 100 + i * 200;
        const cy = (y0 + y1) / 2;
        const rr = Math.min(70, (y1 - y0) / 2 - 10);
        const f = (0.3 + 0.6 * hash01(i, c.seed, tick(frame, 45, i))) * grow;
        ctx.lineWidth = 20;
        ctx.strokeStyle = rgba(H, 0.22);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba(H, 0.95);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + f * TAU);
        ctx.stroke();
      }
      break;
    }
    case "gauge": {
      const sweep = easeInOutCubic((frame - 80) / 50);
      const g = (c.gauge ?? 50) + (hash01(tick(frame, 40, 1), c.seed) - 0.5) * 0.8 * smoothstep(140, 160, frame);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rr = Math.min((y1 - y0) / 2 - 20, (x1 - x0) / 2 - 20, 230);
      ctx.lineWidth = 34;
      ctx.strokeStyle = rgba(H, 0.2);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(H, 0.95);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + (g / 100) * TAU * sweep);
      ctx.stroke();
      ctx.fillStyle = T;
      ctx.font = font(800, 92, "Inter");
      ctx.textAlign = "center";
      ctx.fillText(`${(g * sweep).toFixed(1)}%`, cx, cy + 4);
      ctx.textAlign = "left";
      break;
    }
  }
  void r;
};

const drawChart = (ctx: Ctx, b: Band, frame: number, p: CommodityBoardProps) => {
  const STEP = 78;
  const visible = Math.ceil(DW / STEP);
  const reveal = clamp((frame - 55) / 260) * visible;
  const scroll = Math.max(0, (frame - 315) / 12);
  const first = Math.floor(scroll);
  const frac = scroll - first;
  const top = b.y + 60;
  const hgt = b.h - 120;
  const toY = (v: number) => top + hgt * (1 - v);
  const n = Math.min(visible + 1, Math.floor(reveal) + 1);
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    let m = 0;
    for (let q = 0; q < 4; q++) m += walk(first + k - q);
    pts.push([(k - frac) * STEP, toY(m / 4 - 0.06)]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, b.y, DW, b.h);
  ctx.clip();
  if (pts.length > 1) {
    const grad = ctx.createLinearGradient(0, top, 0, top + hgt);
    grad.addColorStop(0, rgba(p.highlight, 0.14));
    grad.addColorStop(1, rgba(p.highlight, 0.0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], b.y + b.h);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(p.highlight, 0.95);
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  for (let k = 0; k < n; k++) {
    const idx = first + k;
    const o = walk(idx - 1);
    const c = walk(idx);
    const hi = Math.max(o, c) + 0.015 + 0.04 * hash01(idx, 1);
    const lo = Math.min(o, c) - 0.015 - 0.04 * hash01(idx, 2);
    const x = (k - frac) * STEP + STEP / 2;
    ctx.fillStyle = rgba("#E6F2FF", 0.92);
    ctx.fillRect(x - 4, toY(hi), 8, toY(lo) - toY(hi));
    const t0 = toY(Math.max(o, c));
    ctx.fillRect(x - 22, t0, 44, Math.max(10, toY(Math.min(o, c)) - t0));
  }
  if (pts.length > 1) {
    const [lx, ly] = pts[pts.length - 1];
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(lx, ly, 16, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
};

export const commodityBoardLook: LookFactory<CommodityBoardProps> = (env, p) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, env.aspect, 0.5, 300);
  const ts = env.texScale;
  const cw = Math.round(DW * ts);
  const chh = Math.round(DH * ts);
  const s = cw / DW;
  const bands = buildBands(p.names);

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: { c: { value: hexVec(p.bg) }, hi: { value: hexVec(p.highlight) } },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform vec3 c, hi;
        void main(){ vec2 q = vUv - vec2(0.55, 0.6); q.x *= 1.6; float r = length(q);
          vec3 col = mix(c * 1.3 + hi * 0.05, c * 0.35, smoothstep(0.0, 1.0, r)); o = vec4(col, 1.0);} `,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // Static band strips, pre-rendered once.
  const strips = bands.map((b) => {
    const top = b.y - 20;
    const c = makeCanvas(DW * s, (b.h + 20) * s);
    c.ctx.scale(s, s);
    c.ctx.translate(0, -top);
    drawStaticBand(c.ctx, b, p);
    return { canvas: c.canvas, top };
  });
  const board = makeCanvas(cw, chh);
  const tex = canvasTexture(board.canvas, env.gl);
  const mat = layerMaterial(tex, { depthWrite: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  plane.rotation.set(-0.87, 0.16, 0.17, "YXZ");
  scene.add(plane);
  const toWorld = (u: number, v: number) => new THREE.Vector3((u - 0.5) * PW, (0.5 - v) * PH, 0).applyMatrix4(plane.matrixWorld);
  const normal = new THREE.Vector3();

  let lastFrame = -1;
  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.6,
      bloomThreshold: 0.6,
      bloomKnee: 0.35,
      bloomRadius: 0.8,
      vignette: 0.6,
      exposure: 1.0,
      dof: { focus: 20, range: 1.8, ramp: 6, maxNear: 0.009, maxFar: 0.008 },
    },
    update: (frame, post) => {
      plane.updateMatrixWorld();
      // diagonal glide across the board (lower-left -> upper-right)
      const g = easeInOutCubic(frame / 600) * 0.8 + (frame / 600) * 0.2;
      const target = toWorld(0.32 + 0.22 * g, 0.5 - 0.1 * g);
      normal.set(0, 0, 1).applyQuaternion(plane.quaternion);
      const camPos = target.clone().addScaledVector(normal, 24).add(new THREE.Vector3(-5.0 + 2.0 * g, -7.5, 5.0));
      camera.position.copy(camPos);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      if (post.opts.dof) post.opts.dof.focus = camPos.distanceTo(target);

      if (frame === lastFrame) return;
      lastFrame = frame;
      const ctx = board.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, chh);
      const bgK = smoothstep(30, 60, frame);
      const gr = ctx.createLinearGradient(0, 0, cw, chh);
      gr.addColorStop(0, rgba("#020A26", bgK));
      gr.addColorStop(0.5, rgba(p.bg, bgK));
      gr.addColorStop(1, rgba("#020A26", bgK));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, cw, chh);
      const k = bands.map((_, i) => easeOutCubic((frame - 45 - i * 6) / 24));
      strips.forEach((st, i) => {
        if (k[i] <= 0) return;
        ctx.globalAlpha = k[i];
        ctx.drawImage(st.canvas, 0, (st.top + (1 - k[i]) * 90) * s);
      });
      ctx.globalAlpha = 1;
      ctx.scale(s, s);
      bands.forEach((b, i) => {
        if (k[i] <= 0) return;
        ctx.save();
        ctx.globalAlpha = k[i];
        ctx.translate(0, (1 - k[i]) * 90);
        if (b.chart) drawChart(ctx, b, frame, p);
        else for (const c of b.cells) drawLiveCell(ctx, b, c, frame, p);
        ctx.restore();
      });
      tex.needsUpdate = true;
    },
  };
};
