// Numerical motion checks, run with:  npx tsx scripts/verify-motion.ts
//
// Uses the exact same pure layout functions the compositions render from.
//  • Look 1: no two cubes ever intersect over the loop; motion closes on its
//    own (poses at t = 0 and t = 1 computed WITHOUT the % 600 wrap match).
//  • Look 2: no two cubes ever intersect (flight vs flight, flight vs
//    placed), sub-frame sampling; every slot filled by frame 200; still
//    after that; every start point off-screen or behind the camera.

import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import {
  ALL_STILL,
  ASSEMBLY_FRAMES,
  assemblyCamera,
  assemblyPose,
  CAM_FOV as A_FOV,
  CAM_TARGET as A_TARGET,
  CUBES,
  N,
} from "../src/assembly/layout";
import { ALL_ON, CLUSTER, clusterCamera, clusterPoses, LOOP } from "../src/cluster/layout";

type Box = { c: Vector3; q: Quaternion; h: number };

/** Separating-axis test for two cubes (OBBs). Returns overlap depth (>0 = intersecting). */
const obbOverlap = (a: Box, b: Box): number => {
  const ax = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((v) => v.applyQuaternion(a.q));
  const bx = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((v) => v.applyQuaternion(b.q));
  const d = b.c.clone().sub(a.c);
  const axes: Vector3[] = [...ax, ...bx];
  for (const u of ax) for (const v of bx) {
    const c = u.clone().cross(v);
    if (c.lengthSq() > 1e-10) axes.push(c.normalize());
  }
  let minPen = Infinity;
  for (const L of axes) {
    const ra = ax.reduce((s, u) => s + a.h * Math.abs(u.dot(L)), 0);
    const rb = bx.reduce((s, u) => s + b.h * Math.abs(u.dot(L)), 0);
    const pen = ra + rb - Math.abs(d.dot(L));
    minPen = Math.min(minPen, pen); // min over axes: > 0 ⇒ intersecting, < 0 ⇒ separated by ≥ -minPen
  }
  return minPen;
};

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log("  FAIL " + msg);
};

// ───────────────────────────── Look 1 ─────────────────────────────
console.log(`Look 1 — Cube Cluster: ${CLUSTER.length} cubes (${CLUSTER.filter((c) => !c.tiny).length} main + ${CLUSTER.filter((c) => c.tiny).length} tiny)`);
{
  const counts: Record<string, number> = {};
  for (const c of CLUSTER.filter((x) => !x.tiny)) counts[c.type] = (counts[c.type] ?? 0) + 1;
  console.log("  type mix (main):", JSON.stringify(counts));
  let worst = -Infinity;
  for (let f = 0; f < LOOP; f += 0.5) {
    const poses = clusterPoses(f / LOOP);
    for (let i = 0; i < poses.length; i++)
      for (let j = i + 1; j < poses.length; j++) {
        const pen = obbOverlap(
          { c: poses[i].pos, q: poses[i].quat, h: poses[i].scale / 2 },
          { c: poses[j].pos, q: poses[j].quat, h: poses[j].scale / 2 },
        );
        if (pen > worst) worst = pen;
        if (pen > 0) fail(`cluster cubes ${i} & ${j} intersect at frame ${f} (depth ${pen.toFixed(3)})`);
      }
    for (const p of poses) if (p.pos.y - p.scale * 0.87 < 0) fail(`cluster cube below floor at frame ${f}`);
  }
  console.log(`  closest approach of any two cubes over the loop: ${(-worst).toFixed(3)} (positive = gap)`);
  // loop closure without the modulo
  const a = clusterPoses(0, ALL_ON);
  const b = clusterPoses(1, ALL_ON); // t = 600/600, computed without wrapping
  let maxPos = 0;
  let maxRot = 0;
  let maxGlow = 0;
  a.forEach((p, i) => {
    maxPos = Math.max(maxPos, p.pos.distanceTo(b[i].pos));
    maxRot = Math.max(maxRot, 1 - Math.abs(p.quat.dot(b[i].quat)));
    maxGlow = Math.max(maxGlow, Math.abs(p.glow - b[i].glow));
  });
  const camD = clusterCamera(0).distanceTo(clusterCamera(1));
  console.log(`  loop closure (unwrapped t=0 vs t=1): pos ${maxPos.toExponential(1)}, rot ${maxRot.toExponential(1)}, glow ${maxGlow.toExponential(1)}, camera ${camD.toExponential(1)}`);
  if (maxPos > 1e-9 || maxRot > 1e-9 || maxGlow > 1e-9 || camD > 1e-9) fail("look 1 motion does not close over 600 frames");
  // continuity across the seam: step 599→600 comparable to a normal step
  const s1 = clusterPoses(599 / LOOP);
  const step = (x: typeof a, y: typeof a) => Math.max(...x.map((p, i) => p.pos.distanceTo(y[i].pos)));
  console.log(`  max cube step 599→600: ${step(s1, b).toFixed(4)}  vs 300→301: ${step(clusterPoses(300 / LOOP), clusterPoses(301 / LOOP)).toFixed(4)}`);
}

// ───────────────────────────── Look 2 ─────────────────────────────
console.log(`\nLook 2 — Cube Assembly: ${CUBES.length} cubes`);
{
  const counts: Record<string, number> = {};
  for (const c of CUBES) counts[c.type] = (counts[c.type] ?? 0) + 1;
  console.log("  type mix:", JSON.stringify(counts));
  const slots = new Set(CUBES.map((c) => c.slot.join(",")));
  if (slots.size !== N * N * N) fail(`only ${slots.size} distinct slots`);
  const lastArrive = Math.max(...CUBES.map((c) => c.arrive));
  console.log(`  first start ${Math.min(...CUBES.map((c) => c.start))}, last arrival ${lastArrive}, fully still from ${ALL_STILL}`);
  if (ALL_STILL > 200) fail(`not still by frame 200 (still from ${ALL_STILL})`);

  // arrival order: a cube never arrives under/inside an already-filled slot path
  let worst = -Infinity;
  let worstAt = "";
  const SUB = 1 / 16;
  let maxStep = 0;
  for (let f = 0; f <= ASSEMBLY_FRAMES; f += SUB) {
    const poses = CUBES.map((c) => assemblyPose(c, f));
    const next = CUBES.map((c) => assemblyPose(c, f + SUB));
    poses.forEach((p, i) => {
      if (p.visible && next[i].visible) maxStep = Math.max(maxStep, p.pos.distanceTo(next[i].pos));
    });
    for (let i = 0; i < CUBES.length; i++) {
      if (!poses[i].visible) continue;
      for (let j = i + 1; j < CUBES.length; j++) {
        if (!poses[j].visible) continue;
        const pen = obbOverlap({ c: poses[i].pos, q: poses[i].quat, h: 0.5 }, { c: poses[j].pos, q: poses[j].quat, h: 0.5 });
        if (pen > worst) {
          worst = pen;
          worstAt = `cubes ${i},${j} @ ${f}`;
        }
        if (pen > 0) fail(`assembly cubes ${i} & ${j} intersect at frame ${f} (depth ${pen.toFixed(3)})`);
      }
      // floor
      const lowest = poses[i].pos.y - 0.87;
      if (lowest < 0 && Math.abs(poses[i].pos.y - CUBES[i].home.y) > 1e-6) {
        // only a concern if a rotated cube dips into the floor in flight
        const corners = [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].flatMap((y) => [-0.5, 0.5].map((z) => new Vector3(x, y, z).applyQuaternion(poses[i].quat).add(poses[i].pos))));
        if (Math.min(...corners.map((v) => v.y)) < 0) fail(`cube ${i} goes through the floor at frame ${f}`);
      }
    }
  }
  console.log(`  closest approach of any two cubes 0–300 (1/16-frame steps): ${(-worst).toFixed(3)} (${worstAt})`);
  console.log(`  largest move of any cube in one 1/16-frame step: ${maxStep.toFixed(3)} (two cubes close by at most 2× this per step, well under the 1.0 cube width — no tunnelling between samples)`);

  // complete & still
  for (const f of [200, 250, 300]) {
    for (const c of CUBES) {
      const p = assemblyPose(c, f);
      if (p.pos.distanceTo(c.home) > 1e-12 || Math.abs(p.quat.w) < 1 - 1e-12) fail(`cube ${c.id} not resting in its slot at frame ${f}`);
    }
  }
  const p0 = CUBES.filter((c) => assemblyPose(c, 0).visible).length;
  console.log(`  cubes visible at frame 0: ${p0}`);
  if (p0 > 0) fail("frame 0 should be empty");

  // start points: off-screen, or behind the camera
  const cam = new PerspectiveCamera(A_FOV, 16 / 9, 0.1, 200);
  let onScreen = 0;
  for (const c of CUBES) {
    cam.position.copy(assemblyCamera(c.start));
    cam.lookAt(A_TARGET);
    cam.updateMatrixWorld();
    const v = c.p0.clone().project(cam);
    const behind = c.p0.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
    const off = behind || Math.abs(v.x) > 1.12 || Math.abs(v.y) > 1.15;
    if (!off) {
      onScreen++;
      fail(`cube ${c.id} (${c.origin}) starts on screen at ndc ${v.x.toFixed(2)},${v.y.toFixed(2)}`);
    }
  }
  console.log(`  start points on screen: ${onScreen}`);
  console.log(`  origins: ${JSON.stringify(CUBES.reduce((m, c) => ({ ...m, [c.origin]: (m[c.origin] ?? 0) + 1 }), {} as Record<string, number>))}`);
}

console.log(failures === 0 ? "\nALL MOTION CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
