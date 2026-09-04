/**
 * Traces the black-on-white tree PNGs in public/trees/ into SVG outlines.
 *
 * Why bother: the near-tier instances are drawn at roughly the source PNG's own
 * resolution when rendering at 4K, so those assets are already at their ceiling
 * — anything larger softens. Outlines have no ceiling. They are also about a
 * tenth of the size, and they let the runtime skip luminance keying entirely,
 * since an SVG can carry its own alpha.
 *
 * Dependency-free on purpose. Tracing is a one-time asset step, not something
 * the render needs, so it decodes via the ffmpeg that Remotion already ships
 * and does the vectorising here rather than pulling potrace into the project.
 *
 * Usage: node tools/trace-trees.mjs [--threshold 0.53] [--epsilon 0.4]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const treeDir = join(here, "..", "public", "trees");
const FFMPEG = join(here, "..", "node_modules", "@remotion", "compositor-linux-x64-gnu", "ffmpeg");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

/**
 * Luminance below this counts as ink. It matches the midpoint of the soft ramp
 * the runtime keyer used on the PNGs, so the traced silhouette lands in the
 * same place the keyed mask did rather than fattening or thinning the twigs.
 */
const THRESHOLD = arg("threshold", 0.53);
/** Douglas-Peucker tolerance in source pixels. */
const EPSILON = arg("epsilon", 0.4);
/** Drop loops enclosing less than this many square pixels — dust, not twigs. */
const MIN_AREA = 1.5;

// --- decode ---------------------------------------------------------------

const decodeGray = (file) => {
  const probe = JSON.parse(
    execFileSync(FFMPEG.replace(/ffmpeg$/, "ffprobe"), [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "json", file,
    ]).toString(),
  ).streams[0];
  const { width, height } = probe;
  const raw = execFileSync(
    FFMPEG,
    ["-v", "error", "-i", file, "-c:v", "rawvideo", "-pix_fmt", "gray",
     "-f", "image2pipe", "-"],
    { maxBuffer: 1 << 30 },
  );
  if (raw.length < width * height) throw new Error(`Short decode of ${file}`);
  return { width, height, gray: raw.subarray(0, width * height) };
};

// --- marching squares -----------------------------------------------------

/**
 * Emits the boundary between ink and paper as closed loops.
 *
 * Contour vertices are placed by linear interpolation between the grey values
 * either side of each cell edge, not at the edge midpoint. That matters: the
 * source artwork is antialiased, so the exact edge position is encoded in the
 * partially-covered pixels, and snapping to midpoints throws it away and leaves
 * 45-degree staircases that are plainly visible once the mask is scaled up —
 * which would defeat the whole point of vectorising.
 *
 * Samples sit at pixel centres, with a one-pixel border of paper padded around
 * the image so every loop closes even where artwork touches the edge. The two
 * ambiguous configurations (5 and 10) are resolved the way that keeps ink
 * connected diagonally — the alternative snips single-pixel twigs into dashes.
 *
 * Edges are identified by their grid position rather than by the coordinates of
 * the point on them, so the two cells sharing an edge always agree on it
 * exactly and loops link without floating-point tolerance games.
 */
const traceLoops = (width, height, gray) => {
  const cut = THRESHOLD * 255;
  // Positive means ink. Outside the image is paper.
  const f = (x, y) =>
    x < 0 || y < 0 || x >= width || y >= height ? cut - 255 : cut - gray[y * width + x];

  const stride = width + 2;
  const hId = (x, y) => ((y + 1) * stride + (x + 1)) * 2;
  const vId = (x, y) => ((y + 1) * stride + (x + 1)) * 2 + 1;
  const pos = new Map();

  /** Where the contour crosses the horizontal edge from (x,y) to (x+1,y). */
  const hCross = (x, y) => {
    const id = hId(x, y);
    if (!pos.has(id)) {
      const a = f(x, y);
      const b = f(x + 1, y);
      const t = a === b ? 0.5 : Math.min(1, Math.max(0, a / (a - b)));
      pos.set(id, [x + t, y]);
    }
    return id;
  };

  /** Where the contour crosses the vertical edge from (x,y) to (x,y+1). */
  const vCross = (x, y) => {
    const id = vId(x, y);
    if (!pos.has(id)) {
      const a = f(x, y);
      const b = f(x, y + 1);
      const t = a === b ? 0.5 : Math.min(1, Math.max(0, a / (a - b)));
      pos.set(id, [x, y + t]);
    }
    return id;
  };

  const links = new Map();
  const link = (a, b) => {
    for (const [from, to] of [[a, b], [b, a]]) {
      const cur = links.get(from);
      if (cur === undefined) links.set(from, [to, -1]);
      else if (cur[1] === -1) cur[1] = to;
    }
  };

  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      const tl = f(x, y) > 0;
      const tr = f(x + 1, y) > 0;
      const br = f(x + 1, y + 1) > 0;
      const bl = f(x, y + 1) > 0;
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const T = () => hCross(x, y);
      const B = () => hCross(x, y + 1);
      const L = () => vCross(x, y);
      const R = () => vCross(x + 1, y);

      switch (code) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(T(), R()); break;
        case 6: case 9:  link(T(), B()); break;
        case 7: case 8:  link(T(), L()); break;
        case 5:          link(T(), L()); link(B(), R()); break; // keep ink joined
        case 10:         link(T(), R()); link(L(), B()); break; // keep ink joined
      }
    }
  }

  // Walk the adjacency into closed loops.
  const loops = [];
  const seen = new Set();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let cur = start;
    let prev = -1;
    while (cur !== -1 && !seen.has(cur)) {
      seen.add(cur);
      loop.push(pos.get(cur));
      const [a, b] = links.get(cur);
      const next = a !== prev && a !== -1 && !seen.has(a) ? a
                 : b !== prev && b !== -1 && !seen.has(b) ? b
                 : -1;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
};

// --- simplify -------------------------------------------------------------

const perpDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
};

/** Iterative Douglas-Peucker — recursion blows the stack on long contours. */
const simplifyChain = (pts, eps) => {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let worst = 0;
    let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(pts[i], pts[lo], pts[hi]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at !== -1 && worst > eps) {
      keep[at] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

/**
 * Douglas-Peucker for a closed loop: anchor at the point farthest from the
 * centroid, split at the point farthest from that anchor, and simplify the two
 * halves. Simplifying a loop as one open chain would pin its arbitrary start
 * point and leave a stray vertex behind.
 */
const simplifyLoop = (loop, eps) => {
  const n = loop.length;
  let cx = 0;
  let cy = 0;
  for (const p of loop) {
    cx += p[0];
    cy += p[1];
  }
  cx /= n;
  cy /= n;

  let a = 0;
  let best = -1;
  for (let i = 0; i < n; i++) {
    const d = (loop[i][0] - cx) ** 2 + (loop[i][1] - cy) ** 2;
    if (d > best) {
      best = d;
      a = i;
    }
  }
  let b = a;
  best = -1;
  for (let i = 0; i < n; i++) {
    const d = (loop[i][0] - loop[a][0]) ** 2 + (loop[i][1] - loop[a][1]) ** 2;
    if (d > best) {
      best = d;
      b = i;
    }
  }

  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const first = simplifyChain(loop.slice(lo, hi + 1), eps);
  const second = simplifyChain([...loop.slice(hi), ...loop.slice(0, lo + 1)], eps);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
};

const area = (loop) => {
  let a = 0;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    a += loop[j][0] * loop[i][1] - loop[i][0] * loop[j][1];
  }
  return Math.abs(a) / 2;
};

// --- emit -----------------------------------------------------------------

const toSvg = (width, height, loops) => {
  const n = (v) => {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };
  const d = loops
    .map((loop) => {
      // +0.5 moves from pixel-centre sample space into image space.
      const pts = loop.map((p) => [p[0] + 0.5, p[1] + 0.5]);
      let out = `M${n(pts[0][0])} ${n(pts[0][1])}`;
      for (let i = 1; i < pts.length; i++) out += `L${n(pts[i][0])} ${n(pts[i][1])}`;
      return `${out}Z`;
    })
    .join("");

  // fill-rule evenodd so the enclosed gaps between crossing limbs stay open
  // without having to track winding direction while linking loops.
  return (
    // preserveAspectRatio="none" so the SVG stretches to whatever box the mask
    // gives it, exactly as a raster mask does. The layout already matches each
    // instance's box to the artwork's aspect, so in practice nothing stretches.
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">` +
    `<path fill="#000" fill-rule="evenodd" d="${d}"/>` +
    `</svg>\n`
  );
};

// --- run ------------------------------------------------------------------

if (!existsSync(FFMPEG)) {
  throw new Error("Run npm install first — this uses the ffmpeg Remotion ships.");
}

const pngs = readdirSync(treeDir).filter((f) => f.toLowerCase().endsWith(".png")).sort();
if (pngs.length === 0) throw new Error(`No PNGs found in ${treeDir}`);

for (const name of pngs) {
  const src = join(treeDir, name);
  const { width, height, gray } = decodeGray(src);

  const loops = traceLoops(width, height, gray)
    .map((l) => simplifyLoop(l, EPSILON))
    .filter((l) => l.length >= 3 && area(l) >= MIN_AREA);

  const svg = toSvg(width, height, loops);
  const out = src.replace(/\.png$/i, ".svg");
  writeFileSync(out, svg);

  const points = loops.reduce((s, l) => s + l.length, 0);
  const pngKb = Math.round(statSync(src).size / 1024);
  const svgKb = Math.round(statSync(out).size / 1024);
  console.log(
    `${name.padEnd(26)} ${width}x${height}  ${String(loops.length).padStart(5)} loops  ` +
    `${String(points).padStart(7)} points  ${pngKb}KB png -> ${svgKb}KB svg`,
  );
}
