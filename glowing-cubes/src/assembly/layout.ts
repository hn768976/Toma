// Look 2 — Cube Assembly. Pure data + pure functions of the frame. NOT a loop.
//
// Every cube has, fixed at module load from a seeded mulberry32:
//   • a final slot in the 4×4×4 cube
//   • a start point off-screen (above, to the side) or behind the camera
//   • a cubic bezier path whose last leg comes straight into the slot along
//     an open direction (down from above, or in from an outer face)
//   • a start frame and an arrival frame
// Position at frame f is the point on that curve at an eased parameter of f,
// plus a short decaying overshoot after arrival, then exactly still.
// No physics, no state carried between frames.
//
// "Nothing passes through anything else" is enforced when the layout is
// built: slots are filled bottom layer first, inner before outer, and every
// candidate flight is tested (oriented-box separating-axis test, ¼-frame
// steps) against every cube already planned — in flight or placed — and
// against the floor. A candidate that touches anything is re-drawn from the
// same seeded stream, so the result is identical on every build.

import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { assignTypes, type CubeType, mulberry32, pick, range } from "../rng";
import type { Tone } from "../shared/colors";

export const ASSEMBLY_FRAMES = 300;
export const N = 4;
export const PITCH = 1.06; // cubes are 1.0 wide → 0.06 gap
export const FLOOR_GAP = 0.04;
// peak displacement ≈ 0.38 × amp ≈ 0.021 < 0.06 gap, so the snap never touches a neighbour
export const OVERSHOOT_AMP = 0.055;
export const SETTLE_FRAMES = 14;
export const HOLD_FROM = 190;
const FIRST_ARRIVAL = 34;
const LAST_ARRIVAL = 182; // + SETTLE_FRAMES → completely still before frame 200

// ── camera (pure function of frame) ─────────────────────────────────────────
export const CAM_FOV = 30;
export const CAM_TARGET = new Vector3(0, 2.0, 0);
const CAM_DIST = 17.5;
const CAM_ELEV = (31 * Math.PI) / 180;
const CAM_AZ = (38 * Math.PI) / 180;
export const PUSH_IN = 0.045; // ≤ 5 %

const easeInOut = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export const assemblyCamera = (frame: number): Vector3 => {
  const push = 1 - PUSH_IN * easeInOut((frame - HOLD_FROM) / (ASSEMBLY_FRAMES - HOLD_FROM));
  const d = CAM_DIST * push;
  return new Vector3(
    CAM_TARGET.x + d * Math.cos(CAM_ELEV) * Math.sin(CAM_AZ),
    CAM_TARGET.y + d * Math.sin(CAM_ELEV),
    CAM_TARGET.z + d * Math.cos(CAM_ELEV) * Math.cos(CAM_AZ),
  );
};
const CAM0 = assemblyCamera(0);
const camFwd = CAM_TARGET.clone().sub(CAM0).normalize();
const camRight = camFwd.clone().cross(new Vector3(0, 1, 0)).normalize();
const camUp = camRight.clone().cross(camFwd).normalize();

// ── data ────────────────────────────────────────────────────────────────────
export type AssemblyCube = {
  id: number;
  type: CubeType;
  tone: Tone;
  slot: [number, number, number];
  home: Vector3;
  approach: Vector3; // unit vector pointing from the slot out along the last leg
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  start: number;
  arrive: number;
  spinAxis: Vector3;
  spinAngle: number;
  origin: "camera" | "above" | "side";
  glowBase: number;
  pulsePeriod: number;
  pulsePhase: number;
};

export const slotCenter = (i: number, j: number, k: number) =>
  new Vector3((i - 1.5) * PITCH, 0.5 + FLOOR_GAP + j * PITCH, (k - 1.5) * PITCH);

const bezier = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, u: number) => {
  const v = 1 - u;
  return new Vector3()
    .addScaledVector(a, v * v * v)
    .addScaledVector(b, 3 * v * v * u)
    .addScaledVector(c, 3 * v * u * u)
    .addScaledVector(d, u * u * u);
};

export type AssemblyPose = { pos: Vector3; quat: Quaternion; visible: boolean; glow: number };

/** Pose of a cube at (possibly fractional) frame f. */
export const assemblyPose = (c: AssemblyCube, f: number): AssemblyPose => {
  const glow = c.glowBase * (0.84 + 0.16 * Math.sin((Math.PI * 2 * f) / c.pulsePeriod + c.pulsePhase));
  if (f < c.start) return { pos: c.p0.clone(), quat: new Quaternion(), visible: false, glow };
  if (f < c.arrive) {
    const s = (f - c.start) / (c.arrive - c.start);
    const u = 1 - Math.pow(1 - s, 2.6);
    const pos = bezier(c.p0, c.p1, c.p2, c.home, u);
    const quat = new Quaternion().setFromAxisAngle(c.spinAxis, c.spinAngle * Math.pow(1 - u, 2));
    return { pos, quat, visible: true, glow };
  }
  const tau = f - c.arrive;
  const pos = c.home.clone();
  if (tau < SETTLE_FRAMES) {
    // decaying overshoot along the direction of travel (into the slot), then exactly still
    const w = 1 - tau / SETTLE_FRAMES;
    const o = OVERSHOOT_AMP * Math.sin((Math.PI * tau) / 6) * Math.exp(-tau / 5) * w * w;
    pos.addScaledVector(c.approach, -o);
  }
  return { pos, quat: new Quaternion(), visible: true, glow };
};

// ── geometry tests used while building ──────────────────────────────────────
const UNIT_AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];

/** Separating-axis test for two unit cubes. Returns penetration depth (> -margin ⇒ too close). */
export const cubeOverlap = (pa: Vector3, qa: Quaternion, pb: Vector3, qb: Quaternion, h = 0.5): number => {
  const ax = UNIT_AXES.map((v) => v.clone().applyQuaternion(qa));
  const bx = UNIT_AXES.map((v) => v.clone().applyQuaternion(qb));
  const d = pb.clone().sub(pa);
  const axes: Vector3[] = [...ax, ...bx];
  for (const u of ax)
    for (const v of bx) {
      const c = u.clone().cross(v);
      if (c.lengthSq() > 1e-10) axes.push(c.normalize());
    }
  let minPen = Infinity;
  for (const L of axes) {
    let ra = 0;
    let rb = 0;
    for (const u of ax) ra += h * Math.abs(u.dot(L));
    for (const u of bx) rb += h * Math.abs(u.dot(L));
    const pen = ra + rb - Math.abs(d.dot(L));
    if (pen <= 0) return pen;
    minPen = Math.min(minPen, pen);
  }
  return minPen;
};

const lowestCorner = (p: Vector3, q: Quaternion) => {
  let m = Infinity;
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      for (const z of [-0.5, 0.5]) m = Math.min(m, new Vector3(x, y, z).applyQuaternion(q).y + p.y);
  return m;
};

const projCam = new PerspectiveCamera(CAM_FOV, 16 / 9, 0.1, 200);
const startsOffScreen = (c: AssemblyCube) => {
  projCam.position.copy(assemblyCamera(c.start));
  projCam.lookAt(CAM_TARGET);
  projCam.updateMatrixWorld();
  if (c.p0.clone().applyMatrix4(projCam.matrixWorldInverse).z > -0.5) return true; // behind / beside the lens
  const v = c.p0.clone().project(projCam);
  return Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.2;
};

const STEP = 1 / 8; // sub-frame sampling so fast cubes cannot skip past each other
const CLEARANCE = 0.02; // required gap between any two cubes, world units

/** True if candidate `c` stays clear of every cube in `placed` and of the floor. */
const flightIsClear = (c: AssemblyCube, placed: AssemblyCube[]) => {
  const end = c.arrive + SETTLE_FRAMES;
  for (let f = c.start; f <= end; f += STEP) {
    const a = assemblyPose(c, f);
    if (f < c.arrive && lowestCorner(a.pos, a.quat) < 0.01) return false;
    for (const o of placed) {
      if (f < o.start) continue;
      const b = assemblyPose(o, f);
      if (a.pos.distanceToSquared(b.pos) > 3.2) continue; // bounding spheres (r = 0.87) can't touch
      if (cubeOverlap(a.pos, a.quat, b.pos, b.quat) > -CLEARANCE) return false;
    }
  }
  // also: once this cube sits in its slot, later-planned cubes test against it
  return true;
};

const generate = (): AssemblyCube[] => {
  const rng = mulberry32(0x61_73_6d_62); // "asmb"
  const slots: { s: [number, number, number]; order: number }[] = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      for (let k = 0; k < N; k++) {
        const r = Math.hypot(i - 1.5, k - 1.5); // 0.71, 1.58, 2.12
        // bottom layer first, inner before outer; jitter never reorders across rings
        slots.push({ s: [i, j, k], order: j * 10 + r + range(rng, 0, 0.3) });
      }
  slots.sort((a, b) => a.order - b.order);
  const types = assignTypes(rng, slots.length);
  // the two opening streakers are glowing cubes (swapped within the list, so
  // the 40/30/15/15 mix is unchanged)
  for (const first of [0, 1]) {
    if (types[first] === "glow") continue;
    const j = types.findIndex((t, k) => k > 1 && t === "glow");
    [types[first], types[j]] = [types[j], types[first]];
  }

  const n = slots.length;
  const placed: AssemblyCube[] = [];
  let prevArrive = 0;
  slots.forEach(({ s: [i, j, k] }, idx) => {
    const home = slotCenter(i, j, k);
    const planned = Math.round(FIRST_ARRIVAL + (LAST_ARRIVAL - 6 - FIRST_ARRIVAL) * Math.pow(idx / (n - 1), 0.92));
    let arrive = Math.max(planned, prevArrive);
    const type = types[idx];
    const tone: Tone = type === "glow" ? (rng() < 0.12 ? "accent" : pick(rng, [0, 0, 1, 1, 2] as const)) : 1;
    const glowBase = type === "glow" ? range(rng, 0.8, 1.15) : type === "frosted" ? range(rng, 0.7, 1.2) : 1;
    const pulsePeriod = range(rng, 55, 110);
    const pulsePhase = range(rng, 0, Math.PI * 2);

    const faces: Vector3[] = [];
    if (i === 0) faces.push(new Vector3(-1, 0, 0));
    if (i === N - 1) faces.push(new Vector3(1, 0, 0));
    if (k === 0) faces.push(new Vector3(0, 0, -1));
    if (k === N - 1) faces.push(new Vector3(0, 0, 1));

    let chosen: AssemblyCube | null = null;
    for (let attempt = 0; attempt < 400 && !chosen; attempt++) {
      // every 25 failed draws, let this cube (and all after it) arrive a frame later
      if (attempt > 0 && attempt % 25 === 0 && arrive < LAST_ARRIVAL) arrive++;

      const approach = faces.length > 0 && rng() < 0.45 ? pick(rng, faces).clone() : new Vector3(0, 1, 0);
      let origin: AssemblyCube["origin"];
      if (idx < 2) origin = "camera";
      else {
        const r = rng();
        origin = r < 0.45 ? "above" : r < 0.9 ? "side" : "camera";
      }
      let p0: Vector3;
      if (origin === "camera") {
        // the first two streak past right beside the lens; later ones keep their distance
        const side = idx === 0 ? 1 : idx === 1 ? -1 : rng() < 0.5 ? 1 : -1;
        const near = idx < 2;
        p0 = CAM0.clone()
          .addScaledVector(camFwd, -range(rng, 3, 6))
          .addScaledVector(camRight, side * (near ? range(rng, 2.4, 3.2) : range(rng, 4.5, 6)))
          .addScaledVector(camUp, near ? range(rng, -0.6, 0.8) : range(rng, 1.5, 3));
      } else if (origin === "above") {
        p0 = new Vector3(range(rng, -5, 5), range(rng, 15, 19), range(rng, -7, 3));
      } else {
        const side = rng() < 0.5 ? 1 : -1;
        p0 = CAM_TARGET.clone()
          .addScaledVector(camRight, side * range(rng, 15, 19))
          .addScaledVector(camFwd, range(rng, -3, 7));
        p0.y = range(rng, 1.5, 7);
      }
      const legLen = approach.y > 0 ? range(rng, 2.6, 3.6) : range(rng, 2.4, 3.4);
      const p2 = home.clone().addScaledVector(approach, legLen);
      // seeded control point: midway, pushed sideways and kept above the build
      const lateral = new Vector3(range(rng, -1, 1), 0, range(rng, -1, 1)).normalize().multiplyScalar(range(rng, 1.5, 4));
      const p1 = p0.clone().lerp(p2, 0.5).add(lateral);
      p1.y = Math.max(p1.y, home.y + 2.8, 0.5 + FLOOR_GAP + N * PITCH + 1.2);
      const dur = idx < 2 ? 30 : Math.round(range(rng, 24, 48));

      const cand: AssemblyCube = {
        id: idx,
        type,
        tone,
        slot: [i, j, k],
        home,
        approach,
        p0,
        p1,
        p2,
        start: Math.max(2, arrive - dur),
        arrive,
        spinAxis: new Vector3(range(rng, -1, 1), range(rng, -1, 1), range(rng, -1, 1)).normalize(),
        spinAngle: range(rng, 0.9, 2.2),
        origin,
        glowBase,
        pulsePeriod,
        pulsePhase,
      };
      if (startsOffScreen(cand) && flightIsClear(cand, placed)) chosen = cand;
    }
    if (!chosen) throw new Error(`Cube assembly: no clear flight found for slot ${i},${j},${k}`);
    placed.push(chosen);
    prevArrive = chosen.arrive;
  });
  return placed;
};

export const CUBES: AssemblyCube[] = generate();
export const ALL_ARRIVED = Math.max(...CUBES.map((c) => c.arrive));
export const ALL_STILL = ALL_ARRIVED + SETTLE_FRAMES;
