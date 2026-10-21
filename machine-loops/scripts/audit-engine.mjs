// Mechanism audit for the beam engine (in the spirit of anatomy's
// `build.mjs --audit`): replays every frame of the 600-frame loop through the
// same model the video draws and fails on any joint that doesn't hold.
//   node scripts/audit-engine.mjs
import { G, pose, crankAngle, ENGINE_LOOP } from "../src/blueprint/engine.ts";

const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const fails = [];
const stat = {};
const track = (k, v) => {
  const s = (stat[k] ??= { min: Infinity, max: -Infinity });
  s.min = Math.min(s.min, v);
  s.max = Math.max(s.max, v);
};
const check = (ok, msg) => {
  if (!ok) fails.push(msg);
};
const LINKS = [
  ["beam end B on its arc", (p) => d(p.B, G.O), G.L],
  ["connecting rod B-P", (p) => d(p.B, p.P), G.conrod],
  ["crank pin radius", (p) => d(p.P, G.C), G.crank],
  ["Watt coupler A-E", (p) => d(p.A, p.E), G.wattC],
  ["radius rod F-E", (p) => d(G.F, p.E), G.L],
  ["eccentric rod", (p) => d(p.Ec, p.R1), G.eccRod],
  ["valve link", (p) => d(p.R2, p.Vs), G.valveLink],
  ["air-pump link", (p) => d(p.Qa, p.Sa), G.airLink],
  ["feed-pump link", (p) => d(p.Qf, p.Sf), G.feedLink],
];

let prevTheta = null;
for (let f = 0; f <= ENGINE_LOOP; f++) {
  const p = pose(crankAngle(f), f);
  for (const [name, fn, len] of LINKS) {
    const e = Math.abs(fn(p) - len);
    track(`|${name}| error`, e);
    check(e < 1e-6, `frame ${f}: ${name} length off by ${e}`);
  }
  // beam: A, O, B collinear and opposite
  const col = Math.abs(p.A.x + p.B.x) + Math.abs(p.A.y + p.B.y);
  check(col < 1e-6, `frame ${f}: beam ends not opposite`);
  // straight-line motion: Watt midpoint vs the piston-rod axis
  track("parallel-motion pin x deviation (units)", p.Mid.x - G.rodX);
  track("piston top y", p.pistonTop);
  track("beam angle (deg)", (p.phi * 180) / Math.PI);
  // piston stays in the bore with clearance
  check(p.pistonTop < G.cylTop - 30, `frame ${f}: piston hits the top cover`);
  check(p.pistonTop - G.pistonH > G.cylBot + 20, `frame ${f}: piston hits the bottom cover`);
  // crosshead clears the stuffing box
  check(p.Mid.y - 60 > G.cylTop + 150, `frame ${f}: crosshead hits the gland`);
  // parallel-motion lower pin (boss r=44) clears the stuffing box and gland
  track("lower linkage pin clearance above gland", p.E.y - 44 - (G.cylTop + 150));
  check(Math.abs(p.E.x - G.rodX) > 154 || p.E.y - 44 > G.cylTop + 160, `frame ${f}: parallel-motion pin hits the gland`);
  // pumps: bucket inside barrel, crosshead inside guides
  track("air pump bucket", p.Sa.y - G.airRod);
  check(p.Sa.y - G.airRod < -950 && p.Sa.y - G.airRod - 60 > -1350, `frame ${f}: air pump bucket leaves barrel`);
  check(p.Sa.y + 30 < -480 && p.Sa.y - 30 > -950 + 34, `frame ${f}: air pump crosshead leaves guides`);
  check(p.Sf.y - G.feedRod < -720 && p.Sf.y - G.feedRod - 60 > -1020, `frame ${f}: feed pump bucket leaves barrel`);
  check(p.Sf.y + 30 < -400 && p.Sf.y - 30 > -720 + 34, `frame ${f}: feed pump crosshead leaves guides`);
  track("valve spindle y", p.Vs.y);
  track("governor ball angle (deg)", (p.alpha * 180) / Math.PI);
  // flywheel turns at constant speed
  if (prevTheta !== null && f < ENGINE_LOOP) {
    track("crank step per frame (deg)", ((p.theta - prevTheta) * 180) / Math.PI);
  }
  prevTheta = p.theta;
  // governor turns 2x crank (belt pulleys 200:100)
  check(Math.abs(p.psi - 2 * p.theta) < 1e-9, `frame ${f}: governor speed ratio`);
  // eccentric leads the crank by 90deg + lead
}
// loop closure
const a = pose(crankAngle(0), 0);
const b = pose(crankAngle(ENGINE_LOOP), ENGINE_LOOP);
const closure = Math.max(...Object.keys(a).filter((k) => typeof a[k] === "object").map((k) => d(a[k], b[k])));
check(closure < 1e-6, `loop does not close: ${closure}`);
console.log("flywheel revolutions per loop:", Math.abs(crankAngle(ENGINE_LOOP - 1) - crankAngle(0) + (crankAngle(1) - crankAngle(0))) / (2 * Math.PI));
for (const [k, v] of Object.entries(stat)) console.log(k.padEnd(44), v.min.toFixed(4), "..", v.max.toFixed(4));
const stroke = stat["piston top y"].max - stat["piston top y"].min;
const dev = stat["parallel-motion pin x deviation (units)"];
console.log(`piston stroke ${stroke.toFixed(1)}; linkage pin deviation ${(dev.max - dev.min).toFixed(2)} (${(((dev.max - dev.min) / stroke) * 100).toFixed(2)}% of stroke); piston rod itself is held on x=${G.rodX} by the gland`);
if (fails.length) {
  console.log(`FAIL (${fails.length})`);
  console.log(fails.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("PASS: all joints hold in all", ENGINE_LOOP + 1, "frames; loop closes");
