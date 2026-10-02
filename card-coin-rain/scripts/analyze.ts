/**
 * Analytic checks on the motion (no rendering needed):
 *   - pop check: every wrap happens with the object (plus its blur spill)
 *     fully outside the frame, for every frame of the loop, with the exact
 *     drifting camera;
 *   - card tilt never exceeds ~25 deg from facing the camera;
 *   - suggests still frames: card square-on, no near-lens object over it.
 *
 * Run: npx tsx scripts/analyze.ts
 */
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import {
  CARD_H,
  CARD_W,
  LOOP,
  NEAR,
  FAR,
  VFOV_DEG,
  cameraPose,
  cardFacingAngle,
  cardPose,
  trackY,
} from "../src/lib/loop";
import { LOOKS } from "../src/lib/looks";
import { blurSpillPx1080, Falling, OBJECTS } from "../src/lib/objects";

const W = 1920;
const H = 1080;

const cam = new PerspectiveCamera(VFOV_DEG, W / H, NEAR, FAR);
const setCam = (frame: number) => {
  const p = cameraPose(frame);
  cam.position.copy(p.position);
  cam.up.set(0, 1, 0);
  cam.lookAt(p.target);
  cam.updateMatrixWorld(true);
};

/** Screen-space circle of an object's bounding sphere (+ blur spill). */
const screenCircle = (o: Falling, frame: number, spillPx: number) => {
  const c = new Vector3(o.x, trackY(o.yTop, o.length, o.y0, o.k, frame), o.z);
  const view = c.clone().applyMatrix4(cam.matrixWorldInverse);
  const dist = -view.z;
  const ndc = c.clone().project(cam);
  const sx = (ndc.x * 0.5 + 0.5) * W;
  const sy = (1 - (ndc.y * 0.5 + 0.5)) * H;
  const f = H / 2 / Math.tan((VFOV_DEG * Math.PI) / 360);
  const r = (o.boundR * o.scale * f) / Math.max(dist, 1e-3) + spillPx;
  return { sx, sy, r, dist };
};

const outside = (c: { sx: number; sy: number; r: number }) =>
  c.sx + c.r < 0 || c.sx - c.r > W || c.sy + c.r < 0 || c.sy - c.r > H;

/** Card's projected quad (rect corners) as a bounding box. */
const cardBox = (frame: number) => {
  const pose = cardPose(frame);
  const m = new Matrix4().compose(pose.position, pose.quaternion, new Vector3(1, 1, 1));
  const pts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => new Vector3((x * CARD_W) / 2, (y * CARD_H) / 2, 0).applyMatrix4(m).project(cam));
  const xs = pts.map((p) => (p.x * 0.5 + 0.5) * W);
  const ys = pts.map((p) => (1 - (p.y * 0.5 + 0.5)) * H);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

const circleHitsBox = (c: { sx: number; sy: number; r: number }, b: ReturnType<typeof cardBox>) => {
  const dx = Math.max(b.x0 - c.sx, 0, c.sx - b.x1);
  const dy = Math.max(b.y0 - c.sy, 0, c.sy - b.y1);
  return dx * dx + dy * dy < c.r * c.r;
};

let failures = 0;
for (const look of Object.values(LOOKS)) {
  const objs = OBJECTS[look.id];
  console.log(`\n=== ${look.id}: ${objs.filter((o) => o.kind === "coin").length} coins, ${objs.filter((o) => o.kind === "bar").length} bars`);
  const roles = new Map<string, number>();
  for (const o of objs) roles.set(`${o.kind}:${o.role}`, (roles.get(`${o.kind}:${o.role}`) ?? 0) + 1);
  console.log("roles:", Object.fromEntries(roles));

  // ---- pop check: at every wrap, both sides of the jump must be off-screen.
  let wraps = 0;
  let worstMargin = Infinity;
  for (const o of objs) {
    const spill = blurSpillPx1080(o.depth, look);
    for (let f = 0; f < LOOP; f++) {
      const y1 = trackY(o.yTop, o.length, o.y0, o.k, f);
      const y2 = trackY(o.yTop, o.length, o.y0, o.k, f + 1);
      if (y2 > y1) {
        wraps++;
        setCam(f);
        const a = screenCircle(o, f, spill);
        setCam(f + 1);
        const b = screenCircle(o, f + 1, spill);
        // margin = how far (px) beyond the frame edge the circle's near side is
        const marginA = a.sy - a.r - H; // below the frame before the wrap
        const marginB = -(b.sy + b.r); // above the frame after the wrap
        worstMargin = Math.min(worstMargin, marginA, marginB);
        if (!outside(a) || !outside(b)) {
          failures++;
          console.log(`POP ${look.id} ${o.kind}/${o.role} depth=${o.depth.toFixed(1)} frame ${f}->${f + 1}: before`, a, "after", b);
        }
      }
    }
  }
  console.log(`wraps checked: ${wraps}; worst off-screen margin incl. blur spill: ${worstMargin.toFixed(1)} px (1080p)`);

  // ---- tilt
  let maxTilt = 0;
  let maxF = 0;
  for (let f = 0; f < LOOP; f++) {
    const a = cardFacingAngle(f);
    if (a > maxTilt) {
      maxTilt = a;
      maxF = f;
    }
  }
  console.log(`max card angle from facing camera: ${maxTilt.toFixed(1)} deg (frame ${maxF})`);
  if (maxTilt > 25.5) failures++;

  // ---- in front of the card
  const coverers = new Set<number>();
  const nearCover: number[] = [];
  const anyCover: number[] = [];
  for (let f = 0; f < LOOP; f++) {
    setCam(f);
    const box = cardBox(f);
    const cardDist = cam.position.distanceTo(cardPose(f).position);
    let n = 0;
    let near = 0;
    objs.forEach((o, i) => {
      const c = screenCircle(o, f, 0);
      // coins: use the face radius, not the bounding sphere
      const tight = { ...c, r: c.r * (o.kind === "coin" ? 0.97 : 0.85) };
      if (c.dist < cardDist - 0.5 && circleHitsBox(tight, box)) {
        coverers.add(i);
        n++;
        if (o.role === "near") near++;
      }
    });
    anyCover.push(n);
    nearCover.push(near);
  }
  const coins = objs.filter((o) => o.kind === "coin").length;
  const roleCount = (r: string) => [...coverers].filter((i) => objs[i].role === r).length;
  console.log(
    `objects crossing in front of the card: ${coverers.size} (front ${roleCount("front")}, near ${roleCount("near")}, mid ${roleCount("mid")}) = ${((roleCount("front") / coins) * 100).toFixed(0)}% of coins by design`,
  );
  const clear = anyCover.filter((n) => n === 0).length;
  const nearClear = nearCover.filter((n) => n === 0).length;
  console.log(`frames with nothing over the card's bounding box: ${((clear / LOOP) * 100).toFixed(0)}%; with no near-lens object over it: ${((nearClear / LOOP) * 100).toFixed(0)}%`);

  // ---- still candidates: square-on card, no near-lens object over it,
  //      fewest mid-depth coins over it.
  const cands: { f: number; a: number; n: number }[] = [];
  for (let f = 0; f < LOOP; f++) {
    if (nearCover[f] === 0) cands.push({ f, a: cardFacingAngle(f), n: anyCover[f] });
  }
  const score = (c: { a: number; n: number }) => c.n * 6 + c.a;
  const sorted = [...cands].sort((x, y) => score(x) - score(y));
  const s1 = sorted[0];
  const circ = (a: number, b: number) => Math.min(Math.abs(a - b), LOOP - Math.abs(a - b));
  const s2 = sorted.find((c) => circ(c.f, s1.f) >= 200);
  console.log(
    `still candidates: frame ${s1?.f} (${s1?.a.toFixed(1)} deg, ${s1?.n} over card), frame ${s2?.f} (${s2?.a.toFixed(1)} deg, ${s2?.n} over card)`,
  );
}

// keep tree-shaking honest
void Euler;
void Quaternion;

if (failures) {
  console.log(`\nFAILED: ${failures}`);
  process.exit(1);
} else {
  console.log("\nall analytic checks passed");
}
