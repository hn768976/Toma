import { useCallback } from "react";
import getStroke from "perfect-freehand";
import { RoughGenerator } from "roughjs/bin/generator";
import { CanvasStage, DrawInfo, makeCanvas } from "../lib/CanvasStage";
import { hash, mulberry32, range } from "../lib/random";
import { GREEN, IDEA_BULB } from "../config";

const LOOP = 300;
const HOLD = 3; // frames per boil drawing
const VARIANTS = 4; // 4 drawings x 3 frames = 12-frame boil
const FLICKER_EVERY = 15;

type Pt = [number, number];

// Bulb geometry in "bulb units": glass top to base bottom = 1, origin at the
// middle of that height. Glass centre sits above the origin.
const GLASS_C: Pt = [0, -0.2];
const GLASS: Pt[] = [
  [-0.1, 0.19], [-0.105, 0.11], [-0.12, 0.03], [-0.16, -0.05], [-0.205, -0.13],
  [-0.225, -0.22], [-0.21, -0.33], [-0.15, -0.42], [-0.04, -0.47], [0.06, -0.465],
  [0.155, -0.415], [0.21, -0.32], [0.225, -0.21], [0.205, -0.125], [0.16, -0.045],
  [0.122, 0.035], [0.105, 0.115], [0.1, 0.19],
];
const FILAMENT: Pt[] = [
  [-0.057, 0.2], [-0.059, 0.08], [-0.063, -0.02], [-0.078, -0.095], [-0.111, -0.145],
  [-0.108, -0.185], [-0.068, -0.2], [-0.034, -0.175], [-0.043, -0.13], [-0.070, -0.11],
  [-0.061, -0.14], [-0.020, -0.175], [0.034, -0.19], [0.084, -0.17], [0.095, -0.125],
  [0.081, -0.07], [0.070, 0.01], [0.065, 0.1], [0.062, 0.2],
];
// Screw base: [y, half width]
const BASE: [number, number][] = [
  [0.25, 0.16], [0.32, 0.145], [0.39, 0.115], [0.46, 0.055],
];
// 8 rays around the glass centre: [angle in degrees, 0 = right, clockwise].
const RAYS = [-102, -76, -148, -32, 172, 4, 138, 44];
const RAY_IN = 0.39;
const RAY_LEN = 0.17;
const STROKE = 0.03; // chalk line width, fraction of bulb height

const gen = new RoughGenerator();

// Sample a rough.js drawable's ops into a polyline.
const opsToPoints = (ops: { op: string; data: number[] }[]): Pt[] => {
  const out: Pt[] = [];
  let cx = 0;
  let cy = 0;
  for (const o of ops) {
    if (o.op === "move") {
      cx = o.data[0];
      cy = o.data[1];
      if (out.length === 0) out.push([cx, cy]);
    } else if (o.op === "lineTo") {
      cx = o.data[0];
      cy = o.data[1];
      out.push([cx, cy]);
    } else if (o.op === "bcurveTo") {
      const [x1, y1, x2, y2, x, y] = o.data;
      for (let s = 1; s <= 10; s++) {
        const t = s / 10;
        const m = 1 - t;
        out.push([
          m * m * m * cx + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x,
          m * m * m * cy + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y,
        ]);
      }
      cx = x;
      cy = y;
    }
  }
  return out;
};

// One hand-drawn stroke: rough.js wobble, then perfect-freehand for the
// pressure-varying chalk body. Returned in pixel units (scale = bulb height).
const strokePath = (pts: Pt[], seed: number, scale: number, width: number, curve: boolean) => {
  const r = mulberry32(seed);
  const jitter = 0.006;
  const px = pts.map(([x, y]) => [
    (x + range(r, -jitter, jitter)) * scale,
    (y + range(r, -jitter, jitter)) * scale,
  ]) as Pt[];
  const opts = {
    seed: (seed % 2147483646) + 1,
    roughness: 0.9,
    bowing: 1.2,
    maxRandomnessOffset: scale * 0.006,
    disableMultiStroke: true,
    preserveVertices: false,
  };
  const d = curve
    ? gen.curve(px as [number, number][], opts)
    : gen.line(px[0][0], px[0][1], px[1][0], px[1][1], opts);
  const line = opsToPoints(d.sets[0].ops as { op: string; data: number[] }[]);
  const outline = getStroke(line, {
    size: width,
    thinning: 0.1,
    smoothing: 0.6,
    streamline: 0.35,
    simulatePressure: true,
    start: { taper: width * 0.7, cap: true },
    end: { taper: width * 0.7, cap: true },
  });
  // Ragged chalk edge: resample the outline densely and push each point in or
  // out a little, so the stroke edge breaks up without holes inside it.
  const p = new Path2D();
  const step = width * 0.22;
  let first = true;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / step));
    const nx = len > 0 ? -(y1 - y0) / len : 0;
    const ny = len > 0 ? (x1 - x0) / len : 0;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const j = width * (r() < 0.12 ? range(r, -0.16, -0.06) : range(r, -0.04, 0.04));
      const x = x0 + (x1 - x0) * t + nx * j;
      const y = y0 + (y1 - y0) * t + ny * j;
      if (first) p.moveTo(x, y);
      else p.lineTo(x, y);
      first = false;
    }
  }
  p.closePath();
  return p;
};

const rayPoints = (i: number, lengthFactor: number, v: number): Pt[] => {
  const r = mulberry32(hash(i, v, 31));
  const a = ((RAYS[i] + range(r, -3, 3)) * Math.PI) / 180;
  const r0 = RAY_IN + range(r, -0.01, 0.01);
  const r1 = r0 + RAY_LEN * lengthFactor * range(r, 0.92, 1.08);
  return [
    [GLASS_C[0] + Math.cos(a) * r0, GLASS_C[1] + Math.sin(a) * r0],
    [GLASS_C[0] + Math.cos(a) * r1, GLASS_C[1] + Math.sin(a) * r1],
  ];
};

type Body = { paths: Path2D[]; scale: number };
const bodyCache = new Map<string, Body>();
const getBody = (v: number, scale: number): Body => {
  const key = `${v}:${scale}`;
  const hit = bodyCache.get(key);
  if (hit) return hit;
  const w = scale * STROKE;
  const paths = [
    strokePath(GLASS, hash(v, 1), scale, w, true),
    strokePath(FILAMENT, hash(v, 2), scale, w * 0.92, true),
    ...BASE.map(([y, hw], i) =>
      strokePath([[-hw, y], [hw, y + 0.004]], hash(v, 10 + i), scale, w, false),
    ),
  ];
  const body = { paths, scale };
  bodyCache.set(key, body);
  return body;
};

// Chalk texture, one set per boil drawing so the grain boils with the line.
// - speck: opaque grey flecks painted onto the stroke (source-atop). Tiny holes
//   would show the green through and leave green specks after keying.
// The ragged chalk edge comes from the stroke outline itself (see strokePath).
type Grain = { speck: HTMLCanvasElement };
const grainCache = new Map<string, Grain>();
const TEX = 640; // texture size in composition units
const getGrain = (v: number, ratio: number): Grain => {
  const key = `${v}:${ratio}`;
  const hit = grainCache.get(key);
  if (hit) return hit;
  const side = Math.round(TEX * ratio);
  const r = mulberry32(hash(v, 4119751907));
  const grid = (cellUnits: number) => {
    const n = Math.ceil(TEX / cellUnits);
    const vals = new Float32Array(n * n);
    for (let i = 0; i < vals.length; i++) vals[i] = r();
    return { n, vals, cell: cellUnits * ratio };
  };
  const at = (gr: ReturnType<typeof grid>, x: number, y: number) =>
    gr.vals[(Math.floor(y / gr.cell) % gr.n) * gr.n + (Math.floor(x / gr.cell) % gr.n)];
  const fine = grid(4);
  const mid = grid(10);
  // Horizontal drag streaks, as chalk skips over the board.
  const streakRows = Math.ceil(TEX / 5);
  const streak = new Float32Array(streakRows);
  for (let i = 0; i < streakRows; i++) streak[i] = r();
  const paint = (fn: (x: number, y: number) => [number, number]) => {
    const c = makeCanvas(side, side);
    const g = c.getContext("2d")!;
    const img = g.createImageData(side, side);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const [grey, a] = fn(x, y);
        const o = (y * side + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = grey;
        img.data[o + 3] = a;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  };
  const speck = paint((x, y) => {
    const st = streak[Math.floor(y / (5 * ratio)) % streakRows];
    const n = at(fine, x, y) * 0.6 + at(mid, x, y) * 0.25 + st * 0.15;
    const a = n > 0.58 ? Math.min(1, (n - 0.58) * 3) : 0;
    return [205, Math.round(a * 150)];
  });
  const out = { speck };
  grainCache.set(key, out);
  return out;
};

let layer: HTMLCanvasElement | null = null;

export const IdeaBulb: React.FC<{ extraFrames?: number }> = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const { width: W, height: H, frame, pxRatio } = info;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const v = Math.floor(f / HOLD) % VARIANTS;
    const scale = IDEA_BULB.height * H;
    const body = getBody(v, scale);

    // Ray flicker: each 15-frame slot, 1-2 different rays dip and recover.
    const slot = Math.floor(f / FLICKER_EVERY);
    const local = f - slot * FLICKER_EVERY;
    const fr = mulberry32(hash(slot, 515));
    const first = Math.floor(fr() * RAYS.length);
    const flick = new Set<number>([first]);
    if (fr() < 0.5) flick.add((first + 2 + Math.floor(fr() * 4)) % RAYS.length);
    const dip = local < 1 ? 0.5 : local < 6 ? 1 : local < 9 ? 1 - (local - 5) / 4 : 0;

    const bw = Math.round(W * pxRatio);
    const bh = Math.round(H * pxRatio);
    if (!layer || layer.width !== bw || layer.height !== bh) layer = makeCanvas(bw, bh);
    const l = layer.getContext("2d")!;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, bw, bh);
    l.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
    // Centre the whole drawing (rays included) in the frame.
    l.translate(W / 2, H / 2 + scale * 0.06);
    l.fillStyle = IDEA_BULB.color;
    body.paths.forEach((p) => l.fill(p));
    RAYS.forEach((_, i) => {
      const k = flick.has(i) ? 1 - 0.45 * dip : 1;
      l.fill(strokePath(rayPoints(i, k, v), hash(v, 40 + i), scale, scale * STROKE, false));
    });

    // Texture the strokes only (the layer is transparent elsewhere).
    const grain = getGrain(v, pxRatio);
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = "source-atop";
    l.fillStyle = l.createPattern(grain.speck, "repeat")!;
    l.fillRect(0, 0, bw, bh);
    l.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }, []);
  return <CanvasStage background={GREEN} draw={draw} />;
};
