// Geometry checks for every acronym, run in Node (no browser needed):
//   npm run check
//
// - no cube ever goes below the paper; during rolls/settle it stays in contact
// - no two cubes ever intersect
// - every cube ends flat, upright, target face up, in an evenly spaced row
// - everything is perfectly still by frame 120
// - each cube (and its shadow) starts outside the frame, so nothing pops in
// - side faces never spell a word with their neighbours
// - picks the mid-tumble still frame for each acronym

import { Matrix4, Quaternion, Vector3 } from "three";
import { ACRONYMS } from "../src/data/acronyms";
import {
  FACE_NORMALS,
  TOP_FACE,
  planCubes,
  poseAt,
  supportHeight,
  type CubePose,
} from "../src/lib/motion";
import { findWordViolations, sideFacesFor } from "../src/lib/sideFaces";
import { cameraForFrame as makeCamera, cubeCorners as corners, inFrame, midTumbleFrame } from "../src/lib/stills";
import {
  ALL_STILL_BY_FRAME,
  CUBE,
  DURATION_IN_FRAMES,
  FIRST_DROP_FRAME,
  ROW_PITCH,
  cameraAt,
  keyLightAt,
} from "../src/lib/world";

const axesOf = (q: Quaternion) => {
  const m = new Matrix4().makeRotationFromQuaternion(q);
  const x = new Vector3();
  const y = new Vector3();
  const z = new Vector3();
  m.extractBasis(x, y, z);
  return [x, y, z];
};

// Separating-axis test for two cubes (sharp-cornered, so conservative).
const obbOverlap = (a: CubePose, b: CubePose) => {
  const A = axesOf(a.quaternion);
  const B = axesOf(b.quaternion);
  const axes = [...A, ...B];
  for (const u of A) for (const v of B) {
    const c = new Vector3().crossVectors(u, v);
    if (c.lengthSq() > 1e-9) axes.push(c.normalize());
  }
  const d = new Vector3().subVectors(b.position, a.position);
  const h = CUBE / 2;
  for (const L of axes) {
    const ra = A.reduce((s, e) => s + h * Math.abs(e.dot(L)), 0);
    const rb = B.reduce((s, e) => s + h * Math.abs(e.dot(L)), 0);
    if (Math.abs(d.dot(L)) > ra + rb + 1e-9) return false;
  }
  return true;
};

const shadowPoint = (p: Vector3, frame: number) => {
  const L = new Vector3(...keyLightAt(frame).position);
  const dir = p.clone().sub(L);
  const t = -L.y / dir.y;
  return L.clone().add(dir.multiplyScalar(t));
};

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log("  FAIL " + msg);
};

const stillFrames: Record<string, number> = {};

for (const row of ACRONYMS) {
  const plans = planCubes(row);
  const faces = sideFacesFor(row);
  console.log(
    `${row.id}: rolls ${plans.map((p) => p.rolls).join("/")}, dirs ${plans
      .map((p) => (p.dir === 1 ? "top" : "bottom"))
      .join("/")}, land ${plans.map((p) => p.tLand).join("/")}, flat ${plans
      .map((p) => p.tRollEnd.toFixed(1))
      .join("/")}, still ${plans.map((p) => p.tRest.toFixed(1)).join("/")}`,
  );
  console.log(`  side faces: ${faces.map((f) => f.join("")).join("  ")}`);

  let maxSink = 0;
  let maxFloatInContact = 0;
  let lastMoving = 0;
  for (let f = 0; f < DURATION_IN_FRAMES; f++) {
    const poses = plans.map((p) => poseAt(p, f));
    const prev = f > 0 ? plans.map((p) => poseAt(p, f - 1)) : null;
    poses.forEach((pose, i) => {
      if (!pose.visible) return;
      const gap = pose.position.y - supportHeight(pose.quaternion);
      maxSink = Math.min(maxSink, gap);
      if (pose.phase === "roll" || pose.phase === "settle" || pose.phase === "rest") {
        maxFloatInContact = Math.max(maxFloatInContact, Math.abs(gap));
      }
      if (prev && prev[i].visible) {
        const moved =
          pose.position.distanceTo(prev[i].position) > 0 ||
          pose.quaternion.angleTo(prev[i].quaternion) > 0;
        if (moved) lastMoving = f;
      }
    });
    for (let i = 0; i < poses.length; i++)
      for (let j = i + 1; j < poses.length; j++)
        if (poses[i].visible && poses[j].visible && obbOverlap(poses[i], poses[j]))
          fail(`cubes ${i} and ${j} intersect at frame ${f}`);

  }
  if (maxSink < -1e-6) fail(`a cube sinks ${(-maxSink).toFixed(5)} below the paper`);
  if (maxFloatInContact > 1e-6) fail(`a rolling cube floats ${maxFloatInContact.toFixed(5)}`);
  if (lastMoving >= ALL_STILL_BY_FRAME) fail(`still moving at frame ${lastMoving}`);
  console.log(
    `  lowest point vs paper: ${maxSink.toExponential(1)}; contact error ${maxFloatInContact.toExponential(1)}; last movement frame ${lastMoving}`,
  );

  // Final pose: target face up, upright, flat, evenly spaced, centred.
  const rest = plans.map((p) => poseAt(p, 200));
  rest.forEach((pose, i) => {
    const up = FACE_NORMALS[TOP_FACE].clone().applyQuaternion(pose.quaternion);
    if (up.y < 1 - 1e-9) fail(`${row.id}[${i}] target face not straight up`);
    if (pose.quaternion.angleTo(new Quaternion()) > 1e-9) fail(`${row.id}[${i}] not upright`);
    if (Math.abs(pose.position.y - CUBE / 2) > 1e-9 || Math.abs(pose.position.z) > 1e-9)
      fail(`${row.id}[${i}] not flat in the row`);
    if (i > 0 && Math.abs(pose.position.x - rest[i - 1].position.x - ROW_PITCH) > 1e-9)
      fail(`${row.id}[${i}] spacing`);
  });

  // Entry: cube and its shadow start outside the frame.
  plans.forEach((p) => {
    const f = p.tStart;
    const pose = poseAt(p, f);
    const cam = makeCamera(f);
    const cs = corners(pose);
    if (cs.some((c) => inFrame(c, cam))) fail(`${row.id}[${p.index}] visible at its first frame ${f}`);
    if (cs.some((c) => inFrame(shadowPoint(c, f), cam)))
      fail(`${row.id}[${p.index}] shadow visible at its first frame ${f}`);
    if (f < FIRST_DROP_FRAME) fail(`${row.id}[${p.index}] starts before frame ${FIRST_DROP_FRAME}`);
  });

  const words = findWordViolations(plans, faces);
  if (words.length) fail(`side faces spell: ${[...new Set(words.map((w) => w.word))].join(", ")}`);
  else console.log("  no words across neighbouring faces at any frame");

  const midTumble = midTumbleFrame(row);
  if (midTumble < 0) fail(`${row.id}: no mid-tumble frame with a cube fully in frame`);
  stillFrames[row.id] = midTumble;
  console.log(`  mid-tumble still frame: ${midTumble}`);
}

console.log("\nMID_TUMBLE_FRAMES=" + JSON.stringify(stillFrames));
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL MOTION CHECKS PASSED");
process.exit(failures ? 1 : 0);
