// The tumble, written out as closed-form motion: pose = f(frame).
//
// No physics engine and no state carried between frames, so Remotion can
// render any frame, in any order, on any thread and get the same pixels.
//
// Each cube:
//   1. drops in from above and outside the frame, already turning
//   2. lands on an edge and rolls over it 1-3 times; every roll is exactly
//      90 degrees around the (rounded) edge touching the paper
//   3. rocks back and forth once or twice (amp * e^(-k t) * sin(w t))
//   4. rests perfectly still, flat, in the row
//
// The roll sequence is solved backwards from the final pose (target letter
// on top, upright), so the right letter always ends up facing the camera.

import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { AcronymRow } from "../data/acronyms";
import { pick, range, seeded, signed } from "./prng";
import {
  ALL_STILL_BY_FRAME,
  BEVEL,
  CUBE,
  FIRST_DROP_FRAME,
  ROW_PITCH,
} from "./world";

const DEG = Math.PI / 180;
const HALF = CUBE / 2;
// A rounded cube rolls a little less than one edge length per 90 degrees.
export const ROLL_ADVANCE = CUBE - 2 * BEVEL + (Math.PI / 2) * BEVEL;
// Speed profile inside each roll: slow while the centre of mass passes over
// the edge, fast as the face slaps down.
const WARP = 0.32;

export type CubePlan = {
  index: number;
  char: string;
  restX: number;
  dir: 1 | -1; // rolls towards +z (comes in from the top of frame) or -z
  rolls: number;
  tStart: number; // first frame the cube exists (outside the frame)
  tLand: number; // touches the paper on an edge
  tRollEnd: number; // last roll slaps flat
  tRest: number; // perfectly still from here on
  thetaLand: number; // degrees into the first roll at touch-down
  omega0: number; // deg/frame at touch-down
  omegaEnd: number; // deg/frame when the last roll lands
  settleOmega: number; // rad/frame
  settleK: number; // 1/frame
  air: {
    height: number;
    back: number; // distance travelled along the roll direction in the air
    lateral: number;
    yaw: number; // extra spin about vertical while airborne (deg)
    tilt: number; // extra tilt about the roll direction while airborne (deg)
  };
};

export type CubePose = {
  position: Vector3;
  quaternion: Quaternion;
  visible: boolean;
  lift: number; // height of the lowest point above the paper
  phase: "hidden" | "air" | "roll" | "settle" | "rest";
};

// --- plan -----------------------------------------------------------------

const rollTime = (rolls: number, thetaLand: number, w0: number, w1: number) =>
  (2 * (rolls * 90 - thetaLand)) / (w0 + w1);

export const planCubes = (row: AcronymRow): CubePlan[] => {
  const chars = [...row.id];
  const n = chars.length;
  const rng = seeded(row.id, row.seed, "tumble");
  const stagger = n >= 4 ? 11 : 13.5;

  // Roll counts: random 1-3, but never all the same.
  let rollCounts = chars.map(() => 1 + Math.floor(rng() * 3));
  if (rollCounts.every((r) => r === rollCounts[0])) {
    rollCounts = rollCounts.map((r, i) => (i % 2 === 1 ? 1 + (r % 3) : r));
  }
  // Mostly thrown in from the top edge, like the reference; at most one cube
  // per row comes in from the bottom edge.
  const fromBottom = rng() < 0.55 ? Math.floor(rng() * n) : -1;

  return chars.map((char, i) => {
    const r = seeded(row.id, row.seed, "cube", i);
    const rolls = rollCounts[i];
    const dir: 1 | -1 = i === fromBottom ? -1 : 1;
    const tStart = FIRST_DROP_FRAME + i * stagger + Math.floor(range(r, 0, 3.5));
    const airFrames = Math.round(range(r, 15, 19));
    const tLand = tStart + airFrames;
    const thetaLand = range(r, 18, 32);
    const omega0 = 11 + 2.6 * rolls + range(r, -1.2, 1.2);
    const omegaEnd = range(r, 2.4, 3.1);
    const tRollEnd = tLand + rollTime(rolls, thetaLand, omega0, omegaEnd);
    // Settle: one or two quick rocks that die away well before frame 120.
    const settleOmega = (2 * Math.PI) / range(r, 7.5, 9.5);
    const tRest = Math.min(tRollEnd + 26, ALL_STILL_BY_FRAME - 4);
    const amp = (omegaEnd * (1 + WARP)) / settleOmega; // degrees
    // Decay so the remaining swing is < 0.004 deg at tRest.
    const settleK = Math.log(amp / 0.004) / (tRest - tRollEnd);
    return {
      index: i,
      char,
      restX: (i - (n - 1) / 2) * ROW_PITCH,
      dir,
      rolls,
      tStart,
      tLand,
      tRollEnd,
      tRest,
      thetaLand,
      omega0,
      omegaEnd,
      settleOmega,
      settleK,
      air: {
        height: range(r, 1.5, 2.1),
        back: range(r, 3.2, 4.2) + (dir === -1 ? 0.8 : 0),
        lateral: range(r, 0.3, 1.2) * signed(r) * (i === 0 || i === n - 1 ? 1 : 0.6) +
          (i - (n - 1) / 2) * 0.35,
        yaw: range(r, 25, 65) * signed(r),
        tilt: range(r, 12, 35) * signed(r),
      },
    };
  });
};

// --- roll geometry -----------------------------------------------------------

const rollAxis = (dir: 1 | -1) => new Vector3(dir, 0, 0); // Y x (0,0,dir)

// Warp a linear roll angle so each 90 degree roll is slow near the top
// (balanced on the edge) and fast as it falls flat. Exact at multiples of 90.
const warpTheta = (theta: number) => {
  const k = Math.floor(theta / 90);
  const p = theta / 90 - k;
  return 90 * (k + p + (WARP * Math.sin(2 * Math.PI * p)) / (2 * Math.PI));
};

// Pose of a cube that is rolling along z with its rounded edge touching the
// paper, at total roll angle theta (deg). theta = 90*rolls is the final pose.
const rollPose = (plan: CubePlan, theta: number) => {
  const { dir, rolls } = plan;
  const axis = rollAxis(dir);
  const z0 = -dir * rolls * ROLL_ADVANCE; // centre z before the first roll
  const k = Math.floor(theta / 90);
  const a = theta - 90 * k; // angle inside the current roll
  const zk = z0 + dir * k * ROLL_ADVANCE;
  const h = HALF - BEVEL;
  // Axis of the rounded edge: a cylinder of radius BEVEL resting on the
  // paper, rolling without slipping as the cube turns over it.
  const pivot = new Vector3(plan.restX, BEVEL, zk + dir * h + dir * BEVEL * a * DEG);
  const rel = new Vector3(0, h, -dir * h).applyAxisAngle(axis, a * DEG);
  const position = pivot.add(rel);
  const quaternion = new Quaternion().setFromAxisAngle(axis, (theta - 90 * rolls) * DEG);
  return { position, quaternion };
};

// Lowest point of the rounded cube below its centre, for a given orientation.
export const supportHeight = (q: Quaternion) => {
  const m = new Matrix4().makeRotationFromQuaternion(q).elements;
  // Row 1 (world y) of the rotation matrix: elements 1, 5, 9 (column-major).
  return (HALF - BEVEL) * (Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9])) + BEVEL;
};

// --- the motion -------------------------------------------------------------

const linearTheta = (plan: CubePlan, t: number) => {
  // Constant deceleration from omega0 to omegaEnd across all rolls.
  const T = plan.tRollEnd - plan.tLand;
  const alpha = (plan.omega0 - plan.omegaEnd) / T;
  const tau = Math.min(Math.max(t - plan.tLand, 0), T);
  return plan.thetaLand + plan.omega0 * tau - 0.5 * alpha * tau * tau;
};

export const poseAt = (plan: CubePlan, frame: number): CubePose => {
  const t = frame;
  const finalTheta = 90 * plan.rolls;

  if (t < plan.tStart) {
    const p = rollPose(plan, finalTheta);
    return { ...p, visible: false, lift: 0, phase: "hidden" };
  }

  if (t >= plan.tRest) {
    return {
      position: new Vector3(plan.restX, HALF, 0),
      quaternion: new Quaternion(),
      visible: true,
      lift: 0,
      phase: "rest",
    };
  }

  if (t >= plan.tRollEnd) {
    const tau = t - plan.tRollEnd;
    const amp = (plan.omegaEnd * (1 + WARP)) / plan.settleOmega;
    const e = amp * Math.exp(-plan.settleK * tau) * Math.sin(plan.settleOmega * tau);
    const p = rollPose(plan, finalTheta + e);
    return { ...p, visible: true, lift: 0, phase: "settle" };
  }

  if (t >= plan.tLand) {
    const p = rollPose(plan, warpTheta(linearTheta(plan, t)));
    return { ...p, visible: true, lift: 0, phase: "roll" };
  }

  // Airborne: keep turning at the touch-down rate, plus an extra spin that
  // unwinds exactly at touch-down, along a falling arc from outside the frame.
  const airT = plan.tLand - plan.tStart;
  const u = (plan.tLand - t) / airT; // 1 at start, 0 at touch-down
  const omegaAir = plan.omega0 * 1.15;
  const theta = plan.thetaLand - omegaAir * (plan.tLand - t);
  const base = rollPose(plan, warpTheta(theta));
  const spin = new Quaternion().setFromEuler(
    new Euler(0, plan.air.yaw * u * u * DEG, plan.air.tilt * u * u * DEG, "YXZ"),
  );
  const quaternion = spin.multiply(base.quaternion);
  const position = base.position.add(
    new Vector3(
      plan.air.lateral * u,
      plan.air.height * (2 * u - u * u),
      -plan.dir * plan.air.back * u,
    ),
  );
  const minY = supportHeight(quaternion);
  if (position.y < minY) position.y = minY;
  return {
    position,
    quaternion,
    visible: true,
    lift: position.y - minY,
    phase: "air",
  };
};

// Face order matches BoxGeometry material groups: +x, -x, +y, -y, +z, -z.
export const FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];
export const TOP_FACE = 2;

export const lastMotionFrame = (plans: CubePlan[]) =>
  Math.max(...plans.map((p) => p.tRest));

// A frame where at least one cube is clearly in the air and inside the frame
// is chosen by the stills script; this helper reports airborne cubes.
export const airborneAt = (plans: CubePlan[], frame: number) =>
  plans
    .map((p) => ({ plan: p, pose: poseAt(p, frame) }))
    .filter(({ pose }) => pose.phase === "air");

export { pick };
