// Paint the city once into a large tileable canvas, in one look's palette.
// The canvas becomes a mipmapped, anisotropic, repeat-wrapped texture; it is
// never redrawn per frame.

import { mulberry32 } from "../lib/random";
import { City, V2 } from "./generate";

export interface CityStyle {
  size: number; // texture size in px (8192)
  ground: string;
  // road widths (texture px) and colours: local, avenue, arterial
  widths: [number, number, number];
  colors: [string, string, string];
  alphas?: [number, number, number];
  water: string;
  park: string;
  lot: string;
  rail?: string;
  buildings?: { shades: string[] };
  noise?: { fine: number; coarse: number };
  labels?: { color: string; alpha: number; angle?: number };
  // soft halo under avenues/arterials (emissive looks)
  halo?: { color: string; width: number; alpha: number };
}

type Ctx = CanvasRenderingContext2D;

// Draw `fn` at every wrap offset whose copy can touch the tile.
const wrapped = (ctx: Ctx, W: number, scale: number, fn: () => void) => {
  for (const ox of [-W, 0, W]) {
    for (const oy of [-W, 0, W]) {
      ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
      fn();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

// Normalise a polyline so its first point lies inside the tile.
const norm = (pts: V2[], W: number) => {
  const ox = Math.floor(pts[0].x / W) * W;
  const oy = Math.floor(pts[0].y / W) * W;
  return ox === 0 && oy === 0 ? pts : pts.map((p) => ({ x: p.x - ox, y: p.y - oy }));
};

const polyPath = (polys: V2[][], W: number, closed: boolean) => {
  const path = new Path2D();
  for (const raw of polys) {
    const pts = norm(raw, W);
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    if (closed) path.closePath();
  }
  return path;
};

// Tileable noise overlay (Look 1 "imagery" feel).
const noiseTile = (n: number, seed: number, amount: number, blur: number) => {
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const rng = mulberry32(seed);
  for (let i = 0; i < n * n; i++) {
    const g = rng() < 0.5 ? 0 : 255;
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = Math.round(255 * amount * rng());
  }
  ctx.putImageData(img, 0, 0);
  if (blur > 0) {
    // blur in a tile-safe way: draw 3x3 copies, blur, crop the centre
    const big = document.createElement("canvas");
    big.width = n * 3;
    big.height = n * 3;
    const b = big.getContext("2d")!;
    b.filter = `blur(${blur}px)`;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) b.drawImage(c, x * n, y * n);
    ctx.clearRect(0, 0, n, n);
    ctx.drawImage(big, n, n, n, n, 0, 0, n, n);
  }
  return c;
};

export const drawCity = (city: City, style: CityStyle): HTMLCanvasElement => {
  const { W } = city;
  const S = style.size;
  const scale = S / W;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = style.ground;
  ctx.fillRect(0, 0, S, S);

  // buildings
  if (style.buildings) {
    const shades = style.buildings.shades;
    const buckets: V2[][][] = shades.map(() => []);
    for (const b of city.buildings) buckets[Math.min(shades.length - 1, Math.floor(b.shade * shades.length))].push(b.pts);
    buckets.forEach((polys, i) => {
      const path = polyPath(polys, W, true);
      ctx.fillStyle = shades[i];
      wrapped(ctx, W, scale, () => ctx.fill(path));
    });
  }

  const roadPaths = [0, 1, 2].map((c) =>
    polyPath(
      city.edges.filter((e) => e.cls === c).map((e) => e.pts),
      W,
      false,
    ),
  );
  const strokeRoads = (cls: number) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = style.colors[cls];
    ctx.globalAlpha = style.alphas ? style.alphas[cls] : 1;
    ctx.lineWidth = style.widths[cls] / scale;
    wrapped(ctx, W, scale, () => ctx.stroke(roadPaths[cls]));
    ctx.globalAlpha = 1;
  };

  // halos under major roads (drawn first so lines sit on top)
  if (style.halo) {
    // layered wide, faint strokes approximate a soft glow without a blur pass
    ctx.save();
    ctx.strokeStyle = style.halo.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const k of [1, 0.66, 0.4]) {
      ctx.globalAlpha = style.halo.alpha * 0.4;
      ctx.lineWidth = (style.halo.width * k) / scale;
      wrapped(ctx, W, scale, () => {
        ctx.stroke(roadPaths[1]);
        ctx.stroke(roadPaths[2]);
      });
    }
    ctx.restore();
  }

  strokeRoads(0);

  // parks, lots, water: dark fills that interrupt local streets
  const parkPath = polyPath(city.parks, W, true);
  const lotPath = polyPath(city.lots, W, true);
  ctx.fillStyle = style.park;
  wrapped(ctx, W, scale, () => ctx.fill(parkPath));
  ctx.fillStyle = style.lot;
  wrapped(ctx, W, scale, () => ctx.fill(lotPath));
  if (style.rail) {
    const railPath = polyPath(city.rails, W, false);
    ctx.strokeStyle = style.rail;
    ctx.lineWidth = Math.max(1.2, style.widths[0] * 0.35) / scale;
    wrapped(ctx, W, scale, () => ctx.stroke(railPath));
  }

  strokeRoads(1);

  const waterPath = polyPath(city.water, W, true);
  ctx.fillStyle = style.water;
  wrapped(ctx, W, scale, () => ctx.fill(waterPath));

  // arterials last: they bridge the water
  strokeRoads(2);

  // little dashed text-like labels
  if (style.labels) {
    ctx.fillStyle = style.labels.color;
    ctx.globalAlpha = style.labels.alpha;
    const lr = mulberry32(city.seed + 5);
    const path = new Path2D();
    for (const l of city.labels) {
      const ang = style.labels.angle ?? l.angle;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      let x = -l.n * 9;
      for (let k = 0; k < l.n; k++) {
        const w = 6 + lr() * 12;
        const px = l.p.x + c * x;
        const py = l.p.y + s * x;
        const h = 3.2;
        path.moveTo(px - s * h, py + c * h);
        path.lineTo(px + c * w - s * h, py + s * w + c * h);
        path.lineTo(px + c * w + s * h, py + s * w - c * h);
        path.lineTo(px + s * h, py - c * h);
        path.closePath();
        x += w + 4.5;
      }
    }
    wrapped(ctx, W, scale, () => ctx.fill(path));
    ctx.globalAlpha = 1;
  }

  // imagery-like noise
  if (style.noise) {
    ctx.save();
    const coarse = noiseTile(256, city.seed + 1, style.noise.coarse, 4);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = "soft-light";
    ctx.drawImage(coarse, 0, 0, S, S);
    const fine = noiseTile(2048, city.seed + 2, style.noise.fine, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fine, 0, 0, S, S);
    ctx.restore();
  }
  return canvas;
};
