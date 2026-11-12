// Tiny Lottie (Bodymovin) builder used to author the Sea ABC character loops.
// Everything is plain data so the JSON stays deterministic and diffable.

export const hex = (h, a = 1) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

// Easing anchors (cubic-bezier x1,y1,x2,y2) — see text-to-lottie motion-taste.md
export const E = {
  inOut: [0.45, 0, 0.55, 1], // sine-like travel
  out: [0.2, 0.75, 0.34, 0.94], // entrance-sharp
  soft: [0.0, 0.65, 0.51, 0.99], // settle-soft
  in: [0.6, 0.02, 0.9, 0.5], // accelerate (anticipation release / fall)
  snap: [0.1, 0.9, 0.2, 1], // very fast out
  hold: null, // step
};

const arr = (v) => (Array.isArray(v) ? v : [v]);

/**
 * Animated property from keys: [[t, value, ease?], ...]
 * ease applies to the segment leaving this key. Single key => static.
 */
export const anim = (keys) => {
  if (!Array.isArray(keys[0])) return { a: 0, k: keys };
  if (keys.length === 1) return { a: 0, k: keys[0][1] };
  const k = keys.map(([t, v, ease], idx) => {
    const isLast = idx === keys.length - 1;
    const s = typeof v === 'object' && !Array.isArray(v) ? [v] : arr(v);
    if (isLast) return { t, s };
    const e = ease === undefined ? E.inOut : ease;
    const dims = s.length && typeof s[0] === 'number' ? s.length : 1;
    if (e === null) return { t, s, h: 1 };
    return {
      t,
      s,
      o: { x: Array(dims).fill(e[0]), y: Array(dims).fill(e[1]) },
      i: { x: Array(dims).fill(e[2]), y: Array(dims).fill(e[3]) },
    };
  });
  return { a: 1, k };
};

export const st = (v) => ({ a: 0, k: v });

// ---------- shapes ----------
export const ellipse = (w, h, x = 0, y = 0) => ({
  ty: 'el',
  d: 1,
  s: st([w, h]),
  p: st([x, y]),
});
export const rect = (w, h, x = 0, y = 0, r = 0) => ({
  ty: 'rc',
  d: 1,
  s: st([w, h]),
  p: st([x, y]),
  r: st(r),
});
/** path from a {v,i,o,c} object or animated keys of such objects */
export const path = (p) => ({
  ty: 'sh',
  d: 1,
  ks: Array.isArray(p) ? anim(p) : st(p),
});
export const fill = (color, opacity = 100) => ({
  ty: 'fl',
  c: st(hex(color)),
  o: Array.isArray(opacity) ? anim(opacity) : st(opacity),
  r: 1,
});
export const stroke = (color, w = 3, opacity = 100) => ({
  ty: 'st',
  c: st(hex(color)),
  o: Array.isArray(opacity) ? anim(opacity) : st(opacity),
  w: st(w),
  lc: 2,
  lj: 2,
  ml: 4,
});

const tprop = (v, def) => {
  if (v === undefined) return st(def);
  if (Array.isArray(v) && Array.isArray(v[0])) return anim(v);
  return st(v);
};

export const transform = ({ p, a, s, r, o } = {}) => ({
  ty: 'tr',
  p: tprop(p, [0, 0]),
  a: tprop(a, [0, 0]),
  s: tprop(s, [100, 100]),
  r: tprop(r, 0),
  o: tprop(o, 100),
  sk: st(0),
  sa: st(0),
});

export const group = (nm, items, tr = {}) => ({
  ty: 'gr',
  nm,
  it: [...items, transform(tr)],
});

// ---------- layers ----------
let IND = 0;
export const resetInd = () => {
  IND = 0;
};
const layerKs = ({ p, a, s, r, o } = {}) => ({
  o: tprop(o, 100),
  r: tprop(r, 0),
  p: tprop(p, [0, 0, 0]),
  a: tprop(a, [0, 0, 0]),
  s: tprop(s, [100, 100, 100]),
});

export const shapeLayer = (nm, shapes, ks = {}, extra = {}) => ({
  ddd: 0,
  ind: ++IND,
  ty: 4,
  nm,
  sr: 1,
  ks: layerKs(ks),
  ao: 0,
  shapes,
  ip: 0,
  op: 99999,
  st: 0,
  bm: 0,
  ...extra,
});

export const nullLayer = (nm, ks = {}, extra = {}) => ({
  ddd: 0,
  ind: ++IND,
  ty: 3,
  nm,
  sr: 1,
  ks: layerKs(ks),
  ao: 0,
  ip: 0,
  op: 99999,
  st: 0,
  bm: 0,
  ...extra,
});

/** Lottie draws layers[0] on top. Pass layers bottom->top, we reverse. */
export const comp = ({ nm, w, h, fr = 30, op, layers }) => ({
  v: '5.7.4',
  fr,
  ip: 0,
  op,
  w,
  h,
  nm,
  ddd: 0,
  assets: [],
  layers: layers
    .map((l) => ({ ...l, op }))
    .reverse(),
});

// ---------- geometry helpers ----------
/**
 * Smooth closed (or open) bezier through points via Catmull-Rom.
 * Returns Lottie path object {c, v, i, o} with relative tangents.
 */
export const smooth = (pts, closed = true, tension = 1) => {
  const n = pts.length;
  const v = [];
  const ii = [];
  const oo = [];
  for (let k = 0; k < n; k++) {
    const prev = pts[(k - 1 + n) % n];
    const next = pts[(k + 1) % n];
    const p = pts[k];
    let tx = ((next[0] - prev[0]) / 6) * tension;
    let ty = ((next[1] - prev[1]) / 6) * tension;
    if (!closed && (k === 0 || k === n - 1)) {
      tx = 0;
      ty = 0;
    }
    v.push([p[0], p[1]]);
    ii.push([-tx, -ty]);
    oo.push([tx, ty]);
  }
  return { c: closed, v, i: ii, o: oo };
};

/** Polygon (sharp corners). */
export const poly = (pts, closed = true) => ({
  c: closed,
  v: pts.map((p) => [p[0], p[1]]),
  i: pts.map(() => [0, 0]),
  o: pts.map(() => [0, 0]),
});

/** Mix helper for keyframe lists: repeat a cycle */
export const cycle = (start, end, period, values, ease = E.inOut) => {
  const keys = [];
  let idx = 0;
  for (let t = start; t <= end; t += period / (values.length - 1 || 1)) {
    keys.push([Math.round(t * 100) / 100, values[idx % (values.length - 1 || 1)], ease]);
    idx++;
  }
  return keys;
};
