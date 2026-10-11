// Measures how smooth the fibre ribbon is on screen: for fibres across the
// ribbon width, project each polyline with the shot camera at 4K and report
// the sharpest turn between consecutive segments (degrees) and whether any
// fibre runs backwards against the centre line (a fold / cusp).
// usage: node scripts/check-fibre-smoothness.mjs [segments] [smooth=1]
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "fibrecheck-"));
const out = join(dir, "ribbonPath.mjs");
await build({ entryPoints: ["src/fibre/ribbonPath.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const m = await import(pathToFileURL(out).href);
const THREE = await import("three");

const MINSEG = Number(process.env.MINSEG || 2);
const segments = Number(process.argv[2] || m.SEGMENTS);
const smooth = (process.argv[3] ?? "1") !== "0";
const { centre, side, up, path } = m.buildRibbonFrame(segments, smooth);
const W = 3840, H = 2160;
const cam = new THREE.PerspectiveCamera(42, W / H, 0.5, 400);
cam.position.copy(m.CAMERA_POS);
cam.lookAt(m.CAMERA_TARGET);
cam.updateMatrixWorld();
const toPx = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H, p.z]; };

let worst = { ang: 0 }, folds = 0, minR = { r: Infinity };
for (const across of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
  const a = across * m.RIBBON_HALF;
  const pts = centre.map((c, i) => c.clone().addScaledVector(side[i], a));
  // fold check in 3D: fibre direction against the centre tangent
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].clone().sub(pts[i - 1]);
    const t = path.getTangentAt(i / segments);
    if (d.dot(t) <= 0) folds++;
  }
  // screen-space turning angle (only on-screen samples)
  const px = pts.map(toPx);
  let fr = { r: Infinity };
  for (let i = 1; i < px.length - 1; i++) {
    const [a0, a1, a2] = [px[i - 1], px[i], px[i + 1]];
    if ([a0, a1, a2].some((q) => q[2] > 1 || q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H)) continue;
    const u = [a1[0] - a0[0], a1[1] - a0[1]], v = [a2[0] - a1[0], a2[1] - a1[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    if (lu < MINSEG || lv < MINSEG) continue;
    const ang = (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)))) * 180) / Math.PI;
    const rad = (Math.max(lu, lv) / Math.max(ang * Math.PI / 180, 1e-6));
    if (rad < fr.r) fr = { r: rad, at: a1.slice(0, 2).map((x) => Math.round(x)) };
    if (rad < minR.r) minR = { r: rad, across, at: a1.slice(0, 2).map((x) => Math.round(x)) };
    if (ang > worst.ang) worst = { ang, across, i, seg: lu.toFixed(1), at: a1.slice(0, 2).map((x) => Math.round(x)) };
  }
  if (process.env.VERBOSE) console.log(`  across=${across}: min radius ${fr.r.toFixed(0)}px at ${fr.at}`);
}
console.log(`segments=${segments} smoothTwist=${smooth}: sharpest on-screen turn per segment ${worst.ang.toFixed(2)} deg`,
  `(fibre across=${worst.across}, seg ${worst.seg}px, at ${worst.at}); backwards segments (folds): ${folds};`,
  `tightest on-screen radius ${minR.r.toFixed(0)}px at 4K (across=${minR.across}, at ${minR.at})`);
