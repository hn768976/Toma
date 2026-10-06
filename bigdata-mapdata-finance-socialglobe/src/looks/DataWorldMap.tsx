import * as THREE from "three";
import { Assets, MONO, SANS, landMask } from "../lib/assets";
import { Batch2D, texPlaneMaterial } from "../lib/batch2d";
import { canvasTexture, makeCanvas } from "../lib/canvas";
import { beatValue, cyc, hash2, hash3, irange, mulberry32, pick, range, rollingDigits, stepIndex, Rng } from "../lib/random";
import { BuildFn, LookProps, Stage } from "../lib/Stage";
import { LayerSpec } from "../lib/pipeline";

// Look 2 — Data World Map. Front-on dotted world map (Natural Earth), buried
// in data overlays on 5 layers at different depths. Floating layers drift
// sideways over a repeating width (whole tiles per 600 frames) so the clip
// loops exactly; nearer layers are larger, blurred and faster.

export const DATAMAP_FRAMES = 600;
const LOOP = 600;

const YEL = "#F2C544";
const CYA = "#5AE8FF";
const WHT = "#EAF6FF";
const MAPDOT = "#6AA8E8";
const BG = "#041A4A";

const CAM_Z = 20;
const FOV = 30;
const VIS_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)); // at z = 0
const VIS_W = (VIS_H * 16) / 9;
const PX_PER_UNIT_4K = 2160 / VIS_H; // screen px per unit at the map plane, 4K

// Map extents
const LAT_TOP = 84;
const LAT_BOT = -58;
const MAP_W = VIS_W * 1.02;
const MAP_H = (MAP_W * (LAT_TOP - LAT_BOT)) / 360;

// ---------------------------------------------------------------------------
// Clusters (layout at module level)

type Cluster = {
  kind: "bars" | "column" | "strip" | "panel" | "chips" | "chart" | "digits" | "tree" | "codes" | "blocks";
  x: number;
  y: number;
  n: number;
  seed: number;
  w: number;
  scale: number;
  palette: number;
};

const genClusters = (r: Rng, Wpx: number, Hpx: number, count: number, scale: number, kinds: Cluster["kind"][]) => {
  const out: Cluster[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pick(r, kinds);
    const w = range(r, 180, 420) * scale;
    out.push({
      kind,
      x: range(r, 30 * scale, Wpx - w - 60 * scale),
      y: range(r, Hpx * 0.04, Hpx * 0.94),
      n: kind === "column" ? irange(r, 14, 24) : kind === "strip" ? irange(r, 3, 6) : irange(r, 3, 11),
      seed: irange(r, 1, 1e9),
      w,
      scale,
      palette: r(),
    });
  }
  return out;
};

const barColor = (c: Cluster, i: number) => {
  // mostly golden yellow / cyan, alternating in runs, few white bars
  const h = hash2(c.seed, i * 3 + 1);
  if (h < 0.18) return WHT;
  if (c.palette < 0.3) return h < 0.75 ? YEL : CYA;
  if (c.palette < 0.8) return h < 0.75 ? CYA : YEL;
  return (i >> 1) % 2 === 0 ? YEL : CYA;
};

const CODE_CHARS = "0123456789ABCDEF";
const code = (r: Rng, n: number) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(r() * 16)]).join("");

/** Static parts of the clusters -> canvas. */
const drawClustersStatic = (ctx: CanvasRenderingContext2D, cl: Cluster[]) => {
  ctx.textBaseline = "middle";
  for (const c of cl) {
    const r = mulberry32(c.seed);
    const s = c.scale;
    ctx.save();
    ctx.translate(c.x, c.y);
    switch (c.kind) {
      case "bars": {
        // tick marks + tiny labels to the left of the bars
        ctx.fillStyle = "rgba(200,230,255,0.55)";
        ctx.font = `500 ${11 * s}px ${MONO}`;
        for (let i = 0; i < c.n; i++) {
          if (r() < 0.5) ctx.fillText(code(r, 3), -34 * s, i * 15 * s + 3 * s);
        }
        ctx.fillStyle = "rgba(160,210,255,0.25)";
        ctx.fillRect(-4 * s, -6 * s, 1.5 * s, c.n * 15 * s + 4 * s);
        break;
      }
      case "strip": {
        // long strip of solid white label boxes separated by cyan squares
        let x = 0;
        ctx.font = `700 ${11 * s}px ${MONO}`;
        ctx.textBaseline = "middle";
        for (let i = 0; i < c.n; i++) {
          const w = range(r, 80, 130) * s;
          ctx.fillStyle = "rgba(90,232,255,1)";
          ctx.fillRect(x, -8 * s, 16 * s, 16 * s);
          x += 20 * s;
          ctx.fillStyle = "rgba(250,252,255,1)";
          ctx.fillRect(x, -9 * s, w, 18 * s);
          ctx.fillStyle = "rgba(10,40,90,0.9)";
          ctx.fillText(code(r, 3) + " " + code(r, 4), x + 6 * s, 0.5 * s);
          x += w + 8 * s;
          if (x > c.w * 2.4) break;
        }
        ctx.fillStyle = "rgba(225,240,255,0.6)";
        ctx.fillRect(x, -1 * s, 60 * s, 2 * s);
        break;
      }
      case "column": {
        ctx.fillStyle = "rgba(200,230,255,0.5)";
        ctx.font = `500 ${10 * s}px ${MONO}`;
        for (let i = 0; i < c.n; i += 1) {
          if (r() < 0.6) ctx.fillText(code(r, 5), c.w + 12 * s, i * 11 * s + 3 * s);
        }
        break;
      }
      case "panel": {
        ctx.fillStyle = "rgba(2,12,36,0.75)";
        ctx.fillRect(-14 * s, -60 * s, c.w + 28 * s, 120 * s);
        ctx.strokeStyle = "rgba(160,210,255,0.35)";
        ctx.lineWidth = 1.5 * s;
        ctx.strokeRect(-14 * s, -60 * s, c.w + 28 * s, 120 * s);
        ctx.fillStyle = "rgba(200,230,255,0.5)";
        ctx.font = `500 ${10 * s}px ${MONO}`;
        ctx.fillText(code(r, 7), 0, 48 * s);
        break;
      }
      case "chips": {
        let x = 0;
        ctx.font = `600 ${12 * s}px ${SANS}`;
        for (let i = 0; i < c.n; i++) {
          const w = range(r, 60, 110) * s;
          ctx.fillStyle = "rgba(235,246,255,0.16)";
          ctx.fillRect(x, -10 * s, w, 20 * s);
          ctx.strokeStyle = "rgba(240,248,255,0.95)";
          ctx.lineWidth = 2.2 * s;
          ctx.strokeRect(x, -10 * s, w, 20 * s);
          ctx.fillStyle = i % 3 === 0 ? "rgba(90,232,255,0.95)" : "rgba(240,248,255,0.9)";
          ctx.fillRect(x + 4 * s, -6 * s, 12 * s, 12 * s);
          ctx.fillStyle = "rgba(240,248,255,0.8)";
          ctx.fillText(code(r, 4), x + 22 * s, 0.5 * s);
          x += w + 10 * s;
          if (x > c.w * 0.8) break;
        }
        break;
      }
      case "chart": {
        ctx.strokeStyle = "rgba(160,210,255,0.22)";
        ctx.lineWidth = 1 * s;
        ctx.strokeRect(0, -40 * s, c.w, 80 * s);
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, -40 * s + i * 20 * s);
          ctx.lineTo(c.w, -40 * s + i * 20 * s);
          ctx.stroke();
        }
        break;
      }
      case "digits": {
        ctx.fillStyle = "rgba(200,230,255,0.4)";
        ctx.font = `500 ${9 * s}px ${MONO}`;
        ctx.fillText(code(r, 10), 0, 16 * s);
        break;
      }
      case "tree": {
        // bracket connector: a stem branching to n leaves
        ctx.strokeStyle = "rgba(235,245,255,0.95)";
        ctx.lineWidth = 2.2 * s;
        const leaves = Math.min(c.n, 6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(c.w * 0.35, 0);
        for (let i = 0; i < leaves; i++) {
          const y = (i - (leaves - 1) / 2) * 16 * s;
          ctx.moveTo(c.w * 0.35, 0);
          ctx.bezierCurveTo(c.w * 0.45, 0, c.w * 0.45, y, c.w * 0.58, y);
          ctx.lineTo(c.w * 0.62, y);
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,210,74,0.95)";
        ctx.fillRect(-6 * s, -5 * s, 10 * s, 10 * s);
        for (let i = 0; i < leaves; i++) {
          const y = (i - (leaves - 1) / 2) * 16 * s;
          ctx.fillStyle = "rgba(242,197,68,1)";
          ctx.fillRect(c.w * 0.62, y - 5 * s, 9 * s, 10 * s);
          ctx.fillStyle = "rgba(245,250,255,0.95)";
          ctx.fillRect(c.w * 0.62 + 12 * s, y - 5 * s, 56 * s, 10 * s);
        }
        break;
      }
      case "codes": {
        ctx.fillStyle = "rgba(210,235,255,0.6)";
        ctx.font = `500 ${7 * s}px ${MONO}`;
        const rows = c.n + 4;
        for (let i = 0; i < rows; i++) ctx.fillText(code(r, irange(r, 8, 18)).split("").join(" "), 0, i * 9 * s);
        break;
      }
      case "blocks": {
        // small plus / cross markers and dots
        ctx.strokeStyle = "rgba(200,235,255,0.7)";
        ctx.lineWidth = 1.5 * s;
        for (let i = 0; i < 3; i++) {
          const x = range(r, 0, 120) * s;
          const y = range(r, -30, 30) * s;
          ctx.beginPath();
          ctx.moveTo(x - 5 * s, y - 5 * s);
          ctx.lineTo(x + 5 * s, y + 5 * s);
          ctx.moveTo(x + 5 * s, y - 5 * s);
          ctx.lineTo(x - 5 * s, y + 5 * s);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }
};

/** Moving parts of the clusters -> batch (pure function of f). */
const drawClustersDyn = (B: Batch2D, cl: Cluster[], f: number, gain: number) => {
  for (const c of cl) {
    const s = c.scale;
    switch (c.kind) {
      case "bars": {
        for (let i = 0; i < c.n; i++) {
          const v = 0.12 + 0.88 * beatValue(f, c.seed + i * 17, [24, 30, 40, 50][i % 4], LOOP, 0.55);
          const col = barColor(c, i);
          B.rect(c.x, c.y + i * 15 * s - 3 * s, c.w * v, 6 * s, col, 0.95, { i: 1.25 * gain });
        }
        break;
      }
      case "column": {
        for (let i = 0; i < c.n; i++) {
          const v = 0.25 + 0.75 * beatValue(f, c.seed + i * 17, [24, 30, 40, 50][i % 4], LOOP, 0.55);
          B.rect(c.x, c.y + i * 13 * s - 2.5 * s, c.w * v, 5 * s, barColor(c, i), 0.95, { i: 1.25 * gain });
        }
        break;
      }
      case "strip": {
        // emissive glow over the white pills (additive)
        B.rect(c.x - 4 * c.scale, c.y - 12 * c.scale, c.w * 2.2, 24 * c.scale, "#CFEFFF", 0.18, { i: 1.4, add: true });
        break;
      }
      case "panel": {
        const n = 7;
        const pts: number[] = [];
        for (let i = 0; i < n; i++) {
          const v = beatValue(f, c.seed + i * 29, 50, LOOP, 0.6);
          pts.push(c.x + (i / (n - 1)) * c.w, c.y + 30 * s - v * 70 * s);
        }
        B.poly(pts, 2.2 * s, YEL, 0.9, { i: 1.1 * gain });
        for (let i = 0; i < pts.length; i += 2) B.dot(pts[i], pts[i + 1], 4.5 * s, YEL, 1, { i: 1.3 * gain });
        break;
      }
      case "chips": {
        const st = stepIndex(f + (c.seed % 40), 40, LOOP);
        const on = Math.floor(hash2(c.seed, st) * 3);
        B.rect(c.x + on * 85 * s, c.y - 10 * s, 60 * s, 20 * s, CYA, 0.3, { i: gain, add: true });
        break;
      }
      case "chart": {
        const n = 10;
        const pts: number[] = [];
        for (let i = 0; i < n; i++) {
          const v = beatValue(f, c.seed + i * 29, 50, LOOP, 0.6);
          pts.push(c.x + (i / (n - 1)) * c.w * 1.8, c.y + 20 * s - v * 40 * s);
        }
        B.poly(pts, 1.4 * s, "#C8E070", 0.75, { i: 1.0 * gain });
        for (let i = 0; i < pts.length; i += 2) B.rect(pts[i] - 3.5 * s, pts[i + 1] - 3.5 * s, 7 * s, 7 * s, "#E8F4FF", 0.9, { border: 1.4 * s, i: 1.1 * gain });
        break;
      }
      case "digits": {
        const str = rollingDigits("#######", c.seed, f, LOOP, 10);
        B.text(str, c.x, c.y, 24 * s, WHT, 1, { i: 1.3 * gain, spacing: 1.25 });
        break;
      }
      case "tree": {
        const leaves = Math.min(c.n, 6);
        for (let i = 0; i < leaves; i++) {
          const y = c.y + (i - (leaves - 1) / 2) * 16 * s;
          const v = beatValue(f, c.seed + i * 5, 30, LOOP);
          B.rect(c.x + c.w * 0.62 + 72 * s, y - 2.5 * s, 40 * s * v, 5 * s, i % 2 ? YEL : CYA, 0.95, { i: 1.2 * gain });
        }
        break;
      }
      case "codes":
        break;
      case "blocks": {
        const st = stepIndex(f, 20, LOOP);
        for (let k = 0; k < 2; k++) {
          B.dot(c.x + hash3(c.seed, k, 1) * 140 * s, c.y + (hash3(c.seed, k, 2) - 0.5) * 60 * s, 3.5 * s, CYA, hash2(c.seed + k, st) > 0.3 ? 1 : 0.3, { i: 1.4 * gain, glow: 1.5 });
        }
        break;
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Layer descriptions

type LayerDef = {
  z: number;
  blur: number;
  tilesPerLoop: number; // 0 = static
  tileScale: number; // tile width / visible width at that depth
  count: number;
  scale: number;
  alpha: number;
  kinds: Cluster["kind"][];
  seed: number;
};

const ALL: Cluster["kind"][] = ["bars", "bars", "column", "column", "column", "chips", "digits", "digits", "digits", "tree", "tree", "codes", "codes", "codes", "blocks", "chart"];
const LAYERS: LayerDef[] = [
  { z: -2.0, blur: 0.0022, tilesPerLoop: 0, tileScale: 1.35, count: 50, scale: 1.0, alpha: 0.4, kinds: ALL, seed: 11 },
  { z: 0.25, blur: 0, tilesPerLoop: 0, tileScale: 1.25, count: 95, scale: 1.0, alpha: 1, kinds: [...ALL, "strip", "strip", "strip"], seed: 12 },
  { z: 3.0, blur: 0.0018, tilesPerLoop: 1, tileScale: 1.3, count: 22, scale: 1.0, alpha: 0.85, kinds: ALL, seed: 13 },
  { z: 6.5, blur: 0.0065, tilesPerLoop: 1, tileScale: 1.5, count: 6, scale: 1.1, alpha: 0.35, kinds: ["bars", "column", "chips", "digits", "codes"], seed: 14 },
  { z: 11, blur: 0.014, tilesPerLoop: 2, tileScale: 1.08, count: 2, scale: 1.2, alpha: 0.25, kinds: ["bars", "column", "chips"], seed: 15 },
];

const LAYER_CLUSTERS = LAYERS.map((L) => {
  const depthScale = CAM_Z / (CAM_Z - L.z);
  const visW = VIS_W / depthScale;
  const visH = VIS_H / depthScale;
  const tileW = visW * L.tileScale;
  const pxPerUnit = Math.min(PX_PER_UNIT_4K * depthScale, 4096 / tileW);
  const Wpx = Math.round(tileW * pxPerUnit);
  const Hpx = Math.round(visH * 1.05 * pxPerUnit);
  const r = mulberry32(L.seed * 7919);
  // px sizes are defined at 4K screen scale; convert to tile px
  const s = L.scale * (pxPerUnit / (PX_PER_UNIT_4K * depthScale));
  const clusters = genClusters(r, Wpx, Hpx, L.count, s, L.kinds);
  if (L.seed === 12) {
    // one dark panel with a yellow line chart, top right (as in the reference)
    clusters.push({ kind: "panel", x: Wpx * 0.74, y: Hpx * 0.07, n: 7, seed: 777, w: 300 * s, scale: s, palette: 0 });
  }
  return { tileW, tileH: visH * 1.05, pxPerUnit, Wpx, Hpx, clusters };
});

// ---------------------------------------------------------------------------

const drawMap = (assets: Assets) => {
  const mask = landMask(assets.land, 4096, 2048);
  const W = 4096;
  const H = Math.round((W * MAP_H) / MAP_W);
  const { c, ctx } = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  const cols = 380;
  const pitch = W / cols;
  const rows = Math.floor(H / pitch);
  const r = mulberry32(4242);
  const land: [number, number][] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const lon = -180 + ((i + 0.5) / cols) * 360;
      const lat = LAT_TOP - ((j + 0.5) / rows) * (LAT_TOP - LAT_BOT);
      const m = mask.at(lon, lat);
      const x = i * pitch + pitch * 0.22;
      const y = j * pitch + pitch * 0.22;
      const sz = pitch * 0.56;
      if (m > 0.5) {
        const a = 0.45 + 0.55 * r();
        ctx.fillStyle = MAPDOT;
        ctx.globalAlpha = a;
        ctx.fillRect(x, y, sz, sz);
        land.push([x + sz / 2, y + sz / 2]);
      } else {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = MAPDOT;
        ctx.fillRect(x + sz * 0.3, y + sz * 0.3, sz * 0.4, sz * 0.4);
      }
    }
  }
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = "#CFE6FF";
  ctx.lineWidth = pitch * 0.2;
  for (let k = 0; k < 40; k++) {
    const x = r() * W;
    const y = r() * H;
    const d = pitch * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - d, y - d);
    ctx.lineTo(x + d, y + d);
    ctx.moveTo(x + d, y - d);
    ctx.lineTo(x - d, y + d);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return { canvas: c, W, H, land, pitch };
};

const drawBackground = () => {
  const { c, ctx } = makeCanvas(1024, 576);
  const g = ctx.createRadialGradient(512, 280, 30, 512, 300, 600);
  g.addColorStop(0, "#0A2C62");
  g.addColorStop(0.5, "#061D48");
  g.addColorStop(1, "#010818");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 576);
  const band = ctx.createLinearGradient(0, 160, 0, 420);
  band.addColorStop(0, "rgba(40,110,210,0)");
  band.addColorStop(0.5, "rgba(40,110,210,0.07)");
  band.addColorStop(1, "rgba(40,110,210,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 160, 1024, 260);
  ctx.strokeStyle = "rgba(120,180,255,0.12)";
  for (const [x, y, w, h] of [[190, 530, 110, 34], [310, 530, 110, 34], [430, 530, 110, 34], [700, 10, 230, 70], [30, 80, 90, 380], [880, 500, 120, 40]]) {
    ctx.fillStyle = "rgba(2,10,30,0.55)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
  // faint grid
  ctx.strokeStyle = "rgba(106,168,232,0.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 576);
    ctx.stroke();
  }
  for (let y = 0; y <= 576; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  return c;
};

const build: BuildFn = (assets) => {
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 200);
  const layers: LayerSpec[] = [];

  // background + map
  const sBack = new THREE.Scene();
  const bgZ = -8;
  const bgScale = (CAM_Z - bgZ) / CAM_Z;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(VIS_W * bgScale * 1.8, VIS_H * bgScale * 1.4),
    texPlaneMaterial(canvasTexture(drawBackground())),
  );
  bg.position.z = bgZ;
  sBack.add(bg);

  const map = drawMap(assets);
  const sMap = new THREE.Scene();
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), texPlaneMaterial(canvasTexture(map.canvas), { tint: [1.05, 1.1, 1.15] }));
  // Africa near the centre-left, equator a little below centre
  // centred near 55 W: the Americas left of centre, Europe/Africa on the right
  mapMesh.position.x = (55 / 360) * MAP_W;
  mapMesh.position.y = -0.06 * VIS_H + ((LAT_TOP + LAT_BOT) / 2 / (LAT_TOP - LAT_BOT)) * MAP_H;
  sMap.add(mapMesh);
  const mapBatch = new Batch2D({ capacity: 800, width: map.W, height: map.H, unitsPerPx: MAP_W / map.W, z: 0.001, padPx: 2 });
  mapBatch.mesh.position.copy(mapMesh.position);
  mapBatch.mesh.renderOrder = 1;
  sMap.add(mapBatch.mesh);
  const twinkle = (() => {
    const r = mulberry32(999);
    return Array.from({ length: 420 }, () => ({ p: map.land[Math.floor(r() * map.land.length)], seed: irange(r, 1, 1e9), k: irange(r, 1, 4) }));
  })();

  // overlay layers
  const overlays = LAYERS.map((L, li) => {
    const info = LAYER_CLUSTERS[li];
    const { c, ctx } = makeCanvas(info.Wpx, info.Hpx);
    ctx.clearRect(0, 0, info.Wpx, info.Hpx);
    drawClustersStatic(ctx, info.clusters);
    const tex = canvasTexture(c);
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.position.z = L.z;
    scene.add(group);
    const mat = texPlaneMaterial(tex, { opacity: L.alpha });
    const batch = new Batch2D({
      capacity: 2500,
      width: info.Wpx,
      height: info.Hpx,
      unitsPerPx: 1 / info.pxPerUnit,
      z: 0.001,
      padPx: 2,
    });
    batch.opacity = L.alpha;
    const copies = L.tilesPerLoop > 0 ? [-1, 0, 1] : [0];
    for (const k of copies) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(info.tileW, info.tileH), mat);
      p.position.x = k * info.tileW;
      p.renderOrder = 0;
      group.add(p);
      const b = new THREE.Mesh(batch.mesh.geometry, batch.material);
      b.frustumCulled = false;
      b.position.x = k * info.tileW;
      b.renderOrder = 1;
      group.add(b);
    }
    return { L, info, scene, group, batch };
  });

  // layer order back to front. Layers with matching blur share one pass:
  // background + L0 (soft), map + L1 (sharp), then L2..L4.
  overlays[0].group.renderOrder = 1;
  sBack.add(overlays[0].group);
  layers.push({ scene: sBack, blur: LAYERS[0].blur });
  sMap.add(overlays[1].group);
  overlays[1].group.traverse((o) => (o.renderOrder += 2));
  const mapLayer: LayerSpec = { scene: sMap, depth: { focus: 20, band: 1.2, range: 3.0, maxBlur: 0.004, nearMul: 1.5 } };
  layers.push(mapLayer);
  for (let i = 2; i < overlays.length; i++) layers.push({ scene: overlays[i].scene, blur: LAYERS[i].blur });

  return {
    camera,
    layers,
    pipeline: {
      background: BG,
      bloomThreshold: 0.6,
      bloomKnee: 0.4,
      bloomIntensity: 0.9,
      bloomRadius: 0.6,
      vignette: 1.05,
      saturation: 1.0,
    },
    update: (f) => {
      // closed-cycle push/pull and sway
      const push = (1 - Math.cos((2 * Math.PI * f) / LOOP)) / 2;
      // slightly oblique: camera left of centre, looking a little right, so
      // the planes recede left to right and the left side comes nearer
      camera.position.set(-1.6 + 0.25 * cyc(f, LOOP, 1), 0.3 + 0.12 * cyc(f, LOOP, 1, 1.3), CAM_Z - 1.4 * push);
      camera.lookAt(0.2, 0, 0);
      camera.updateMatrixWorld();
      mapLayer.depth!.focus = camera.position.distanceTo(new THREE.Vector3(0.2, 0, 0));

      mapBatch.begin();
      for (const t of twinkle) {
        const v = 0.5 + 0.5 * cyc(f, LOOP, t.k * 3, (t.seed % 628) / 100);
        if (v > 0.6) mapBatch.rect(t.p[0] - map.pitch * 0.28, t.p[1] - map.pitch * 0.28, map.pitch * 0.56, map.pitch * 0.56, "#CFE8FF", (v - 0.6) * 2.2, { i: 1.6, add: true });
      }
      mapBatch.end();

      for (const o of overlays) {
        if (o.L.tilesPerLoop > 0) {
          const t = ((f * o.L.tilesPerLoop) / LOOP) % 1;
          o.group.position.x = -t * o.info.tileW;
        }
        o.batch.begin();
        drawClustersDyn(o.batch, o.info.clusters, f, 1);
        o.batch.end();
      }
      return { grainFrame: f % LOOP, exposure: 0.82 };
    },
  };
};

export const DataWorldMap: React.FC<LookProps> = ({ grade }) => <Stage build={build} grade={grade} />;
