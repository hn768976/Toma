// Procedural "satellite" maps painted with Canvas 2D. Each map is painted once into
// two layers:
//   base    – grayscale photographic terrain (forest canopy, fields, roads, roofs)
//   overlay – the GIS-style vector line-work, tinted with the HUD accent colour later
// The palette is applied in the shader (renderer.ts), so the same maps serve both
// colour versions.
//
// Coordinates are "layout units": pixels of a 1192 x 672 frame, the reference's
// framing at zoom 1 (see timeline.ts). MAP_RECT gives the area each texture covers.

export const MAP_RECT = { x0: -160, y0: -110, w: 1512, h: 900 };
export const TEX_W = 5120;
export const TEX_H = Math.round((TEX_W * MAP_RECT.h) / MAP_RECT.w); // 3048
const K = TEX_W / MAP_RECT.w;

export type MapLayers = { base: HTMLCanvasElement; overlay: HTMLCanvasElement };

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const gray = (l: number, a = 1) => {
  const v = Math.round(Math.max(0, Math.min(1, l)) * 255);
  return `rgba(${v},${v},${v},${a})`;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const layoutCtx = (c: HTMLCanvasElement) => {
  const g = c.getContext("2d")!;
  g.setTransform(K, 0, 0, K, -MAP_RECT.x0 * K, -MAP_RECT.y0 * K);
  return g;
};

// --- noise textures -------------------------------------------------------------

// Smooth multi-octave value noise rendered into a canvas (luminance in [lo, hi]).
const noiseCanvas = (
  w: number,
  h: number,
  seed: number,
  cell: number,
  octaves: number,
  lo: number,
  hi: number,
  contrast = 1,
) => {
  const rnd = mulberry32(seed);
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grids: Float32Array[] = [];
  for (let o = 0; o < octaves; o++) {
    const s = 1 << o;
    const arr = new Float32Array(gw * s * gh * s + gw * s + 4);
    for (let i = 0; i < arr.length; i++) arr[i] = rnd();
    grids.push(arr);
  }
  const c = makeCanvas(w, h);
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      let amp = 0.5;
      let tot = 0;
      for (let o = 0; o < octaves; o++) {
        const s = 1 << o;
        const gx = (x / cell) * s;
        const gy = (y / cell) * s;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        const stride = gw * s;
        const arr = grids[o];
        const a = arr[iy * stride + ix];
        const b = arr[iy * stride + ix + 1];
        const cc = arr[(iy + 1) * stride + ix];
        const dd = arr[(iy + 1) * stride + ix + 1];
        v +=
          (a + (b - a) * ux + (cc - a) * uy + (a - b - cc + dd) * ux * uy) *
          amp;
        tot += amp;
        amp *= 0.5;
      }
      v /= tot;
      v = Math.max(0, Math.min(1, (v - 0.5) * contrast + 0.5));
      const l = Math.round((lo + (hi - lo) * v) * 255);
      const i = (y * w + x) * 4;
      d[i] = l;
      d[i + 1] = l;
      d[i + 2] = l;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
};

// Tree-canopy grain: overlapping soft crowns, lit from the top-left, with dark gaps.
const canopyTile = (
  seed: number,
  size = 1024,
  count = 9000,
  rMin = 4,
  rMax = 13,
) => {
  const c = makeCanvas(size, size);
  const g = c.getContext("2d")!;
  const rnd = mulberry32(seed);
  g.fillStyle = gray(0.08);
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = rMin + Math.pow(rnd(), 1.6) * (rMax - rMin);
    const l = 0.22 + rnd() * 0.38;
    for (const [ox, oy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      const px = x + ox;
      const py = y + oy;
      if (px < -r || py < -r || px > size + r || py > size + r) continue;
      const gr = g.createRadialGradient(
        px - r * 0.35,
        py - r * 0.35,
        0,
        px,
        py,
        r,
      );
      gr.addColorStop(0, gray(l + 0.16));
      gr.addColorStop(0.6, gray(l));
      gr.addColorStop(1, gray(l * 0.35, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
};

// --- drawing helpers ------------------------------------------------------------

const poly = (g: Ctx, pts: Pt[]) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath();
};

const path = (g: Ctx, pts: Pt[]) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
};

// Smooth path through points (Catmull-Rom converted to Béziers).
const curve = (g: Ctx, pts: Pt[]) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    g.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
};

type RoadStyle = {
  width: number;
  asphalt: number;
  edge: number;
  edgeW?: number;
};

const road = (g: Ctx, pts: Pt[], s: RoadStyle, smooth = false) => {
  const draw = () => (smooth ? curve(g, pts) : path(g, pts));
  g.lineCap = "round";
  g.lineJoin = "round";
  draw();
  g.strokeStyle = gray(s.edge);
  g.lineWidth = s.width + (s.edgeW ?? 1.2) * 2;
  g.stroke();
  draw();
  g.strokeStyle = gray(s.asphalt);
  g.lineWidth = s.width;
  g.stroke();
};

const line = (
  g: Ctx,
  pts: Pt[],
  width: number,
  style: string,
  smooth = false,
) => {
  if (smooth) curve(g, pts);
  else path(g, pts);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = style;
  g.lineWidth = width;
  g.stroke();
};

// Roof with a drop shadow, optionally rotated.
const building = (
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  l: number,
  rot = 0,
) => {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = gray(0.05, 0.7);
  g.fillRect(-w / 2 + w * 0.12, -h / 2 + h * 0.18, w, h);
  g.fillStyle = gray(l);
  g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = gray(l + 0.08);
  g.fillRect(-w / 2, -h / 2, w, h * 0.45);
  g.restore();
};

const fillWithPattern = (
  g: Ctx,
  pattern: CanvasPattern,
  shape: () => void,
  alpha = 1,
  op: GlobalCompositeOperation = "source-over",
) => {
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = op;
  shape();
  g.fillStyle = pattern;
  g.fill();
  g.restore();
};

// Lays the textured forest + large-scale tonal variation across the whole map.
const terrain = (
  base: HTMLCanvasElement,
  seed: number,
  lo: number,
  hi: number,
) => {
  const g = base.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  // Broad tonal regions (stands of forest, wetter/darker ground).
  g.drawImage(
    noiseCanvas(640, 381, seed, 60, 5, lo, hi, 1.9),
    0,
    0,
    TEX_W,
    TEX_H,
  );
  // Mid-scale density variation.
  g.globalCompositeOperation = "multiply";
  g.drawImage(
    noiseCanvas(1280, 762, seed + 3, 22, 4, 0.55, 1, 1.6),
    0,
    0,
    TEX_W,
    TEX_H,
  );
  // Canopy grain at two scales/orientations so the tile repeat is not visible.
  g.globalAlpha = 0.7;
  g.fillStyle = g.createPattern(canopyTile(seed + 1), "repeat")!;
  g.fillRect(0, 0, TEX_W, TEX_H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "soft-light";
  g.globalAlpha = 0.7;
  const pat2 = g.createPattern(
    canopyTile(seed + 2, 768, 5200, 5, 16),
    "repeat",
  )!;
  pat2.setTransform(new DOMMatrix().rotate(37).scale(1.25));
  g.fillStyle = pat2;
  g.fillRect(0, 0, TEX_W, TEX_H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
};

// Breaks straight polygon edges into a ragged, natural outline (deterministic).
const ragged = (pts: Pt[], amp: number, seed: number): Pt[] => {
  const rnd = mulberry32(seed);
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.round(len / 6));
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    let off = 0;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      off = off * 0.6 + (rnd() - 0.5) * amp;
      out.push([
        a[0] + (b[0] - a[0]) * t + nx * off,
        a[1] + (b[1] - a[1]) * t + ny * off,
      ]);
    }
  }
  return out;
};

// Light, textured open ground (fields / clearings) with a soft, ragged tree line.
const clearing = (
  g: Ctx,
  pts: Pt[],
  l: number,
  grain: CanvasPattern,
  seed = 1,
) => {
  const shape = ragged(pts, 13, seed + Math.round(pts[0][0] * 7 + pts[0][1]));
  g.save();
  g.shadowColor = gray(l * 0.8, 0.8);
  g.shadowBlur = 10;
  poly(g, shape);
  g.fillStyle = gray(l);
  g.fill();
  g.restore();
  fillWithPattern(g, grain, () => poly(g, shape), 0.6, "multiply");
};

// --- the compound (shared by both maps; map A shows it far away) ---------------

const OVERLAY = "rgba(255,255,255,0.95)";

type Hub = { x: number; y: number; r: number };

// Compound layout in layout units, matching the reference's close-up framing.
export const HUBS: Hub[] = [
  { x: 617, y: 290, r: 62 },
  { x: 497, y: 390, r: 64 },
];

const hubPads = (h: Hub) => {
  const out: Array<{ x: number; y: number; a: number }> = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    out.push({ x: h.x + Math.cos(a) * h.r, y: h.y + Math.sin(a) * h.r, a });
  }
  return out;
};

const drawCompound = (g: Ctx, o: Ctx, grain: CanvasPattern, detail: number) => {
  const asphalt: RoadStyle = { width: 9, asphalt: 0.1, edge: 0.5 };
  const minor: RoadStyle = { width: 4, asphalt: 0.16, edge: 0.55, edgeW: 0.9 };

  // Cleared ground inside the compound.
  const pad: Pt[] = [
    [400, 200],
    [700, 170],
    [800, 300],
    [740, 520],
    [520, 560],
    [330, 470],
  ];
  clearing(g, pad, 0.38, grain);

  // Runway + parallel taxiway along the top.
  g.fillStyle = gray(0.07);
  g.fillRect(400, 52, 1000, 44);
  g.fillStyle = gray(0.5);
  g.fillRect(410, 58, 990, 30);
  fillWithPattern(g, grain, () => g.rect(410, 58, 990, 30), 0.4, "multiply");
  g.fillStyle = gray(0.92);
  for (let x = 560; x < 1400; x += 34) g.fillRect(x, 72, 16, 2);
  g.fillStyle = gray(0.04);
  for (let i = 0; i < 8; i++) g.fillRect(418 + i * 17, 64, 11, 18);
  g.fillRect(540, 66, 22, 14);
  road(
    g,
    [
      [300, 28],
      [1400, 28],
    ],
    { width: 7, asphalt: 0.12, edge: 0.45 },
  );

  // Curved taxiway: from the runway, sweeping into the main diagonal road.
  road(
    g,
    [
      [1400, 178],
      [1000, 178],
      [700, 176],
      [655, 182],
      [620, 205],
      [470, 320],
      [330, 425],
      [150, 560],
      [-60, 720],
    ],
    { width: 13, asphalt: 0.08, edge: 0.42 },
    true,
  );
  road(
    g,
    [
      [655, 182],
      [640, 120],
      [600, 96],
    ],
    asphalt,
    true,
  );
  road(
    g,
    [
      [440, 96],
      [470, 140],
      [420, 220],
      [300, 300],
      [140, 420],
    ],
    minor,
    true,
  );
  // Hexagonal perimeter road around the compound.
  road(
    g,
    [
      [470, 160],
      [720, 150],
      [820, 330],
      [740, 520],
      [520, 560],
      [370, 470],
    ],
    minor,
  );
  road(
    g,
    [
      [560, 520],
      [700, 430],
      [860, 320],
      [960, 260],
    ],
    minor,
    true,
  );
  road(
    g,
    [
      [700, 430],
      [770, 470],
      [900, 480],
      [1200, 470],
    ],
    minor,
    true,
  );
  road(
    g,
    [
      [620, 205],
      [617, 228],
    ],
    minor,
  );
  road(
    g,
    [
      [497, 326],
      [560, 330],
      [617, 352],
    ],
    minor,
    true,
  );
  road(
    g,
    [
      [497, 454],
      [560, 500],
      [640, 470],
    ],
    minor,
    true,
  );
  road(
    g,
    [
      [948, 190],
      [950, 400],
      [948, 700],
    ],
    { width: 3, asphalt: 0.45, edge: 0.3 },
  );
  road(
    g,
    [
      [1180, 190],
      [1182, 760],
    ],
    { width: 3, asphalt: 0.45, edge: 0.3 },
  );
  road(
    g,
    [
      [300, 520],
      [600, 600],
      [960, 560],
      [1350, 540],
    ],
    { width: 3, asphalt: 0.42, edge: 0.28 },
    true,
  );

  // Hubs: ring road, central disc, eight pads with buildings.
  for (const h of HUBS) {
    g.beginPath();
    g.arc(h.x, h.y, h.r + 14, 0, Math.PI * 2);
    g.fillStyle = gray(0.34);
    g.fill();
    g.beginPath();
    g.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    g.strokeStyle = gray(0.55);
    g.lineWidth = 9;
    g.stroke();
    g.strokeStyle = gray(0.1);
    g.lineWidth = 6;
    g.stroke();
    g.beginPath();
    g.arc(h.x, h.y, h.r * 0.42, 0, Math.PI * 2);
    g.fillStyle = gray(0.22);
    g.fill();
    fillWithPattern(
      g,
      grain,
      () => {
        g.beginPath();
        g.arc(h.x, h.y, h.r * 0.42, 0, Math.PI * 2);
      },
      0.8,
      "multiply",
    );
    g.beginPath();
    g.arc(h.x, h.y, h.r * 0.42, 0, Math.PI * 2);
    g.strokeStyle = gray(0.62);
    g.lineWidth = 2;
    g.stroke();
    for (const p of hubPads(h)) {
      const bx = h.x + Math.cos(p.a) * (h.r + 20);
      const by = h.y + Math.sin(p.a) * (h.r + 20);
      building(g, bx, by, 16, 11, 0.86, p.a + Math.PI / 2);
      road(
        g,
        [
          [p.x, p.y],
          [bx, by],
        ],
        { width: 3, asphalt: 0.15, edge: 0.5, edgeW: 0.6 },
      );
    }
  }

  // Scattered buildings.
  const rnd = mulberry32(99);
  const blocks: Array<[number, number, number, number, number]> = [
    [383, 150, 18, 12, 0],
    [400, 150, 12, 12, 0],
    [383, 166, 30, 8, 0],
    [800, 290, 20, 14, 0.1],
    [778, 318, 10, 18, 0],
    [930, 392, 18, 12, 0],
    [700, 236, 14, 10, -0.6],
    [560, 238, 12, 9, -0.6],
    [420, 470, 16, 10, -0.6],
  ];
  for (const b of blocks) building(g, b[0], b[1], b[2], b[3], 0.82, b[4]);
  for (let i = 0; i < 30 * detail; i++) {
    const x = 380 + rnd() * 420;
    const y = 190 + rnd() * 340;
    if (HUBS.some((h) => Math.hypot(x - h.x, y - h.y) < h.r + 40)) continue;
    building(g, x, y, 5 + rnd() * 8, 4 + rnd() * 6, 0.65 + rnd() * 0.25, -0.6);
  }

  // White triangular structure south of the hubs.
  poly(g, [
    [612, 512],
    [668, 512],
    [640, 470],
  ]);
  g.fillStyle = gray(0.92);
  g.fill();
  g.fillStyle = gray(0.7);
  g.fillRect(616, 500, 48, 14);

  // GIS overlay line-work.
  o.strokeStyle = OVERLAY;
  o.lineCap = "round";
  o.lineJoin = "round";
  for (const h of HUBS) {
    o.lineWidth = 1.1;
    o.beginPath();
    o.arc(h.x, h.y, h.r + 5, 0, Math.PI * 2);
    o.stroke();
    o.beginPath();
    o.arc(h.x, h.y, h.r - 5, 0, Math.PI * 2);
    o.stroke();
    o.lineWidth = 0.8;
    o.beginPath();
    o.arc(h.x, h.y, h.r * 0.42 + 4, 0, Math.PI * 2);
    o.stroke();
    for (const p of hubPads(h)) {
      const bx = h.x + Math.cos(p.a) * (h.r + 20);
      const by = h.y + Math.sin(p.a) * (h.r + 20);
      o.save();
      o.translate(bx, by);
      o.rotate(p.a + Math.PI / 2);
      o.strokeRect(-10, -7, 20, 14);
      o.restore();
    }
  }
  line(
    o,
    [
      [1400, 170],
      [1000, 170],
      [700, 168],
      [650, 175],
      [612, 199],
      [462, 314],
      [322, 419],
      [142, 554],
    ],
    1.0,
    OVERLAY,
    true,
  );
  line(
    o,
    [
      [1400, 186],
      [1000, 186],
      [705, 184],
      [662, 190],
      [628, 212],
      [478, 326],
      [338, 431],
      [158, 566],
    ],
    1.0,
    OVERLAY,
    true,
  );
  line(
    o,
    [
      [470, 160],
      [720, 150],
      [820, 330],
      [740, 520],
      [520, 560],
      [370, 470],
      [470, 160],
    ],
    0.9,
    OVERLAY,
  );
  line(
    o,
    [
      [560, 520],
      [700, 430],
      [860, 320],
      [960, 260],
    ],
    0.8,
    OVERLAY,
    true,
  );
  o.strokeRect(410, 58, 990, 30);
};

// Thin, pale dirt tracks wandering through the forest (seeded random walks).
const tracks = (g: Ctx, seed: number, n: number) => {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    let x = MAP_RECT.x0 + rnd() * MAP_RECT.w;
    let y = MAP_RECT.y0 + rnd() * MAP_RECT.h;
    let a = rnd() * Math.PI * 2;
    const pts: Pt[] = [[x, y]];
    const steps = 6 + Math.floor(rnd() * 10);
    for (let k = 0; k < steps; k++) {
      a += (rnd() - 0.5) * 0.7;
      x += Math.cos(a) * 28;
      y += Math.sin(a) * 28;
      pts.push([x, y]);
    }
    line(g, pts, 1.6 + rnd() * 1.2, gray(0.5 + rnd() * 0.25, 0.75), true);
  }
};

// --- Map B: close-up on the compound -------------------------------------------

export const drawMapB = (): MapLayers => {
  const base = makeCanvas(TEX_W, TEX_H);
  const overlay = makeCanvas(TEX_W, TEX_H);
  terrain(base, 11, 0.34, 0.7);
  const g = layoutCtx(base);
  const o = layoutCtx(overlay);
  const grain = g.createPattern(
    noiseCanvas(256, 256, 5, 6, 3, 0.55, 1, 1.4),
    "repeat",
  )!;

  tracks(g, 31, 26);
  clearing(
    g,
    [
      [955, 262],
      [1062, 270],
      [1066, 352],
      [960, 348],
    ],
    0.72,
    grain,
  );
  clearing(
    g,
    [
      [1080, 540],
      [1352, 520],
      [1352, 690],
      [1100, 680],
    ],
    0.66,
    grain,
  );
  clearing(
    g,
    [
      [120, 455],
      [300, 440],
      [330, 540],
      [140, 600],
      [60, 560],
    ],
    0.5,
    grain,
  );
  clearing(
    g,
    [
      [1080, 200],
      [1352, 200],
      [1352, 300],
      [1100, 290],
    ],
    0.42,
    grain,
  );
  clearing(
    g,
    [
      [-160, 80],
      [200, 60],
      [260, 160],
      [-160, 220],
    ],
    0.36,
    grain,
  );
  clearing(
    g,
    [
      [-160, 600],
      [100, 640],
      [200, 790],
      [-160, 790],
    ],
    0.55,
    grain,
  );
  drawCompound(g, o, grain, 1);
  building(g, 1010, 300, 46, 30, 0.88);
  building(g, 1200, 600, 60, 36, 0.86, 0.5);
  building(g, 1230, 640, 40, 26, 0.84, 0.5);
  return { base, overlay };
};

// --- Map A: wide view, airfield + town + coast; the compound sits in the middle ---

export const drawMapA = (): MapLayers => {
  const base = makeCanvas(TEX_W, TEX_H);
  const overlay = makeCanvas(TEX_W, TEX_H);
  terrain(base, 23, 0.3, 0.72);
  const g = layoutCtx(base);
  const o = layoutCtx(overlay);
  const grain = g.createPattern(
    noiseCanvas(256, 256, 7, 5, 3, 0.55, 1, 1.4),
    "repeat",
  )!;
  const rnd = mulberry32(4);
  tracks(g, 57, 60);

  clearing(
    g,
    [
      [880, 200],
      [1090, 215],
      [1110, 330],
      [900, 320],
    ],
    0.45,
    grain,
  );
  clearing(
    g,
    [
      [150, 150],
      [350, 140],
      [360, 290],
      [170, 300],
    ],
    0.33,
    grain,
  );
  clearing(
    g,
    [
      [700, 430],
      [850, 420],
      [870, 520],
      [720, 530],
    ],
    0.36,
    grain,
  );
  clearing(
    g,
    [
      [1150, 0],
      [1352, -20],
      [1352, 140],
      [1180, 160],
    ],
    0.4,
    grain,
  );

  // Coast + town in the lower left: bright blocks cut by a street grid.
  const town: Pt[] = [
    [-160, 560],
    [40, 540],
    [150, 500],
    [262, 520],
    [330, 470],
    [420, 498],
    [520, 466],
    [600, 516],
    [566, 600],
    [470, 640],
    [384, 700],
    [210, 760],
    [-160, 790],
  ];
  const townShape = ragged(town, 9, 77);
  g.save();
  g.shadowColor = gray(0.5, 0.9);
  g.shadowBlur = 14;
  poly(g, townShape);
  g.fillStyle = gray(0.6);
  g.fill();
  g.restore();
  fillWithPattern(g, grain, () => poly(g, townShape), 0.7, "multiply");
  g.save();
  poly(g, townShape);
  g.clip();
  // Irregular street network (slightly curved, two dominant directions).
  g.strokeStyle = gray(0.28, 0.55);
  g.lineWidth = 1.1;
  for (let x = -160; x < 640; x += 16 + rnd() * 18) {
    const j = (rnd() - 0.5) * 20;
    curve(g, [
      [x, 430],
      [x + 22 + j, 600],
      [x + 50, 800],
    ]);
    g.stroke();
  }
  for (let y = 430; y < 820; y += 14 + rnd() * 16) {
    const j = (rnd() - 0.5) * 16;
    curve(g, [
      [-160, y],
      [240, y - 14 + j],
      [640, y - 42],
    ]);
    g.stroke();
  }
  // Roofs: bright, varied, small rotations; a few dark tree clumps.
  for (let i = 0; i < 1500; i++) {
    const x = -160 + rnd() * 800;
    const y = 440 + rnd() * 360;
    building(
      g,
      x,
      y,
      2.5 + rnd() * 9,
      2 + rnd() * 6,
      0.6 + rnd() * 0.4,
      -0.12 + (rnd() - 0.5) * 0.3,
    );
  }
  for (let i = 0; i < 140; i++) {
    g.beginPath();
    g.arc(-160 + rnd() * 800, 440 + rnd() * 360, 2 + rnd() * 7, 0, Math.PI * 2);
    g.fillStyle = gray(0.18 + rnd() * 0.15, 0.85);
    g.fill();
  }
  g.restore();
  // Dark water beyond the town.
  poly(g, [
    [-160, 700],
    [60, 760],
    [220, 790],
    [-160, 790],
  ]);
  g.fillStyle = gray(0.06);
  g.fill();

  // Highway and secondary roads.
  road(
    g,
    [
      [850, 800],
      [1300, -60],
    ],
    { width: 3.2, asphalt: 0.7, edge: 0.3 },
  );
  road(
    g,
    [
      [880, 800],
      [1330, -60],
    ],
    { width: 1.5, asphalt: 0.45, edge: 0.25 },
  );
  road(
    g,
    [
      [-160, 300],
      [100, 330],
      [300, 380],
      [430, 400],
    ],
    { width: 2, asphalt: 0.55, edge: 0.25 },
    true,
  );
  road(
    g,
    [
      [760, 330],
      [880, 380],
      [1000, 470],
      [1100, 620],
    ],
    { width: 1.6, asphalt: 0.55, edge: 0.25 },
    true,
  );
  road(
    g,
    [
      [600, 470],
      [580, 560],
      [560, 640],
    ],
    { width: 1.6, asphalt: 0.55, edge: 0.25 },
    true,
  );

  // Airfield: runway, taxiway, aprons.
  g.fillStyle = gray(0.1);
  g.fillRect(462, 232, 310, 14);
  g.fillStyle = gray(0.62);
  g.fillRect(466, 235, 302, 8);
  road(
    g,
    [
      [480, 252],
      [760, 252],
    ],
    { width: 3, asphalt: 0.2, edge: 0.6 },
  );
  for (const [x, y, w, h] of [
    [520, 258, 40, 14],
    [600, 260, 30, 10],
    [680, 256, 46, 16],
  ]) {
    g.fillStyle = gray(0.58);
    g.fillRect(x, y, w, h);
  }

  // The compound itself, far away (scaled-down copy of map B's layout).
  g.save();
  o.save();
  for (const c of [g, o]) {
    c.translate(600, 330);
    c.scale(0.34, 0.34);
    c.translate(-596, -336);
  }
  drawCompound(g, o, grain, 0.6);
  g.restore();
  o.restore();

  // Building clusters and roads radiating from the compound.
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 60 + rnd() * 150;
    const x = 600 + Math.cos(a) * r * 1.3;
    const y = 320 + Math.sin(a) * r * 0.8;
    building(g, x, y, 2 + rnd() * 6, 2 + rnd() * 4, 0.6 + rnd() * 0.35);
  }
  const net: Pt[][] = [
    [
      [600, 330],
      [520, 300],
      [430, 250],
      [380, 200],
    ],
    [
      [600, 330],
      [700, 290],
      [790, 250],
      [830, 180],
    ],
    [
      [600, 330],
      [660, 400],
      [740, 450],
      [800, 520],
    ],
    [
      [600, 330],
      [540, 400],
      [470, 440],
      [400, 470],
    ],
    [
      [480, 252],
      [520, 200],
      [560, 160],
    ],
    [
      [700, 252],
      [740, 200],
      [800, 170],
      [860, 150],
    ],
    [
      [420, 300],
      [380, 360],
      [300, 380],
    ],
    [
      [760, 330],
      [820, 360],
      [880, 380],
    ],
  ];
  for (const n of net) {
    road(g, n, { width: 1.6, asphalt: 0.62, edge: 0.25 }, true);
    line(o, n, 0.9, OVERLAY, true);
  }
  o.strokeRect(462, 232, 310, 14);
  line(
    o,
    [
      [850, 800],
      [1300, -60],
    ],
    0.9,
    OVERLAY,
  );
  for (let i = 0; i < 40; i++) {
    const x = 450 + rnd() * 330;
    const y = 200 + rnd() * 250;
    o.lineWidth = 0.7;
    o.strokeRect(x, y, 4 + rnd() * 10, 3 + rnd() * 7);
  }
  return { base, overlay };
};
