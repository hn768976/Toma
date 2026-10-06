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
  layer: "board" | "side";
  z?: number;
  drawStatic: (ctx: Ctx, w: number, h: number) => void;
  drawDyn: (B: Batch2D, f: number, w: number, h: number) => void;
};

const frameRect = (ctx: Ctx, w: number, h: number, a = 0.55) => {
  ctx.fillStyle = "rgba(4,40,70,0.45)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = `rgba(90,220,240,${a})`;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
};

const textRows = (ctx: Ctx, seed: number, x: number, y: number, rows: number, gap: number, size: number, w: number, a = 0.5) => {
  const r = mulberry32(seed);
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.fillStyle = `rgba(138,240,255,${a})`;
  ctx.textBaseline = "middle";
  for (let i = 0; i < rows; i++) {
    let s = "";
    while (s.length * size * 0.6 < w) s += (r() < 0.5 ? String(irange(r, 10, 99999)) : "-".repeat(irange(r, 2, 6))) + " ";
    ctx.fillText(s.slice(0, Math.floor(w / (size * 0.6))), x, y + i * gap);
  }
};

// --- cards ---------------------------------------------------------------

const barChart: Card = {
  x: 215,
  y: 640,
  w: 1150,
  h: 690,
  delay: 0,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    frameRect(ctx, w, h);
    ctx.fillStyle = "rgba(90,220,240,0.5)";
    ctx.fillRect(40, h - 110, w - 80, 3);
    ctx.font = `600 30px ${MONO}`;
    ctx.fillStyle = "rgba(138,240,255,0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 24; i++) ctx.fillText(CODES2[i], 60 + ((w - 120) / 23) * i, h - 75);
    ctx.textAlign = "left";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(90,220,240,0.12)";
      ctx.fillRect(40, 120 + i * 95, w - 80, 2);
    }
    textRows(ctx, 31, 40, h - 30, 1, 30, 22, w - 80, 0.4);
  },
  drawDyn: (B, f, w, h) => {
    B.text(rollingDigits("#######", 7453783, f, 600, 15), 40, 50, 48, C_HI, 1, { i: 1.4 });
    const base = h - 112;
    const n = 24;
    const step = (w - 120) / 23;
    const bw = step * 0.58;
    for (let i = 0; i < n; i++) {
      // bars grow to new values in waves travelling left to right
      const v = 0.18 + 0.82 * beatValue(f - i * 3, 9001 + i * 13, 75, 600, 0.5);
      const grow = easeOutCubic(remap(f, 60 + i * 2, 100 + i * 2));
      const hh = (h - 220) * v * grow;
      const x = 60 + step * i - bw / 2;
      B.rect(x, base - hh, bw, hh, C_MID, 0.75, { i: 1.0 });
      B.rect(x, base - hh, bw, Math.min(hh, hh * 0.25), C_HI, 0.85, { i: 1.4 });
    }
  },
};

const areaCard = (i: number): Card => ({
  x: 1400 + i * 305,
  y: 670,
  w: 285,
  h: 370,
  delay: 8 + i * 5,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    frameRect(ctx, w, h, 0.65);
    ctx.fillStyle = "rgba(90,220,240,0.35)";
    ctx.fillRect(18, 175, w - 36, 2);
    textRows(ctx, 100 + i, 18, 250, 4, 30, 18, w - 36, 0.45);
  },
  drawDyn: (B, f, w) => {
    const n = 46;
    const x0 = 18;
    const x1 = w - 18;
    const yb = 175;
    const pts: number[] = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      // rising area chart with noise; redraws by easing between beats
      const v = clamp01(0.15 + 0.7 * t + 0.25 * (beatValue(f, 500 + i * 97 + k * 7, 60, 600, 0.6) - 0.5));
      const x = lerp(x0, x1, t);
      const y = yb - v * 140;
      pts.push(x, y);
      B.rect(x - (x1 - x0) / n / 2, y, (x1 - x0) / n + 0.6, yb - y, C_MID, 0.38, { i: 0.9 });
    }
    B.poly(pts, 3, C_HI, 1, { i: 1.5 });
    B.text(rollingDigits("####### ###", 5612316 + i, f, 600, 10), 18, 205, 24, C_HI, 1, { i: 1.3 });
  },
});

const counter: Card = {
  x: 1405,
  y: 1150,
  w: 230,
  h: 175,
  delay: 28,
  layer: "board",
  drawStatic: (ctx, w, h) => {
    ctx.fillStyle = "rgba(140,240,255,0.18)";
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,245,255,0.95)";
    ctx.lineWidth = 5;
    ctx.stroke();
  },
  drawDyn: (B, f, w, h) => {
    // counts up during the build-in, then holds at 45 with a brief tick
    const t = easeOutCubic(remap(f, 75, 130));
    let v = Math.round(45 * t);
    if (f > 300 && f < 330) v = 46;
    B.text(String(v), w / 2, h / 2 + 4, 110, "#E8FDFF", 1, { align: "center", i: 1.6 });
  },
};

const donut = (i: number): Card => ({
  x: 1720 + i * 315,
  y: 1130,
  w: 220,
  h: 220,
  delay: 32 + i * 4,
  layer: "board",
  drawStatic: () => {},
  drawDyn: (B, f, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    B.arc(cx, cy, 58, 100, 0, Math.PI * 2, C_DIM, 0.55, { i: 0.9 });
    const sweep = easeOutCubic(remap(f, 80 + i * 6, 125 + i * 6));
    const v = 0.55 + 0.4 * beatValue(f, 77 + i, 100, 600, 0.5);
    const a0 = hash2(i, 3) * Math.PI;
    B.arc(cx, cy, 58, 100, a0, Math.PI * 2 * v * sweep, C_HI, 0.95, { i: 1.3 });
    B.arc(cx, cy, 58, 100, a0 + Math.PI * 2 * v * sweep + 0.12, Math.PI * 2 * (1 - v) * sweep * 0.6, C_MID, 0.8, { i: 1.1 });
  },
});

const table = (side: 0 | 1): Card => {
  const heads = side === 0 ? ["NM", "TU"] : ["TC", "DM", "RG"];
  return {
    x: side === 0 ? 215 : 1395,
    y: 1370,
    w: side === 0 ? 1150 : 1225,
    h: 360,
    delay: 40 + side * 6,
    layer: "board",
    drawStatic: (ctx, w) => {
      ctx.fillStyle = "rgba(90,220,240,0.22)";
      ctx.fillRect(0, 0, w, 52);
      ctx.strokeStyle = "rgba(90,220,240,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, 52);
      ctx.font = `600 34px ${SANS}`;
      ctx.fillStyle = "rgba(170,245,255,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      heads.forEach((hd, k) => ctx.fillText(hd, ((k + 0.5) * w) / heads.length, 27));
      ctx.textAlign = "left";
    },
    drawDyn: (B, f, w, h) => {
      // rows scroll upward; content is a pure function of the row index
      const rowH = 62;
      const scroll = Math.max(0, f - 90) * 0.55;
      const first = Math.floor(scroll / rowH);
      for (let k = first; k < first + 6; k++) {
        const y = 52 + 40 + k * rowH - scroll;
        const edge = Math.min(remap(y, 60, 110), remap(y, h + 10, h - 50));
        if (edge <= 0) continue;
        const cd = CODES3[Math.floor(hash3(side, k, 1) * CODES3.length)];
        const num = String(Math.floor(hash3(side, k, 2) * 9e10 + 1e10));
        const tail = String(Math.floor(hash3(side, k, 3) * 9000 + 1000));
        B.text(`${cd}: ${num}`, 30, y, 28, C_HI, 0.85 * edge, { i: 1.1, spacing: 1.08 });
        B.text(`N/A: ${tail}`, w - 30, y, 28, C_HI, 0.85 * edge, { i: 1.1, align: "right", spacing: 1.08 });
        B.rect(w * 0.44, y - 2, w * 0.18 * hash3(side, k, 4), 4, C_MID, 0.4 * edge);
        B.rect(0, y + rowH / 2 - 1, w, 2, C_DIM, 0.35 * edge);
      }
    },
  };
};

const header: Card = {
  x: 120,
  y: 470,
  w: 2960,
  h: 80,
  delay: 20,
  layer: "board",
  drawStatic: (ctx, w) => {
    ctx.fillStyle = "rgba(90,220,240,0.25)";
    ctx.fillRect(0, 72, w, 2);
  },
  drawDyn: (B, f) => {
    const items: [string, number, string][] = [
      ["GH-", 300, "###########"],
      ["MN-", 1240, "###"],
      ["TR-", 1700, "#########"],
      ["GH-", 2260, "###########"],
    ];
    items.forEach(([p, x, pat], k) => {
      B.text(`${p} ${rollingDigits(pat, 400 + k, f, 600, 12)}`, x, 36, 40, C_HI, 0.9, { i: 1.1, spacing: 1.1 });
    });
  },
};

const sideRight: Card = {
  x: 2680,
  y: 640,
  w: 520,
  h: 950,
  delay: 46,
  layer: "side",
  z: 0.9,
  drawStatic: (ctx, w) => {
    textRows(ctx, 77, 10, 320, 3, 30, 20, w - 20, 0.4);
    ctx.fillStyle = "rgba(90,220,240,0.4)";
    ctx.fillRect(10, 870, w - 20, 3);
  },
  drawDyn: (B, f) => {
    for (let i = 0; i < 7; i++) {
      const v = 0.3 + 0.7 * beatValue(f, 900 + i, 60, 600);
      B.rect(20 + i * 62, 40 + (1 - v) * 160, 40, v * 160, C_MID, 0.8, { i: 1.1 });
    }
    for (let i = 0; i < 4; i++) {
      B.arc(70 + i * 120, 480, 30, 46, 0, Math.PI * 2, C_DIM, 0.5);
      B.arc(70 + i * 120, 480, 30, 46, 0, Math.PI * 2 * (0.4 + 0.5 * beatValue(f, 950 + i, 75, 600)), C_HI, 0.9, { i: 1.2 });
    }
    for (let i = 0; i < 18; i++) {
      const v = 0.2 + 0.8 * beatValue(f - i * 2, 970 + i, 50, 600);
      B.rect(20 + i * 27, 870 - v * 230, 16, v * 230, C_MID, 0.75, { i: 1 });
    }
  },
};

const sideLeft: Card = {
  x: -260,
  y: 380,
  w: 440,
  h: 900,
  delay: 46,
  layer: "side",
  z: 0.9,
  drawStatic: (ctx, w) => {
    textRows(ctx, 78, 10, 40, 8, 34, 22, w - 20, 0.45);
  },
  drawDyn: (B, f, w) => {
    const n = 40;
    const pts: number[] = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const v = 0.3 + 0.5 * t + 0.25 * (beatValue(f, 990 + k * 5, 60, 600, 0.6) - 0.5);
      const x = 10 + t * (w - 20);
      const y = 640 - v * 150;
      pts.push(x, y);
      B.rect(x - (w - 20) / n / 2, y, (w - 20) / n + 0.6, 640 - y, C_MID, 0.35);
    }
    B.poly(pts, 3, C_HI, 0.9, { i: 1.3 });
  },
};

const CARDS: Card[] = [header, barChart, areaCard(0), areaCard(1), areaCard(2), areaCard(3), counter, donut(0), donut(1), donut(2), table(0), table(1), sideRight, sideLeft];

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
  ctx.strokeStyle = "rgba(140,240,255,0.10)";
  ctx.lineWidth = 3;
  for (let lon = 0; lon <= 360; lon += 15) {
    ctx.beginPath();
    ctx.moveTo((lon / 360) * W, 0);
    ctx.lineTo((lon / 360) * W, H);
    ctx.stroke();
  }
  for (let lat = 0; lat <= 180; lat += 15) {
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
  ctx.fillStyle = "rgba(20,90,140,0.55)";
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(90,200,230,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // rows of faint digits over the far layer
  textRows(ctx, 5150, 40, 120, 30, 64, 30, W - 80, 0.12);
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

  const tilt = THREE.MathUtils.degToRad(-20);
  const mkBoard = () => {
    const g = new THREE.Group();
    g.rotation.x = tilt;
    return g;
  };
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
    (card.layer === "board" ? board : side).add(group);
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
  const cloud = new PointCloud({ count: N, backAlpha: 0.35, softness: 0.4 });
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
      if (!land && r() > 0.16) continue;
      const rr = R1 * (1 + (r() - 0.5) * 0.02);
      const cl = Math.cos(Math.asin(u));
      cloud.set(i, rr * cl * Math.cos(th), rr * u, -rr * cl * Math.sin(th), r() < 0.25 ? "#CFFAFF" : C_MID, land ? range(r, 0.55, 1) : range(r, 0.2, 0.5), range(r, 0.012, 0.03), land ? 1.3 : 0.8);
      i++;
    }
  }
  cloud.commit();
  pGlobe.add(cloud.points);
  pGlobe.rotation.x = 0.35;

  const sRoot = new THREE.Group();
  const sg = toLocal(2040, 260);
  sRoot.position.set(sg.x, sg.y + 0.25, 0.4);
  const sphereMat = solidGlobeMaterial(globeTexture(assets));
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.95, 128, 64), sphereMat);
  sphere.rotation.x = 0.3;
  sRoot.add(sphere);
  // soft rim halo (additive, camera facing)
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    premultBlend(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        depthWrite: false,
        uniforms: { uOpacity: { value: 1 }, uCol: { value: new THREE.Vector3(...linearRGB(C_MID)) } },
        vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `precision highp float; layout(location = 0) out highp vec4 fragOut; in vec2 vUv; uniform float uOpacity; uniform vec3 uCol;
          void main(){ float d = length(vUv - 0.5) * 5.2; float g = exp(-pow(max(d - 1.95, 0.0) * 3.0, 2.0)) * step(1.9, d); float a = g * 0.5 * uOpacity; fragOut = vec4(uCol * a, 0.0); }`,
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
    { scene: sFar, blur: 0.006 },
    { scene: sGlobes, blur: 0.0008 },
    { scene: sBoard, depth: { focus: 15.2, band: 0.8, range: 4, maxBlur: 0.006 } },
    { scene: sSide, blur: 0.0055 },
  ];

  return {
    camera,
    layers,
    pipeline: {
      background: BG,
      bloomThreshold: 0.8,
      bloomKnee: 0.45,
      bloomIntensity: 0.7,
      bloomRadius: 0.6,
      vignette: 0.45,
    },
    update: (f) => {
      const t = f / FINANCE_FRAMES;
      camera.position.set(-0.4 + 0.9 * t, 2.6 - 0.25 * t, 15.0 - 0.6 * t);
      camera.lookAt(0.1 * t, 0.35, 0);
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
      pGlobe.rotation.y = -1.6 + (f - 300) * 0.0045;
      sphere.rotation.y = -1.83 + (f - 300) * 0.0045;

      const fade = easeOutCubic(remap(f, 45, 75));
      (far.material as THREE.ShaderMaterial).uniforms.uOpacity.value = fade;
      return { fade: Math.min(1, 0.0001 + fade) };
    },
  };
};

export const FinanceInfographic: React.FC<LookProps> = ({ grade }) => <Stage build={build} grade={grade} />;
