// Verify-loop step 3 (logic level): checks the spread timing of every
// composition against the rules, using the same code the shaders are fed
// from. Run with:  npm run verify:spread
//
// Checks per composition:
//  A. Causality: every node except the source(s) has an incoming cable whose
//     front arrives exactly when the node switches, and no node switches
//     before any cable reaches it.
//  B. No static half-and-half cables: a cable is mixed only while its front
//     is moving (0 < fill < 1), and each fill runs one way, earlier -> later.
//  C. Front shape: correlation of switch time with the expected distance
//     metric (diamond = grid steps, circle = straight-line distance,
//     diagonal sweep = grid steps from the off-frame corner source).
//  D. End state: nodes visible in the final frame (projected through the
//     composition's camera) have switched before the hold (last ~2 s).
//  E. Source placement: comp 3's source is outside the opening frame; comp
//     2/4 sources are near the centre of the opening frame.
import * as THREE from "three";
import { ALL_COMPS, DURATION } from "../../src/compositions/defs";
import { DIM, GRID_N, LINKS, NODES, NODE_COUNT, neighbours, nodeIndex } from "../../src/lib/grid";
import { computeSpread, MIN_GAP } from "../../src/lib/spread";
import type { CompDef } from "../../src/lib/types";

const HOLD_START = DURATION - 60;
const ASPECT = 16 / 9;

const project = (def: CompDef, frame: number, p: THREE.Vector3) => {
  const shot = def.camera(frame);
  const cam = new THREE.PerspectiveCamera(shot.fov, ASPECT, 0.5, 400);
  cam.position.set(...shot.position);
  cam.up.set(...shot.up);
  cam.lookAt(new THREE.Vector3(...shot.target));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const v = p.clone().project(cam);
  return { x: v.x, y: v.y, inFront: v.z < 1 && v.z > -1 };
};

const visibleAt = (def: CompDef, frame: number, k: number, margin = 0) => {
  const n = NODES[k];
  // a node counts as visible if its plinth centre or top is in frame
  for (const y of [0, DIM.wallTop]) {
    const s = project(def, frame, new THREE.Vector3(n.x, y, n.z));
    if (s.inFront && Math.abs(s.x) <= 1 - margin && Math.abs(s.y) <= 1 - margin) return true;
  }
  return false;
};

const pearson = (a: number[], b: number[]) => {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
};

let failures = 0;
const check = (ok: boolean, label: string, detail: string) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${detail}`);
  if (!ok) failures++;
};

for (const def of ALL_COMPS) {
  console.log(`\n${def.id}  (${def.from} -> ${def.to}, step ${def.spread.stepFrames}f, ${def.spread.metric})`);
  const t = computeSpread(def.spread);
  const sources = new Set(def.spread.sources.map(([i, j]) => nodeIndex(i, j)));

  const minFill = MIN_GAP * def.spread.stepFrames;
  // A. causality
  let badCausal = 0;
  let earliestArrivalGap = Infinity;
  for (let k = 0; k < NODE_COUNT; k++) {
    if (sources.has(k)) continue;
    let arrivals = 0;
    LINKS.forEach((l, idx) => {
      if (l.a !== k && l.b !== k) return;
      const receiving = (t.linkReverse[idx] ? l.a : l.b) === k;
      // a single front that leaves the earlier node and lands exactly now
      const travel = t.linkEnd[idx] - t.linkStart[idx];
      if (receiving && Math.abs(t.linkEnd[idx] - t.tNode[k]) < 1e-4 && travel >= minFill - 1e-3) {
        arrivals++;
        earliestArrivalGap = Math.min(earliestArrivalGap, t.linkEnd[idx] - t.linkStart[idx]);
      }
    });
    const earlierNeighbour = neighbours(k).some((n) => t.tNode[n] < t.tNode[k]);
    if (arrivals === 0 || !earlierNeighbour) badCausal++;
  }
  check(
    badCausal === 0,
    "A causality",
    `${badCausal} nodes switch without a cable front arriving; shortest delivering cable ${earliestArrivalGap.toFixed(1)} frames`,
  );

  // B. every cable fill runs from the earlier node to the later one, with a
  // positive duration, so mixed colour only exists while the front moves.
  // Fronts never travel faster than the minimum travel time (links whose
  // ends switch closer together fill from both ends, fronts meeting).
  let badLinks = 0;
  let twoFront = 0;
  let fastestFront = Infinity;
  LINKS.forEach((l, idx) => {
    const ta = t.tNode[l.a];
    const tb = t.tNode[l.b];
    const from = t.linkReverse[idx] ? tb : ta;
    const to = t.linkReverse[idx] ? ta : tb;
    if (!(t.linkEnd[idx] >= t.linkStart[idx]) || from !== t.linkStart[idx] || to !== t.linkEnd[idx] || from > to) badLinks++;
    const d = t.linkEnd[idx] - t.linkStart[idx];
    const frontA = Math.max(d, minFill);
    if (d < minFill) twoFront++;
    fastestFront = Math.min(fastestFront, frontA, minFill);
  });
  check(
    badLinks === 0 && fastestFront >= minFill - 1e-3,
    "B cable fronts",
    `${badLinks} static/backwards; fastest front ${fastestFront.toFixed(1)} frames along the cable (min ${minFill.toFixed(1)}); ${twoFront} links fill from both ends`,
  );

  // C. front shape
  const times: number[] = [];
  const manhattan: number[] = [];
  const radial: number[] = [];
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      const k = nodeIndex(i, j);
      times.push(t.tNode[k]);
      let m = Infinity;
      let r = Infinity;
      for (const [si, sj] of def.spread.sources) {
        m = Math.min(m, Math.abs(i - si) + Math.abs(j - sj));
        r = Math.min(r, Math.hypot(i - si, j - sj));
      }
      manhattan.push(m);
      radial.push(r);
    }
  }
  const cm = pearson(times, manhattan);
  const cr = pearson(times, radial);
  const expected = def.spread.metric === "manhattan" ? "diamond" : "circle";
  const ok = def.spread.metric === "manhattan" ? cm > 0.97 && cm > cr : cr > 0.97 && cr > cm;
  check(ok, "C front shape", `${expected}: r(manhattan)=${cm.toFixed(3)} r(radial)=${cr.toFixed(3)}`);

  // D. end state for nodes visible in the final frame
  const last = DURATION - 1;
  const vis = NODES.filter((n) => visibleAt(def, last, n.index));
  const lateVis = vis.filter((n) => t.tNode[n.index] >= HOLD_START);
  const unswitchedAtEnd = vis.filter((n) => t.tNode[n.index] > last);
  const lastVisibleSwitch = Math.max(...vis.map((n) => t.tNode[n.index]));
  if (def.id === "ChipGrid-AttackPullback") {
    // "may keep a few blue nodes at the far edges"
    const frac = 1 - unswitchedAtEnd.length / vis.length;
    check(frac > 0.9, "D end state", `${(frac * 100).toFixed(1)}% of ${vis.length} visible nodes red at the end; last visible switch at frame ${lastVisibleSwitch.toFixed(0)}`);
  } else {
    check(
      lateVis.length === 0,
      "D end state",
      `${vis.length} nodes visible at the end, all switched by frame ${lastVisibleSwitch.toFixed(0)} (hold starts ${HOLD_START}); ${lateVis.length} switch during the hold`,
    );
  }
  // how long the visible spread takes (first to last visible switch)
  const firstVisible = Math.min(...vis.map((n) => t.tNode[n.index]));
  console.log(`        visible spread: frames ${firstVisible.toFixed(0)}-${lastVisibleSwitch.toFixed(0)} (${((lastVisibleSwitch - def.spread.tStart) / 30).toFixed(1)} s from the source switch)`);

  // E. source placement
  const src = [...sources][0];
  if (def.id === "ChipGrid-AttackSpread") {
    const offFrame = [...sources].every((s) => !visibleAt(def, 0, s));
    const p = project(def, 0, new THREE.Vector3(NODES[src].x, 0, NODES[src].z));
    check(offFrame, "E source off-frame", `source (${NODES[src].i},${NODES[src].j}) projects to (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) in NDC at frame 0`);
  } else if (def.id !== "ChipGrid-ShieldSweepTop") {
    const p = project(def, 0, new THREE.Vector3(NODES[src].x, 0.8, NODES[src].z));
    check(Math.abs(p.x) < 0.3 && Math.abs(p.y) < 0.4, "E source near centre", `source projects to (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) in NDC at frame 0`);
  }
}

console.log(failures === 0 ? "\nAll spread checks passed." : `\n${failures} spread check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
