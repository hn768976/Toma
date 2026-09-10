#!/usr/bin/env node
// Trace a flat-colour PNG (transparent background) into a monochrome SVG
// the template can use. Not a general vectoriser — it targets emoji/icon
// style artwork with a base colour plus accent lines:
//
//   • every opaque region        -> filled silhouette path(s)
//   • accent-colour THIN lines   -> skeletonised to stroke centre-lines
//   • accent-colour THICK blobs  -> extra filled paths (drawn over the silhouette)
//
//   node scripts/trace-bitmap.mjs input.png assets/subjects/name.svg [--line-max 60] [--min-spur 20]
//
// The result is a normal monochrome SVG: review it, tidy by hand if needed,
// then add a row to src/subjects/subjects.json.

import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
if (positional.length < 2) {
  console.error("usage: node scripts/trace-bitmap.mjs <input.png> <output.svg> [--line-max px] [--min-spur px]");
  process.exit(1);
}
const [input, output] = positional;
const LINE_MAX = opt("line-max", 60); // accent regions thinner than this become strokes
const MIN_SPUR = opt("min-spur", 20); // skeleton branches shorter than this are dropped
const SIMPLIFY = opt("simplify", 1.6);

const png = PNG.sync.read(readFileSync(input));
const { width: W, height: H, data } = png;
const N = W * H;
const idx = (x, y) => y * W + x;

// ---------------------------------------------------------------- masks
const fg = new Uint8Array(N);
const colourKey = new Int32Array(N);
const counts = new Map();
for (let i = 0; i < N; i++) {
  const a = data[i * 4 + 3];
  if (a < 128) continue;
  fg[i] = 1;
  const r = data[i * 4] >> 4, g = data[i * 4 + 1] >> 4, b = data[i * 4 + 2] >> 4;
  const k = (r << 8) | (g << 4) | b;
  colourKey[i] = k;
  counts.set(k, (counts.get(k) ?? 0) + 1);
}
if (counts.size === 0) {
  console.error("✖ image is fully transparent");
  process.exit(1);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const baseKey = sorted[0][0];
// Accent = any opaque pixel whose colour is far from the base colour.
const dist = (k1, k2) => {
  const r = (k1 >> 8) - (k2 >> 8), g = ((k1 >> 4) & 15) - ((k2 >> 4) & 15), b = (k1 & 15) - (k2 & 15);
  return Math.sqrt(r * r + g * g + b * b);
};
const accent = new Uint8Array(N);
let accentCount = 0;
for (let i = 0; i < N; i++) if (fg[i] && dist(colourKey[i], baseKey) > 3) (accent[i] = 1), accentCount++;
console.log(`image ${W}x${H}, ${sorted.length} colours, base colour covers ${sorted[0][1]} px, accent ${accentCount} px`);

// --------------------------------------------- chamfer distance transform
const distanceTransform = (mask) => {
  const d = new Float32Array(N).fill(1e9);
  for (let i = 0; i < N; i++) if (!mask[i]) d[i] = 0;
  const SQ2 = Math.SQRT2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (d[i] === 0) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + 1);
      if (y > 0) {
        m = Math.min(m, d[i - W] + 1);
        if (x > 0) m = Math.min(m, d[i - W - 1] + SQ2);
        if (x < W - 1) m = Math.min(m, d[i - W + 1] + SQ2);
      }
      d[i] = m;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = idx(x, y);
      if (d[i] === 0) continue;
      let m = d[i];
      if (x < W - 1) m = Math.min(m, d[i + 1] + 1);
      if (y < H - 1) {
        m = Math.min(m, d[i + W] + 1);
        if (x < W - 1) m = Math.min(m, d[i + W + 1] + SQ2);
        if (x > 0) m = Math.min(m, d[i + W - 1] + SQ2);
      }
      d[i] = m;
    }
  return d;
};

// Split accent pixels into thin lines vs thick blobs by local thickness.
const accentDist = distanceTransform(accent);
const core = new Uint8Array(N); // deep inside a thick blob
for (let i = 0; i < N; i++) if (accent[i] && accentDist[i] > LINE_MAX / 2) core[i] = 1;
const notCore = new Uint8Array(N);
for (let i = 0; i < N; i++) notCore[i] = core[i] ? 0 : 1;
const coreDist = distanceTransform(notCore); // distance to nearest core pixel
const blob = new Uint8Array(N), line = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (!accent[i]) continue;
  if (coreDist[i] <= LINE_MAX / 2 + 2) blob[i] = 1;
  else line[i] = 1;
}

// ------------------------------------------------ connected components
const components = (mask, minSize) => {
  const label = new Int32Array(N).fill(-1);
  const comps = [];
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = comps.length;
    const pixels = [];
    stack.push(s);
    label[s] = id;
    while (stack.length) {
      const i = stack.pop();
      pixels.push(i);
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = idx(nx, ny);
          if (mask[j] && label[j] < 0) {
            label[j] = id;
            stack.push(j);
          }
        }
    }
    comps.push(pixels);
  }
  return comps.filter((c) => c.length >= minSize);
};

// ------------------------------------------- Moore-neighbour contour trace
const traceContour = (mask, pixels) => {
  let start = pixels[0];
  for (const p of pixels) if (p < start) start = p; // topmost-leftmost
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[idx(x, y)] === 1;
  const sx = start % W, sy = (start / W) | 0;
  // 8 directions clockwise starting from west
  const DIRS = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const contour = [[sx, sy]];
  let cx = sx, cy = sy;
  let backtrack = 0; // came from the west
  let guard = 0;
  do {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (backtrack + k) % 8;
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (inside(nx, ny)) {
        contour.push([nx, ny]);
        // new backtrack: direction pointing to the previous (non-inside) cell
        backtrack = (d + 5) % 8;
        cx = nx;
        cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break; // isolated pixel
    guard++;
  } while ((cx !== sx || cy !== sy) && guard < N);
  return contour;
};

// ----------------------------------------------------- Douglas-Peucker
const simplify = (pts, eps) => {
  if (pts.length < 3) return pts;
  const sqSegDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) (x = b[0]), (y = b[1]);
      else if (t > 0) (x += dx * t), (y += dy * t);
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const d = sqSegDist(pts[i], pts[a], pts[b]);
      if (d > maxD) (maxD = d), (maxI = i);
    }
    if (maxD > eps * eps && maxI >= 0) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

// --------------------------------------------------- Catmull-Rom -> path
const f = (n) => Math.round(n * 10) / 10;
const smoothPath = (pts, closed) => {
  const n = pts.length;
  if (n < 2) return "";
  const get = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
};

// ------------------------------------------------- Zhang-Suen thinning
const thin = (mask) => {
  const img = Uint8Array.from(mask);
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : img[idx(x, y)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const remove = [];
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          if (!img[idx(x, y)]) continue;
          const p2 = get(x, y - 1), p3 = get(x + 1, y - 1), p4 = get(x + 1, y), p5 = get(x + 1, y + 1);
          const p6 = get(x, y + 1), p7 = get(x - 1, y + 1), p8 = get(x - 1, y), p9 = get(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) A++;
          if (A !== 1) continue;
          if (step === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          remove.push(idx(x, y));
        }
      if (remove.length) changed = true;
      for (const i of remove) img[i] = 0;
    }
  }
  return img;
};

// Walk a skeleton into polylines, splitting at junctions. Branch count is
// the number of 0->1 transitions around the 8-neighbour ring, which (unlike
// a raw neighbour count) is not fooled by diagonal staircases.
const skeletonToPolylines = (skel) => {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : skel[idx(x, y)]);
  const branches = (i) => {
    const x = i % W, y = (i / W) | 0;
    const ring = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1), at(x, y - 1)];
    let a = 0;
    for (let k = 0; k < 8; k++) if (ring[k] === 0 && ring[k + 1] === 1) a++;
    return a;
  };
  // Orthogonal neighbours first so staircases are walked cleanly.
  const ORDER = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  const nbrs = (i) => {
    const x = i % W, y = (i / W) | 0;
    const out = [];
    for (const [dx, dy] of ORDER) if (at(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
    return out;
  };
  const deg = new Uint8Array(N);
  const nodes = [];
  for (let i = 0; i < N; i++) if (skel[i]) {
    deg[i] = branches(i);
    if (deg[i] !== 2) nodes.push(i);
  }
  const visited = new Uint8Array(N);
  const lines = [];
  const walk = (start, first) => {
    const pts = [start, first];
    if (deg[first] === 2) visited[first] = 1;
    let cur = first;
    let steps = 0;
    while (deg[cur] === 2 && steps++ < N) {
      const cand = nbrs(cur).filter((j) => !visited[j] && j !== start && !pts.includes(j));
      const next = cand.find((j) => deg[j] !== 2) ?? cand[0];
      if (next === undefined) break;
      pts.push(next);
      if (deg[next] === 2) visited[next] = 1;
      cur = next;
    }
    return pts;
  };
  const usedEdge = new Set();
  const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (const n of nodes) {
    for (const j of nbrs(n)) {
      if (usedEdge.has(edgeKey(n, j)) || (deg[j] === 2 && visited[j])) continue;
      const pts = walk(n, j);
      for (let k = 0; k + 1 < pts.length; k++) usedEdge.add(edgeKey(pts[k], pts[k + 1]));
      if (pts.length >= 2) lines.push({ pts, extStart: deg[pts[0]] === 1, extEnd: deg[pts[pts.length - 1]] === 1 });
    }
  }
  for (let i = 0; i < N; i++) {
    if (skel[i] && !visited[i] && deg[i] === 2) {
      visited[i] = 1;
      const pts = walk(i, nbrs(i)[0]);
      lines.push({ pts, extStart: false, extEnd: false });
    }
  }
  return lines.map((l) => ({ ...l, pts: l.pts.map((i) => [i % W, (i / W) | 0]) }));
};

// Thinning eats roughly one stroke radius off every line end; push the
// ends back out along the local tangent.
const extendEnds = (pts, amount, extStart = true, extEnd = true) => {
  if (pts.length < 2 || amount <= 0) return pts;
  const tangent = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const k = Math.min(8, pts.length - 1);
  const t0 = tangent(pts[k], pts[0]);
  const t1 = tangent(pts[pts.length - 1 - k], pts[pts.length - 1]);
  return [
    ...(extStart ? [[pts[0][0] + t0[0] * amount, pts[0][1] + t0[1] * amount]] : []),
    ...pts,
    ...(extEnd ? [[pts[pts.length - 1][0] + t1[0] * amount, pts[pts.length - 1][1] + t1[1] * amount]] : []),
  ];
};

// ------------------------------------------------------------- build
const silhouetteComps = components(fg, 200);
const silhouettePaths = silhouetteComps.map((c) => smoothPath(simplify(traceContour(fg, c), SIMPLIFY), true));

const blobComps = components(blob, 400);
const blobPaths = blobComps.map((c) => smoothPath(simplify(traceContour(blob, c), SIMPLIFY), true));

const skel = thin(line);
let polylines = skeletonToPolylines(skel);
const length = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};
polylines = polylines.filter((p) => length(p.pts) >= MIN_SPUR);
// Stroke width: twice the median distance-to-edge along the skeleton.
const radii = [];
for (let i = 0; i < N; i++) if (skel[i]) radii.push(accentDist[i]);
radii.sort((a, b) => a - b);
const strokeWidth = radii.length ? Math.round(2 * radii[Math.floor(radii.length / 2)]) : 0;
const linePaths = polylines
  .map((p) => smoothPath(extendEnds(simplify(p.pts, SIMPLIFY * 1.5), Math.max(0, strokeWidth / 2 - 3), p.extStart, p.extEnd), false))
  .filter(Boolean);

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`,
  `  <!-- traced from ${input.split("/").pop()} by scripts/trace-bitmap.mjs -->`,
  `  <g fill="#000">`,
  ...silhouettePaths.map((d) => `    <path d="${d}"/>`),
  `  </g>`,
  ...(blobPaths.length ? [`  <g fill="#000">`, ...blobPaths.map((d) => `    <path d="${d}"/>`), `  </g>`] : []),
  ...(linePaths.length
    ? [`  <g fill="none" stroke="#000" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`, ...linePaths.map((d) => `    <path d="${d}"/>`), `  </g>`]
    : []),
  `</svg>`,
  "",
].join("\n");
writeFileSync(output, svg);
console.log(`✔ ${output}: ${silhouettePaths.length} silhouette path(s), ${blobPaths.length} accent blob(s), ${linePaths.length} accent line(s) @ stroke-width ${strokeWidth}`);
