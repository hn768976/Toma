// Choreography validator for src/liquid-blobs/motion.ts.
//
// Re-implements the ray march on the CPU at low resolution and scans every
// frame of the loop for composition defects. Far more trustworthy than a
// contact sheet: a one-frame sliver of background in a corner is invisible in
// a sample grid and very obvious in motion. ~13s for the whole loop, against
// roughly six seconds per frame for a real render.
//
// Usage:
//   npx tsc src/liquid-blobs/motion.ts src/liquid-blobs/constants.ts \
//     --outDir /tmp/lb --module commonjs --target es2022 --skipLibCheck
//   node tools/validate-choreography.cjs /tmp/lb 358
//
// Exits non-zero if anything fails, so it can gate a render.

const { createBallField, sampleBallField, sampleCameraX, sampleCameraZ } = require(process.argv[2] + "/motion.js");
const N = Number(process.argv[3] || 358);
// Must match CAMERA_FOV in constants.ts, the composition aspect, and the
// blendRadius the compositions are rendered with.
const FOV = 35, ASPECT = 16 / 9, K = 0.66;
const hH = Math.tan((FOV * Math.PI) / 360), hW = hH * ASPECT;
const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * h - k * h * (1 - h); };

const W = 128, H = 72;
const f = createBallField();
const hitAt = (ox, oz, x, y) => {
  const ndcx = ((x + 0.5) / W) * 2 - 1, ndcy = 1 - ((y + 0.5) / H) * 2;
  let dx = ndcx * hW, dy = ndcy * hH, dz = -1;
  const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  let t = 0.1;
  for (let s = 0; s < 72; s++) {
    const px = ox + dx * t, py = dy * t, pz = oz + dz * t;
    let d = 1e9;
    for (let i = 0; i < 8; i++) d = smin(d, Math.hypot(px - f.positions[i*3], py - f.positions[i*3+1], pz - f.positions[i*3+2]) - f.radii[i], K);
    if (d < 0.002) return true;
    if (t > 26) return false;
    t += d * 0.92;
  }
  return false;
};

const problems = { rightEdge: [], corner: [], satClip: [], busy: [], empty: [], flat: [] };
for (let fr = 0; fr < N; fr++) {
  const t = fr / N;
  sampleBallField(f, t);
  const ox = sampleCameraX(t), oz = sampleCameraZ(t);
  // Right edge and the two right corners must always be covered by the mass.
  let uncovered = 0;
  for (let y = 0; y < H; y++) if (!hitAt(ox, oz, W - 1, y)) uncovered++;
  if (uncovered > 0) problems.rightEdge.push(`${fr}(${uncovered}rows)`);

  // Full mask, for region analysis.
  const mask = [];
  let hits = 0;
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) { const h = hitAt(ox, oz, x, y); row.push(h); if (h) hits++; } mask.push(row); }
  const cover = hits / (W * H);
  if (cover < 0.25) problems.empty.push(`${fr}(${(cover*100)|0}%)`);

  const seen = mask.map((r) => r.map(() => false));
  let regions = 0, worstSat = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y][x] || seen[y][x]) continue;
    regions++;
    const st = [[x, y]]; let right = false, edge = false, size = 0;
    while (st.length) {
      const [cx, cy] = st.pop();
      if (cx < 0 || cy < 0 || cx >= W || cy >= H || seen[cy][cx] || !mask[cy][cx]) continue;
      seen[cy][cx] = true; size++;
      if (cx === W - 1) right = true;
      if (cx === 0 || cy === 0 || cy === H - 1) edge = true;
      st.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
    if (!right && edge) worstSat = Math.max(worstSat, size);
  }
  if (worstSat > 12) problems.satClip.push(`${fr}(${worstSat}px)`);
  if (regions > 3) problems.busy.push(`${fr}(${regions})`);

  // Silhouette interest. A mass whose visible left boundary is shaped by a
  // single ball reads as a plain circle — that is what makes a frame look
  // like two flat discs. Count how many different balls actually reach the
  // boundary; two or more means the outline has liquid contour in it.
  const owners = new Set();
  for (let y = 1; y < H - 1; y += 2) {
    if (!mask[y][W - 1]) continue;
    let x = W - 1;
    while (x > 0 && mask[y][x - 1]) x--;
    if (x === 0) continue;
    // Re-march that pixel to the surface, then see which ball is nearest.
    const ndcx = ((x + 0.5) / W) * 2 - 1, ndcy = 1 - ((y + 0.5) / H) * 2;
    let dx = ndcx * hW, dy = ndcy * hH, dz = -1;
    const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
    let t = 0.1, found = false;
    for (let st = 0; st < 72; st++) {
      const px = ox + dx * t, py = dy * t, pz = oz + dz * t;
      let d = 1e9;
      for (let i = 0; i < 8; i++) d = smin(d, Math.hypot(px - f.positions[i*3], py - f.positions[i*3+1], pz - f.positions[i*3+2]) - f.radii[i], K);
      if (d < 0.01) { found = true; break; }
      if (t > 26) break;
      t += d * 0.92;
    }
    if (!found) continue;
    const px = ox + dx * t, py = dy * t, pz = oz + dz * t;
    let best = -1, bestD = 1e9;
    for (let i = 0; i < 8; i++) {
      const dd = Math.hypot(px - f.positions[i*3], py - f.positions[i*3+1], pz - f.positions[i*3+2]) - f.radii[i];
      if (dd < bestD) { bestD = dd; best = i; }
    }
    owners.add(best);
  }
  if (owners.size < 2) problems.flat.push(`${fr}(balls=${owners.size})`);
}
let failed = 0;
const show = (name, list) => {
  if (list.length) failed++;
  console.log(`${name.padEnd(34)} ${list.length === 0 ? "clean" : `${list.length} frames: ${list.slice(0,10).join(" ")}${list.length>10?" …":""}`}`);
};
console.log(`Validated all ${N} frames at ${W}x${H}:`);
show("  background at right edge", problems.rightEdge);
show("  free satellite off frame", problems.satClip);
show("  more than 3 separate blobs", problems.busy);
show("  frame too empty (<25% cover)", problems.empty);
 show("  mass silhouette featureless", problems.flat);
process.exit(failed === 0 ? 0 : 1);
