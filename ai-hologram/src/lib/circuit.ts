import * as THREE from "three";
import { mulberry32, int, range, type Rng } from "./rng";
import { SEED } from "../config";

/**
 * Procedural circuit-board texture, generated once at module scope.
 *
 * Channel packing (this is what the ground-plane shader reads):
 *   R — ink mask: traces, pads and blocks, with different intensities
 *   G — pulse carrier phase; 0 means "this trace carries no pulse"
 *   B — for carriers, the along-trace parameter 0..1; for everything else, a
 *       per-element random used to stagger the build-on light-up
 *
 * The tile wraps seamlessly: any element whose bounding box reaches an edge is
 * redrawn at the eight neighbouring offsets.
 */
export const CIRCUIT_TEXTURE_SIZE = 2048;

const GRID = 32;
const TRACE_COUNT = 460;
const PAD_COUNT = 260;
const BLOCK_COUNT = 90;
const VIA_COUNT = 420;
/** Roughly one trace in nine carries a travelling pulse. */
const CARRIER_RATE = 0.11;

type Draw = {
  /** Axis-aligned bounds, used to decide whether the element needs wrapping. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  run: (ctx: CanvasRenderingContext2D) => void;
};

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const buildTrace = (rng: Rng, size: number): Draw => {
  const start: [number, number] = [
    int(rng, 0, size / GRID) * GRID,
    int(rng, 0, size / GRID) * GRID,
  ];
  const segs = int(rng, 2, 5);
  const pts: [number, number][] = [start];
  let dir = DIRS[int(rng, 0, DIRS.length - 1)];
  for (let s = 0; s < segs; s++) {
    // Prefer Manhattan runs, with 45s mixed in — the routing language of a
    // real board rather than a random walk.
    if (s > 0) {
      const turn = rng();
      const idx = DIRS.findIndex((d) => d[0] === dir[0] && d[1] === dir[1]);
      dir = turn < 0.45 ? DIRS[(idx + 4) % DIRS.length] : DIRS[int(rng, 0, DIRS.length - 1)];
    }
    const len = int(rng, 2, 9) * GRID;
    const prev = pts[pts.length - 1];
    pts.push([prev[0] + dir[0] * len, prev[1] + dir[1] * len]);
  }

  const isCarrier = rng() < CARRIER_RATE;
  const phase = isCarrier ? Math.max(1, Math.round(rng() * 254)) : 0;
  const rand = Math.round(range(rng, 20, 255));
  const width = rng() < 0.22 ? 5 : rng() < 0.5 ? 3.4 : 2.4;
  const ink = Math.round(range(rng, 110, 175));

  // Cumulative arc length, so the along-trace parameter is uniform in space.
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);

  return {
    minX: Math.min(...xs) - width,
    minY: Math.min(...ys) - width,
    maxX: Math.max(...xs) + width,
    maxY: Math.max(...ys) + width,
    run: (ctx) => {
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const t0 = acc / total;
        acc += lens[i - 1];
        const t1 = acc / total;
        const b0 = isCarrier ? Math.round(t0 * 255) : rand;
        const b1 = isCarrier ? Math.round(t1 * 255) : rand;
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, `rgb(${ink},${phase},${b0})`);
        grad.addColorStop(1, `rgb(${ink},${phase},${b1})`);
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    },
  };
};

const buildPad = (rng: Rng, size: number): Draw => {
  const x = int(rng, 0, size / GRID) * GRID;
  const y = int(rng, 0, size / GRID) * GRID;
  const r = range(rng, 4, 8);
  const rand = Math.round(range(rng, 20, 255));
  const ink = Math.round(range(rng, 170, 225));
  return {
    minX: x - r,
    minY: y - r,
    maxX: x + r,
    maxY: y + r,
    run: (ctx) => {
      ctx.fillStyle = `rgb(${ink},0,${rand})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
  };
};

const buildBlock = (rng: Rng, size: number): Draw => {
  const x = int(rng, 0, size / GRID) * GRID;
  const y = int(rng, 0, size / GRID) * GRID;
  const w = int(rng, 2, 7) * GRID;
  const h = int(rng, 1, 4) * GRID;
  const rand = Math.round(range(rng, 20, 255));
  const outline = Math.round(range(rng, 130, 190));
  const fill = Math.round(range(rng, 26, 52));
  const pins = rng() < 0.6;
  return {
    minX: x - 8,
    minY: y - 8,
    maxX: x + w + 8,
    maxY: y + h + 8,
    run: (ctx) => {
      ctx.fillStyle = `rgb(${fill},0,${rand})`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgb(${outline},0,${rand})`;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x, y, w, h);
      if (pins) {
        ctx.lineWidth = 3;
        for (let px = x + 8; px < x + w - 4; px += 12) {
          ctx.beginPath();
          ctx.moveTo(px, y);
          ctx.lineTo(px, y - 7);
          ctx.moveTo(px, y + h);
          ctx.lineTo(px, y + h + 7);
          ctx.stroke();
        }
      }
    },
  };
};

const buildVia = (rng: Rng, size: number): Draw => {
  const x = rng() * size;
  const y = rng() * size;
  const r = range(rng, 1.6, 3.2);
  const rand = Math.round(range(rng, 20, 255));
  return {
    minX: x - r,
    minY: y - r,
    maxX: x + r,
    maxY: y + r,
    run: (ctx) => {
      ctx.fillStyle = `rgb(200,0,${rand})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
  };
};

let cached: THREE.Texture | null = null;

export const getCircuitTexture = (): THREE.Texture => {
  if (cached) return cached;

  const size = CIRCUIT_TEXTURE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  const rng = mulberry32(SEED);
  const items: Draw[] = [];
  for (let i = 0; i < BLOCK_COUNT; i++) items.push(buildBlock(rng, size));
  for (let i = 0; i < TRACE_COUNT; i++) items.push(buildTrace(rng, size));
  for (let i = 0; i < PAD_COUNT; i++) items.push(buildPad(rng, size));
  for (let i = 0; i < VIA_COUNT; i++) items.push(buildVia(rng, size));

  for (const item of items) {
    const wrapX = item.minX < 0 || item.maxX > size;
    const wrapY = item.minY < 0 || item.maxY > size;
    const offX = wrapX ? [-size, 0, size] : [0];
    const offY = wrapY ? [-size, 0, size] : [0];
    for (const dx of offX) {
      for (const dy of offY) {
        ctx.save();
        ctx.translate(dx, dy);
        item.run(ctx);
        ctx.restore();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // the channels are data, not colour
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};
