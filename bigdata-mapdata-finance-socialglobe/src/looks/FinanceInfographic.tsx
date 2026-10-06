import * as THREE from "three";
import { Assets, MONO, SANS, landMask, traceLand } from "../lib/assets";
import { Batch2D, linearRGB, premultBlend, texPlaneMaterial } from "../lib/batch2d";
import { canvasTexture, makeCanvas } from "../lib/canvas";
import { PointCloud } from "../lib/prims3d";
import {
  beatValue,
  clamp01,
  easeOutCubic,
  hash2,
  hash3,
  irange,
  lerp,
  mulberry32,
  range,
  remap,
  rollingDigits,
} from "../lib/random";
import { BuildFn, LookProps, Stage } from "../lib/Stage";
import { LayerSpec } from "../lib/pipeline";

// Look 3 — Finance Infographic. Teal-blue widget cards on a board tilted
// ~20 deg, slight downward camera, two globes on top (particles + solid).
// Each card = its own Canvas 2D texture (static) + widget batch (moving), so
// the cards can slide and fade in one by one.

export const FINANCE_FRAMES = 600;

const C_HI = "#8AF0FF";
const C_MID = "#3AD8E8";
const C_DIM = "#1F8FB0";
const BG = "#04203A";

const K = 1 / 200; // world units per board px
const BOARD_W = 3200;
const BOARD_H = 2000;
const TEX = 2; // canvas px per board px

const CODES2 = ["GN", "EG", "AS", "TG", "BN", "EC", "VB", "TM", "OP", "HJ", "ZT", "BF", "UP", "WE", "YT", "KS", "AC", "RL", "MV", "PD", "QX", "LN", "SR", "DK"];
const CODES3 = ["TVC", "MMC", "EBN", "AQW", "PLX", "KRT", "SDF", "HNB", "VWE", "CGT", "ZRM", "OYL"];

type Ctx = CanvasRenderingContext2D;

type Card = {
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number; // build-in order (frames after 45)
  layer: "board" | "side" | "back";
  z?: number;
  drawStatic: (ctx: Ctx, w: number, h: number) => void;
  drawDyn: (B: Batch2D, f: number, w: number, h: number) => void;
};

const frameRect = (ctx: Ctx, w: number, h: number, a = 0.55) => {
  // translucent panel (the far map shows through) with a soft rounded border
  ctx.fillStyle = "rgba(4,36,80,0.22)";
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 14);
  ctx.fill();
  ctx.strokeStyle = `rgba(90,200,240,${a * 0.35})`;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = `rgba(110,220,250,${a})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();
};

const textRows = (ctx: Ctx, seed: number, x: number, y: number, rows: number, gap: number, size: number, w: number, a = 0.5) => {
  const r = mulberry32(seed);
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.fillStyle = `rgba(110,215,250,${a})`;
  ctx.textBaseline = "middle";
  for (let i = 0; i < rows; i++) {
    let s = "";
    while (s.length * size * 0.6 < w) s += (r() < 0.5 ? String(irange(r, 10, 99999)) : "-".repeat(irange(r, 2, 6))) + " ";
    ctx.fillText(s.slice(0, Math.floor(w / (size * 0.6))), x, y + i * gap);
  }
};

const spaced = (s: string) => s.split("").join(" ");

// --- cards ---------------------------------------------------------------

const barChart: Card = {
  x: 300,
  y: 700,
  w: 1150,
  h: 700,
  delay: 0,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    frameRect(ctx, w, h);
    ctx.fillStyle = "rgba(90,200,240,0.45)";
    ctx.fillRect(40, h - 150, w - 80, 3);
    ctx.font = `600 30px ${MONO}`;
    ctx.fillStyle = "rgba(120,220,250,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 19; i++) ctx.fillText(CODES2[i], 80 + ((w - 160) / 18) * i, h - 118);
    ctx.textAlign = "left";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(90,200,240,0.1)";
      ctx.fillRect(40, 120 + i * 90, w - 80, 2);
    }
    // dim dashed rows with vertical dividers under the axis
    textRows(ctx, 31, 40, h - 75, 2, 34, 20, w - 80, 0.35);
    for (const x of [w * 0.3, w * 0.62]) {
      ctx.fillStyle = "rgba(90,200,240,0.35)";
      ctx.fillRect(x, h - 95, 2, 70);
    }
  },
  drawDyn: (B, f, w, h) => {
    B.text(rollingDigits("#######", 7453783, f, 600, 15), 40, 50, 46, C_HI, 1, { i: 1.3, spacing: 1.15 });
    const base = h - 152;
    const n = 19;
    const step = (w - 160) / 18;
    const bw = step * 0.5;
    for (let i = 0; i < n; i++) {
      // bars grow to new values in waves travelling left to right; taller
      // towards the middle
      const shape = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n);
      const v = (0.25 + 0.75 * beatValue(f - i * 3, 9001 + i * 13, 75, 600, 0.5)) * shape;
      const grow = easeOutCubic(remap(f, 60 + i * 2, 100 + i * 2));
      const hh = Math.max(1, (h - 260) * v * grow);
      const x = 80 + step * i - bw / 2;
      // single tone, brightening upward (3 stacked segments) + round cap
      B.rect(x, base - hh, bw, hh, C_DIM, 0.85, { i: 1.0 });
      B.rect(x, base - hh, bw, hh * 0.66, C_MID, 0.75, { i: 1.15 });
      B.rect(x, base - hh, bw, hh * 0.3, C_HI, 0.7, { i: 1.4 });
      if (hh > bw) B.dot(x + bw / 2, base - hh, bw / 2, C_HI, 0.9, { i: 1.4 });
    }
  },
};

const areaCard = (i: number): Card => ({
  x: 1480 + i * 305,
  y: 730,
  w: 285,
  h: 400,
  delay: 8 + i * 5,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    frameRect(ctx, w, h, 0.7);
    ctx.font = `500 16px ${MONO}`;
    ctx.fillStyle = "rgba(120,220,250,0.55)";
    for (let k = 0; k < 4; k++) ctx.fillText(spaced("-- ----- -- ---"), 18, 262 + k * 26);
    ctx.fillStyle = "rgba(140,235,255,0.75)";
    ctx.fillRect(18, h - 34, w - 36, 16);
  },
  drawDyn: (B, f, w) => {
    const n = 34;
    const x0 = 18;
    const x1 = w - 18;
    const yb = 190;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      // solid, jagged "mountain" rising steeply to the right
      const jag = (hash3(i, k, 5) - 0.5) * 0.35;
      const v = clamp01(0.08 + 0.85 * t * t + jag * (0.4 + t) + 0.18 * (beatValue(f, 500 + i * 97 + k * 7, 60, 600, 0.6) - 0.5));
      const x = lerp(x0, x1, t);
      const y = yb - v * 160;
      B.rect(x - (x1 - x0) / n / 2, y, (x1 - x0) / n + 0.8, yb - y, C_HI, 0.85, { i: 1.25 });
    }
    B.text(spaced(rollingDigits("####### ###", 5612316 + i, f, 600, 10)).replace(/ {3}/g, "  "), 18, 222, 19, C_HI, 1, { i: 1.25 });
  },
});

const counter: Card = {
  x: 1480,
  y: 1205,
  w: 230,
  h: 175,
  delay: 28,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    // bright filled tile, dark numerals (inverted)
    ctx.fillStyle = "rgba(150,235,250,0.95)";
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(200,250,255,1)";
    ctx.lineWidth = 4;
    ctx.stroke();
  },
  drawDyn: (B, f, w, h) => {
    // counts up during the build-in, then holds at 45 with a brief tick
    const t = easeOutCubic(remap(f, 75, 130));
    let v = Math.round(45 * t);
    if (f > 300 && f < 330) v = 46;
    B.text(String(v), w / 2, h / 2 + 4, 108, "#0B3A5E", 1, { align: "center" });
  },
};

const donut = (i: number): Card => ({
  x: 1790 + i * 315,
  y: 1180,
  w: 230,
  h: 230,
  delay: 32 + i * 4,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    ctx.font = `500 16px ${MONO}`;
    ctx.fillStyle = "rgba(150,235,255,0.75)";
    ctx.textAlign = "center";
    ctx.fillText(String(100 + i * 137), w / 2, h / 2 - 10);
    ctx.fillText("---", w / 2, h / 2 + 14);
    ctx.textAlign = "left";
  },
  drawDyn: (B, f, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    // thick, nearly uniform light ring with small gaps
    const sweep = easeOutCubic(remap(f, 80 + i * 6, 125 + i * 6));
    const v = 0.6 + 0.3 * beatValue(f, 77 + i, 100, 600, 0.5);
    const a0 = hash2(i, 3) * Math.PI;
    const g = 0.09;
    B.arc(cx, cy, 52, 104, a0, (Math.PI * 2 * v - g) * sweep, "#9FEFFF", 0.95, { i: 1.25 });
    B.arc(cx, cy, 52, 104, a0 + Math.PI * 2 * v, (Math.PI * 2 * (1 - v) - g) * sweep, C_MID, 0.9, { i: 1.15 });
  },
});

const donutLabels: Card = {
  x: 1760,
  y: 1150,
  w: 900,
  h: 50,
  delay: 34,
  layer: "board",
  drawStatic: () => {},
  drawDyn: (B, f) => {
    B.text(`MN- ${rollingDigits("###", 943, f, 600, 20)}`, 330, 25, 26, C_MID, 0.7, { i: 0.9, spacing: 1.2 });
    B.text(`TR- ${rollingDigits("##########", 834, f, 600, 20)}`, 600, 25, 26, C_MID, 0.7, { i: 0.9, spacing: 1.2 });
  },
};

const table = (side: 0 | 1): Card => {
  const heads = side === 0 ? ["NM", "TU"] : ["TC", "DM", "RG"];
  return {
    x: side === 0 ? 300 : 1480,
    y: 1430,
    w: side === 0 ? 1150 : 1225,
    h: 420,
    delay: 40 + side * 6,
    layer: "board",
    drawStatic: (ctx, w) => {
      ctx.strokeStyle = "rgba(110,215,250,0.7)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(2, 2, w - 4, 50, 8);
      ctx.stroke();
      ctx.font = `600 34px ${SANS}`;
      ctx.fillStyle = "rgba(150,235,255,0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      heads.forEach((hd, k) => ctx.fillText(spaced(hd), ((k + 0.5) * w) / heads.length, 27));
      ctx.textAlign = "left";
    },
    drawDyn: (B, f, w, h) => {
      // rows (each its own outlined box) scroll upward; content is a pure
      // function of the row index
      const rowH = 62;
      const scroll = Math.max(0, f - 90) * 0.55;
      const first = Math.floor(scroll / rowH);
      for (let k = first; k < first + 7; k++) {
        const y = 52 + 44 + k * rowH - scroll;
        const edge = Math.min(remap(y, 64, 112), 1);
        if (edge <= 0 || y > h + 40) continue;
        const cd = CODES3[Math.floor(hash3(side, k, 1) * CODES3.length)];
        const num = String(Math.floor(hash3(side, k, 2) * 9e10 + 1e10));
        const tail = String(Math.floor(hash3(side, k, 3) * 9000 + 1000));
        B.rect(4, y - 24, w - 8, 48, C_MID, 0.7 * edge, { border: 2.5, i: 1.1 });
        B.text(`${cd}: ${num}`, 26, y, 26, C_HI, 0.9 * edge, { i: 1.15, spacing: 1.32 });
        B.text(`N/A: ${tail}`, w - 26, y, 26, C_HI, 0.9 * edge, { i: 1.15, align: "right", spacing: 1.32 });
        B.text(spaced("........"), w * 0.5, y, 22, C_DIM, 0.7 * edge, { align: "center" });
      }
    },
  };
};

const header: Card = {
  x: 120,
  y: 520,
  w: 2960,
  h: 80,
  delay: 20,
  layer: "board",
  drawStatic: () => {},
  drawDyn: (B, f) => {
    const items: [string, number, string][] = [
      ["MN-", 180, "###"],
      ["TR-", 520, "#####"],
      ["GH-", 900, "###########"],
      ["MN-", 1500, "###"],
      ["", 1960, "##########"],
      ["GH-", 2440, "###########"],
    ];
    items.forEach(([p, x, pat], k) => {
      B.text(`${p} ${rollingDigits(pat, 400 + k, f, 600, 12)}`, x, 36, 34, C_MID, 0.6, { i: 0.9, spacing: 1.25 });
    });
  },
};

// dense rows of small numbers and grid lines filling the board background
const boardFill: Card = {
  x: -300,
  y: 300,
  w: 3800,
  h: 1700,
  delay: 12,
  layer: "back",
  z: -0.6,
  drawStatic: (ctx, w, h) => {
    ctx.strokeStyle = "rgba(90,200,240,0.10)";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const r = mulberry32(9090);
    for (let k = 0; k < 70; k++) {
      const x = range(r, 0, w - 300);
      const y = range(r, 0, h - 200);
      textRows(ctx, irange(r, 1, 1e6), x, y, irange(r, 3, 8), 24, 17, range(r, 140, 320), range(r, 0.18, 0.4));
    }
  },
  drawDyn: () => {},
};

const sideRight: Card = {
  x: 2760,
  y: 680,
  w: 520,
  h: 1000,
  delay: 46,
  layer: "side",
  z: 0.6,
  drawStatic: (ctx, w) => {
    textRows(ctx, 77, 10, 330, 3, 30, 20, w - 20, 0.35);
    ctx.fillStyle = "rgba(90,200,240,0.4)";
    ctx.fillRect(10, 900, w - 20, 3);
  },
  drawDyn: (B, f) => {
    // row of six rounded pill bars
    for (let i = 0; i < 6; i++) {
      const v = 0.55 + 0.45 * beatValue(f, 900 + i, 60, 600);
      const hh = v * 160;
      B.rect(20 + i * 75, 40 + (160 - hh), 46, hh, C_MID, 0.85, { i: 1.1 });
      B.dot(43 + i * 75, 40 + (160 - hh), 23, C_MID, 0.85, { i: 1.1 });
      B.dot(43 + i * 75, 200, 23, C_MID, 0.85, { i: 1.1 });
    }
    for (let i = 0; i < 2; i++) {
      B.arc(90 + i * 140, 500, 34, 56, 0, Math.PI * 2, C_DIM, 0.5);
      B.arc(90 + i * 140, 500, 34, 56, 0, Math.PI * 2 * (0.4 + 0.5 * beatValue(f, 950 + i, 75, 600)), C_HI, 0.9, { i: 1.2 });
    }
    for (let i = 0; i < 16; i++) {
      const v = 0.2 + 0.8 * beatValue(f - i * 2, 970 + i, 50, 600);
      B.rect(20 + i * 22, 900 - v * 240, 9, v * 240, C_MID, 0.8, { i: 1 });
    }
    // light flare at the bottom-right edge
    B.dot(470, 880, 26, "#DFFBFF", 0.9, { i: 2.4, glow: 5, glowAmt: 0.55, add: true });
  },
};

const sideTopRight: Card = {
  x: 2900,
  y: 40,
  w: 420,
  h: 380,
  delay: 46,
  layer: "side",
  z: 0.4,
  drawStatic: () => {},
  drawDyn: (B, f) => {
    for (let i = 0; i < 7; i++) {
      const v = 0.5 + 0.5 * beatValue(f, 1200 + i, 60, 600);
      B.rect(20 + i * 56, 360 - v * 330, 30, v * 330, "#1A6E9A", 0.9, { i: 0.9 });
    }
  },
};

const sideLeft: Card = {
  x: -40,
  y: 380,
  w: 420,
  h: 1000,
  delay: 46,
  layer: "side",
  z: 0.6,
  drawStatic: (ctx, w) => {
    textRows(ctx, 78, 10, 340, 7, 30, 20, w - 20, 0.45);
  },
  drawDyn: (B, f, w) => {
    for (const [y0, sd] of [
      [240, 990],
      [880, 1990],
    ] as const) {
      const n = 34;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const v = clamp01(0.25 + 0.5 * t + (hash3(sd, k, 1) - 0.5) * 0.3 + 0.2 * (beatValue(f, sd + k * 5, 60, 600, 0.6) - 0.5));
        const x = 10 + t * (w - 20);
        const y = y0 - v * 150;
        B.rect(x - (w - 20) / n / 2, y, (w - 20) / n + 0.6, y0 - y, C_MID, 0.75, { i: 1.1 });
      }
    }
  },
};

const CARDS: Card[] = [boardFill, header, barChart, areaCard(0), areaCard(1), areaCard(2), areaCard(3), counter, donutLabels, donut(0), donut(1), donut(2), table(0), table(1), sideRight, sideTopRight, sideLeft];

// --- globes -----------------------------------------------------------------

const solidGlobeMaterial = (tex: THREE.Texture) =>
  premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { map: { value: tex }, uOpacity: { value: 1 }, uLight: { value: new THREE.Vector3(-0.5, 0.6, 0.65).normalize() } },
      vertexShader: /* glsl */ `
        out vec2 vUv; out vec3 vN; out vec3 vV;
        void main(){
          vUv = uv;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        layout(location = 0) out highp vec4 fragOut;
        in vec2 vUv; in vec3 vN; in vec3 vV;
        uniform sampler2D map; uniform float uOpacity; uniform vec3 uLight;
        void main(){
          vec3 c = texture(map, vUv).rgb;
          float l = 0.55 + 0.6 * max(dot(normalize(vN), uLight), 0.0);
          float fr = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.5);
          c = c * l + vec3(0.35, 0.85, 1.0) * fr * 0.9;
          float a = uOpacity;
          fragOut = vec4(c * a, a);
        }`,
    }),
  ) as THREE.ShaderMaterial;

const globeTexture = (assets: Assets) => {
  const W = 4096;
  const H = 2048;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0B4E78");
  g.addColorStop(0.5, "#0A5E8C");
  g.addColorStop(1, "#08466E");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // graticule
  ctx.strokeStyle = "rgba(140,240,255,0.24)";
  ctx.lineWidth = 3;
  for (let lon = 0; lon <= 360; lon += 10) {
    ctx.beginPath();
    ctx.moveTo((lon / 360) * W, 0);
    ctx.lineTo((lon / 360) * W, H);
    ctx.stroke();
  }
  for (let lat = 0; lat <= 180; lat += 10) {
    ctx.beginPath();
    ctx.moveTo(0, (lat / 180) * H);
    ctx.lineTo(W, (lat / 180) * H);
    ctx.stroke();
  }
  traceLand(ctx, assets.land, (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]);
  ctx.fillStyle = "#62CFE6";
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(200,250,255,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();
  return canvasTexture(c);
};

const farMap = (assets: Assets) => {
  const W = 4096;
  const H = 2048;
  const { c, ctx } = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  traceLand(ctx, assets.land, (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]);
  ctx.fillStyle = "rgba(18,72,150,0.6)";
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(90,200,230,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // rows of faint digits over the far layer
  textRows(ctx, 5150, 40, 120, 30, 64, 30, W - 80, 0.2);
  return canvasTexture(c);
};

// --- build ------------------------------------------------------------------

const build: BuildFn = (assets) => {
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 2, 60);
  const toLocal = (x: number, y: number) => new THREE.Vector3((x - BOARD_W / 2) * K, (BOARD_H / 2 - y) * K, 0);

  const sFar = new THREE.Scene();
  const far = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), texPlaneMaterial(farMap(assets), { opacity: 1 }));
  far.position.set(0, 2.5, -9);
  sFar.add(far);

  const tilt = THREE.MathUtils.degToRad(-27);
  const yaw = THREE.MathUtils.degToRad(7);
  const mkBoard = () => {
    const g = new THREE.Group();
    g.rotation.set(tilt, yaw, 0, "YXZ");
    return g;
  };
  const sBack = new THREE.Scene();
  const back = mkBoard();
  sBack.add(back);
  const sBoard = new THREE.Scene();
  const board = mkBoard();
  sBoard.add(board);
  const sSide = new THREE.Scene();
  const side = mkBoard();
  sSide.add(side);

  const cards = CARDS.map((card) => {
    const group = new THREE.Group();
    const c = toLocal(card.x + card.w / 2, card.y + card.h / 2);
    group.position.copy(c);
    group.position.z = card.z ?? 0;
    const { c: cv, ctx } = makeCanvas(Math.ceil(card.w * TEX), Math.ceil(card.h * TEX));
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.scale(TEX, TEX);
    card.drawStatic(ctx, card.w, card.h);
    const mat = texPlaneMaterial(canvasTexture(cv));
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(card.w * K, card.h * K), mat);
    plane.renderOrder = 0;
    group.add(plane);
    const batch = new Batch2D({ capacity: 1500, width: card.w, height: card.h, unitsPerPx: K, z: 0.002, padPx: 2 });
    batch.mesh.renderOrder = 1;
    group.add(batch.mesh);
    (card.layer === "board" ? board : card.layer === "back" ? back : side).add(group);
    return { card, group, mat, batch, base: group.position.clone() };
  });

  // globes
  const sGlobes = new THREE.Scene();
  const pRoot = new THREE.Group();
  const pg = toLocal(885, 270);
  pRoot.position.set(pg.x, pg.y + 0.2, 0.6);
  const pGlobe = new THREE.Group();
  pRoot.add(pGlobe);
  sGlobes.add(pRoot);
  const R1 = 1.75;
  const mask = landMask(assets.land);
  const N = 20000;
  const cloud = new PointCloud({ count: N, backAlpha: 0.65, softness: 0.7 });
  {
    const r = mulberry32(31337);
    let i = 0;
    let guard = 0;
    while (i < N && guard++ < 400000) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const lat = Math.asin(u) * (180 / Math.PI);
      const lon = th * (180 / Math.PI) - 180;
      const land = mask.at(lon, lat) > 0.5;
      if (!land && r() > 0.05) continue;
      const rr = R1 * (1 + (r() - 0.5) * 0.02);
      const cl = Math.cos(Math.asin(u));
      cloud.set(i, rr * cl * Math.cos(th), rr * u, -rr * cl * Math.sin(th), r() < 0.25 ? "#CFFAFF" : C_MID, land ? range(r, 0.35, 0.85) : range(r, 0.15, 0.4), range(r, 0.012, 0.028), land ? 1.15 : 0.7);
      i++;
    }
  }
  cloud.commit();
  pGlobe.add(cloud.points);
  pGlobe.rotation.x = 0.35;

  const sRoot = new THREE.Group();
  const sg = toLocal(2040, 260);
  sRoot.position.set(sg.x + 0.35, sg.y + 0.45, 0.4);
  const sphereMat = solidGlobeMaterial(globeTexture(assets));
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.15, 128, 64), sphereMat);
  sphere.rotation.x = 0.5;
  sRoot.add(sphere);
  // soft rim halo (additive, camera facing)
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(6.1, 6.1),
    premultBlend(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        depthWrite: false,
        uniforms: { uOpacity: { value: 1 }, uCol: { value: new THREE.Vector3(...linearRGB(C_MID)) } },
        vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `precision highp float; layout(location = 0) out highp vec4 fragOut; in vec2 vUv; uniform float uOpacity; uniform vec3 uCol;
          void main(){ float d = length(vUv - 0.5) * 6.1; float g = exp(-pow(max(d - 2.15, 0.0) * 3.0, 2.0)) * step(2.1, d); float a = g * 0.28 * uOpacity; fragOut = vec4(uCol * a, 0.0); }`,
      }),
    ),
  );
  halo.position.z = -0.01;
  sRoot.add(halo);
  sGlobes.add(sRoot);
  // globes are tilted with the board so they sit on its top edge
  for (const g of [pRoot, sRoot]) {
    const p = g.position.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
    g.position.copy(p);
  }

  const layers: LayerSpec[] = [
    { scene: sFar, blur: 0.0055 },
    { scene: sBack, blur: 0.0022 },
    { scene: sGlobes, blur: 0.0012 },
    { scene: sBoard, depth: { focus: 15.2, band: 0.4, range: 3.2, maxBlur: 0.0042, nearMul: 1.2 } },
    { scene: sSide, blur: 0.0032 },
  ];

  return {
    camera,
    layers,
    pipeline: {
      background: BG,
      bloomThreshold: 0.5,
      bloomKnee: 0.5,
      bloomIntensity: 1.0,
      bloomRadius: 0.85,
      vignette: 0.6,
      saturation: 1.2,
    },
    update: (f) => {
      const t = f / FINANCE_FRAMES;
      camera.position.set(-1.5 + 0.9 * t, 1.3 - 0.2 * t, 15.0 - 0.6 * t);
      camera.lookAt(-0.35 + 0.1 * t, 0.75, 0);
      camera.updateMatrixWorld();

      for (const c of cards) {
        const st = 45 + c.card.delay;
        const a = easeOutCubic(remap(f, st, st + 22));
        c.group.position.set(c.base.x + (1 - a) * (c.card.layer === "side" ? 0 : -0.25), c.base.y - (1 - a) * 0.5, c.base.z);
        c.mat.uniforms.uOpacity.value = a;
        c.batch.opacity = a;
        c.batch.begin();
        if (a > 0) c.card.drawDyn(c.batch, f, c.card.w, c.card.h);
        c.batch.end();
      }

      const ga = easeOutCubic(remap(f, 55, 110));
      const sc = 0.6 + 0.4 * ga;
      pRoot.scale.setScalar(sc);
      sRoot.scale.setScalar(sc);
      cloud.material.uniforms.uOpacity.value = ga;
      sphereMat.uniforms.uOpacity.value = ga;
      (halo.material as THREE.ShaderMaterial).uniforms.uOpacity.value = ga;
      pGlobe.rotation.y = -1.6 - (f - 300) * 0.0045;
      sphere.rotation.y = -1.95 - (f - 360) * 0.0045;

      const fade = easeOutCubic(remap(f, 45, 75));
      (far.material as THREE.ShaderMaterial).uniforms.uOpacity.value = fade;
      return { fade: Math.min(1, 0.0001 + fade), exposure: 0.92 };
    },
  };
};

export const FinanceInfographic: React.FC<LookProps> = ({ grade }) => <Stage build={build} grade={grade} />;
