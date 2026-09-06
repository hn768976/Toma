/**
 * Traces a black-on-white PNG silhouette to a single SVG path.
 *
 * The boundary is followed along pixel cracks rather than pixel centres, so
 * every closed region — the outline *and* every enclosed gap between branches —
 * comes out as its own loop, wound consistently. Emitted with
 * `fill-rule="evenodd"`, that means the gaps are genuine holes in the shape:
 * fog and the distant glow show through them, instead of being blocked by a
 * white fill.
 *
 * Usage: node tools/trace-svg.mjs public/trees/tree-dense-oak.png [out.svg]
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openBrowser, dataUrl } from "./cdp.mjs";

const input = resolve(process.argv[2] ?? "public/trees/tree-dense-oak.png");
const output = resolve(process.argv[3] ?? input.replace(/\.png$/, ".svg"));
if (!existsSync(input)) throw new Error(`missing ${input}`);

/**
 * The source art is small, and its fine twigs are only a pixel or two wide.
 * Tracing it at native size would bake the pixel staircase into the vector and
 * show it as jagged edges once a near-tier trunk is drawn seven times larger,
 * so it is first resampled up to about this height with smooth interpolation.
 * Upscaling invents no detail — it just lets the contour follow a smooth edge
 * instead of a stair.
 */
const TARGET_TRACE_HEIGHT = 2200;

/** Luminance at or below this counts as ink, once composited onto white. */
const THRESHOLD = 140;
/** Douglas-Peucker tolerance, in upscaled pixels. */
const EPSILON = 1.1;
/** Loops enclosing less area than this are dropped as tracing noise. */
const MIN_AREA = 12;
/**
 * Turn angle, in degrees, above which a vertex is treated as a real corner and
 * kept sharp. Below it the contour is rounded through the vertex, which is what
 * takes the remaining pixel staircase out of the edges without also blunting
 * the twig tips.
 */
const CORNER_DEGREES = 72;

const { evaluate, close } = await openBrowser(9343);

const script = `(async () => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = ${JSON.stringify(dataUrl(input))}; });

  const scale = Math.max(1, ${TARGET_TRACE_HEIGHT} / img.naturalHeight);
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  // Composite onto white first: this accepts either a white-background PNG or
  // one with a transparent background, and treats both the same way.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;

  // --- binary mask ---
  const ink = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2];
    ink[p] = lum <= ${THRESHOLD} ? 1 : 0;
  }
  const on = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : ink[y * W + x];

  // --- directed crack edges, ink kept on a consistent side ---
  // Outer boundaries and hole boundaries come out wound in opposite senses,
  // which is what makes the holes read as holes.
  const key = (x, y) => y * (W + 1) + x;
  const outgoing = new Map();
  const addEdge = (x0, y0, x1, y1) => {
    const k = key(x0, y0);
    let list = outgoing.get(k);
    if (!list) { list = []; outgoing.set(k, list); }
    list.push([x1, y1]);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ink[y * W + x]) continue;
      if (!on(x, y - 1)) addEdge(x, y, x + 1, y);
      if (!on(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!on(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!on(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  }

  // --- chain edges into closed loops ---
  const loops = [];
  for (const [k, list] of outgoing) {
    while (list.length) {
      const sx = k % (W + 1), sy = (k - (k % (W + 1))) / (W + 1);
      let [cx, cy] = list.pop();
      const loop = [[sx, sy], [cx, cy]];
      let guard = 0;
      while (!(cx === sx && cy === sy) && guard++ < 4 * W * H) {
        const nl = outgoing.get(key(cx, cy));
        if (!nl || !nl.length) break;
        // Prefer continuing straight: at a pinch point where two boundaries
        // touch, turning would splice two separate loops into one.
        const prev = loop[loop.length - 2];
        const dx = cx - prev[0], dy = cy - prev[1];
        let pick = 0;
        for (let i = 0; i < nl.length; i++) {
          if (nl[i][0] - cx === dx && nl[i][1] - cy === dy) { pick = i; break; }
        }
        const [nx, ny] = nl.splice(pick, 1)[0];
        cx = nx; cy = ny;
        loop.push([cx, cy]);
      }
      if (loop.length > 3) loops.push(loop);
    }
  }

  // --- collinear run merge, then Douglas-Peucker ---
  const dedupe = (pts) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push(b);
    }
    return out;
  };
  // Iterative Douglas-Peucker: these contours run to tens of thousands of
  // points, which is well past what recursion survives.
  const rdp = (pts, eps) => {
    const n = pts.length;
    if (n < 3) return pts.slice();
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop();
      if (hi - lo < 2) continue;
      const [ax, ay] = pts[lo], [bx, by] = pts[hi];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy);
      let maxD = -1, idx = -1;
      for (let i = lo + 1; i < hi; i++) {
        const d = len === 0
          ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay)
          : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx > lo) {
        keep[idx] = 1;
        stack.push([lo, idx], [idx, hi]);
      }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  };

  // A closed ring has to be cut before it can be simplified: with start and end
  // at the same point the anchor segment is degenerate and the whole loop
  // collapses to two points. Cutting at the farthest point gives two open
  // chains that simplify correctly.
  const rdpClosed = (pts, eps) => {
    const ring = (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1])
      ? pts.slice(0, -1) : pts.slice();
    if (ring.length < 4) return null;
    let far = 0, fd = -1;
    for (let i = 1; i < ring.length; i++) {
      const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
      if (d > fd) { fd = d; far = i; }
    }
    const a = rdp(ring.slice(0, far + 1), eps);
    const b = rdp(ring.slice(far).concat([ring[0]]), eps);
    return a.slice(0, -1).concat(b.slice(0, -1));
  };
  const area = (pts) => {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    }
    return Math.abs(a) / 2;
  };

  // --- tight crop, so the viewBox is the ink and nothing else ---
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (const loop of loops) {
    for (const [x, y] of loop) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }

  // --- where the trunk actually meets the ground ---
  // Taken as the centroid of the ink in the lowest band of the silhouette,
  // rather than assumed to be the middle: this is the point every instance is
  // stood on, so guessing it would tilt the whole forest off the ground line.
  let baseSum = 0, baseCount = 0;
  const band = Math.max(1, Math.round((maxY - minY) * 0.02));
  for (let y = Math.floor(maxY) - band; y <= Math.floor(maxY); y++) {
    if (y < 0 || y >= H) continue;
    for (let x = 0; x < W; x++) {
      if (ink[y * W + x]) { baseSum += x; baseCount++; }
    }
  }
  const trunkX = baseCount ? (baseSum / baseCount - minX) / (maxX - minX) : 0.5;

  // --- how wide the trunk is ---
  // Measured on a band above the root flare, where the trunk is normally the
  // only ink. Trees in a forest are spaced by their trunks, not by the width of
  // their crowns: crowns interlace overhead, trunks do not.
  const widths = [];
  const lo = Math.round(maxY - (maxY - minY) * 0.26);
  const hi = Math.round(maxY - (maxY - minY) * 0.1);
  for (let y = lo; y <= hi; y++) {
    if (y < 0 || y >= H) continue;
    let a = -1, b = -1;
    for (let x = 0; x < W; x++) {
      if (ink[y * W + x]) { if (a < 0) a = x; b = x; }
    }
    if (a >= 0) widths.push(b - a + 1);
  }
  widths.sort((p, q) => p - q);
  const trunkW = widths.length
    ? widths[Math.floor(widths.length / 2)] / (maxX - minX)
    : 0.2;

  let parts = [], pts = 0, kept = 0;
  for (const raw of loops) {
    const simple = rdpClosed(dedupe(raw), ${EPSILON});
    if (!simple || simple.length < 3 || area(simple) < ${MIN_AREA}) continue;
    kept++;
    pts += simple.length;
    // --- round the contour, keeping genuine corners sharp ---
    // Each gentle vertex becomes a quadratic control point, with the curve
    // running between the midpoints of its two edges; sharp vertices are kept
    // as hard points so branch tips stay pointed.
    const n = simple.length;
    const cosLimit = Math.cos((${CORNER_DEGREES} * Math.PI) / 180);
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const cmds = [];
    for (let i = 0; i < n; i++) {
      const v = simple[i];
      const prev = simple[(i - 1 + n) % n];
      const next = simple[(i + 1) % n];
      const ax = v[0] - prev[0], ay = v[1] - prev[1];
      const bx = next[0] - v[0], by = next[1] - v[1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      const cos = la && lb ? (ax * bx + ay * by) / (la * lb) : 1;
      if (cos < cosLimit) {
        cmds.push(['L', v]);
      } else {
        cmds.push(['L', mid(prev, v)], ['Q', v, mid(v, next)]);
      }
    }

    const fmt = (v) => (Math.round(v * 10) / 10).toString();
    const pt = (q) => fmt(q[0] - minX) + ' ' + fmt(q[1] - minY);
    let dstr = 'M' + pt(cmds[0][1]);
    for (let i = 1; i < cmds.length; i++) {
      const cmd = cmds[i];
      dstr += cmd[0] === 'L' ? 'L' + pt(cmd[1]) : 'Q' + pt(cmd[1]) + ' ' + pt(cmd[2]);
    }
    parts.push(dstr + 'Z');
  }

  return JSON.stringify({
    w: maxX - minX, h: maxY - minY, scale, trunkX, trunkW,
    loops: loops.length, kept, points: pts, d: parts.join(''),
  });
})()`;

const r = JSON.parse(await evaluate(script));
close();

const trunkX = Math.round(r.trunkX * 10000) / 10000;
const trunkW = Math.round(r.trunkW * 10000) / 10000;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.w} ${r.h}" width="${r.w}" height="${r.h}" data-trunk-x="${trunkX}" data-trunk-w="${trunkW}">
<path fill="#000" fill-rule="evenodd" d="${r.d}"/>
</svg>
`;
writeFileSync(output, svg);
console.log(
  `${output.split("/").pop()}  ${r.w}x${r.h} (traced at ${r.scale.toFixed(1)}x)  ` +
    `loops=${r.loops} kept=${r.kept}  points=${r.points}  ` +
    `trunkX=${trunkX} trunkW=${trunkW}  ${(svg.length / 1024).toFixed(0)} KB`,
);
