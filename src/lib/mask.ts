import {DESIGN_TO_MASK, MASK_H, MASK_W} from './space';

/** A stroked contribution to a shape: `d` is a path, `w` a design-space width. */
export type StrokeSpec = {d: string; w: number};

/**
 * A silhouette is a filled path (subpaths union under the nonzero rule) plus an
 * optional set of stroked paths. Strokes make limb-like forms — fingers, a
 * wrist — trivial to author without hand-building an outline around them.
 */
export type Silhouette = {fill: string; strokes: StrokeSpec[]};

export type MaskField = {
  w: number;
  h: number;
  /** 1 inside the silhouette, 0 outside. */
  inside: Uint8Array;
  /** Distance in mask pixels from each inside pixel to the nearest outside pixel. */
  edge: Float32Array;
  /** Distance in mask pixels from each pixel to the nearest crease pixel. */
  crease: Float32Array;
  /** Inclusive x bounds of the horizontal run of inside pixels containing each pixel. */
  rowA: Int16Array;
  rowB: Int16Array;
  /** Inclusive y bounds of the vertical run of inside pixels containing each pixel. */
  colA: Int16Array;
  colB: Int16Array;
  /** Horizontal runs of inside pixels, per row. */
  runs: Int16Array[];
  /** Bounding box of the silhouette, in mask pixels. */
  bbox: {x0: number; y0: number; x1: number; y1: number};
  /** Count of inside pixels. */
  area: number;
};

const rasterise = (
  fill: string,
  strokes: StrokeSpec[],
  w: number,
  h: number,
): Uint8Array => {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('2d context unavailable while rasterising a mask');

  ctx.save();
  ctx.scale(DESIGN_TO_MASK * (w / MASK_W), DESIGN_TO_MASK * (h / MASK_H));
  ctx.fillStyle = 'rgb(255,255,255)';
  ctx.strokeStyle = 'rgb(255,255,255)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (fill.trim().length > 0) {
    ctx.fill(new Path2D(fill), 'nonzero');
  }
  for (const s of strokes) {
    ctx.lineWidth = s.w;
    ctx.stroke(new Path2D(s.d));
  }
  ctx.restore();

  const data = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  }
  return out;
};

/**
 * Two-pass 3-4 chamfer distance transform. Pixels outside the image are treated
 * as "unknown" rather than as background, so a form running off the frame edge
 * does not grow a bright rim along that edge.
 */
const distanceTransform = (
  seed: Uint8Array,
  w: number,
  h: number,
): Float32Array => {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? INF : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (y > 0) {
        if (d[i - w] + 3 < m) m = d[i - w] + 3;
        if (x > 0 && d[i - w - 1] + 4 < m) m = d[i - w - 1] + 4;
        if (x < w - 1 && d[i - w + 1] + 4 < m) m = d[i - w + 1] + 4;
      }
      if (x > 0 && d[i - 1] + 3 < m) m = d[i - 1] + 3;
      d[i] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (y < h - 1) {
        if (d[i + w] + 3 < m) m = d[i + w] + 3;
        if (x < w - 1 && d[i + w + 1] + 4 < m) m = d[i + w + 1] + 4;
        if (x > 0 && d[i + w - 1] + 4 < m) m = d[i + w - 1] + 4;
      }
      if (x < w - 1 && d[i + 1] + 3 < m) m = d[i + 1] + 3;
      d[i] = m;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.min(d[i], INF) / 3;
  return d;
};

export const buildMaskField = (
  silhouette: Silhouette,
  creases: StrokeSpec[],
): MaskField => {
  const w = MASK_W;
  const h = MASK_H;
  const inside = rasterise(silhouette.fill, silhouette.strokes, w, h);

  const edge = distanceTransform(inside, w, h);

  // Crease field: 1 where a crease stroke lies, then distance-transformed so
  // density can fall off smoothly away from it.
  const creaseHit = rasterise('', creases, w, h);
  const creaseInv = new Uint8Array(w * h);
  for (let i = 0; i < creaseInv.length; i++) creaseInv[i] = creaseHit[i] ? 0 : 1;
  const crease = distanceTransform(creaseInv, w, h);

  const rowA = new Int16Array(w * h);
  const rowB = new Int16Array(w * h);
  const colA = new Int16Array(w * h);
  const colB = new Int16Array(w * h);
  const runs: Int16Array[] = [];

  let area = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < h; y++) {
    const bounds: number[] = [];
    let x = 0;
    while (x < w) {
      if (!inside[y * w + x]) {
        x++;
        continue;
      }
      const a = x;
      while (x < w && inside[y * w + x]) x++;
      const b = x - 1;
      bounds.push(a, b);
      for (let k = a; k <= b; k++) {
        rowA[y * w + k] = a;
        rowB[y * w + k] = b;
      }
      area += b - a + 1;
      if (a < x0) x0 = a;
      if (b > x1) x1 = b;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    runs.push(Int16Array.from(bounds));
  }

  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!inside[y * w + x]) {
        y++;
        continue;
      }
      const a = y;
      while (y < h && inside[y * w + x]) y++;
      const b = y - 1;
      for (let k = a; k <= b; k++) {
        colA[k * w + x] = a;
        colB[k * w + x] = b;
      }
    }
  }

  return {
    w,
    h,
    inside,
    edge,
    crease,
    rowA,
    rowB,
    colA,
    colB,
    runs,
    bbox: {x0, y0, x1, y1},
    area,
  };
};
