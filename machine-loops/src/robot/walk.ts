// Walk cycle, walking in place (treadmill style). One step pair = 30 frames.
//
// Feet are driven by ground contact, legs by two-bone IK, so a planted foot
// moves backward at exactly the constant ground speed and never slides
// relative to it. Pelvis bob: down just after each contact, up after passing.
import { TAU } from "../lib/random";
import { DIM, Rig } from "./robot";

export const CYCLE = 30;
const STANCE = 0.56; // fraction of the cycle a foot is on the ground
const STRIDE = 0.82; // distance the ground moves during one stance
const HEEL_PITCH = 0.42; // toe-up at heel strike (rad)
const TOE_PITCH = -0.62; // heel-up at toe-off (rad)
const LIFT = 0.08;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Ground position (z) of a point that touched down at u=0 at z0.
const GROUND_C = -0.14; // centre of the stance slide relative to the hip
const groundZ = (u: number) => GROUND_C + STRIDE / 2 - (STRIDE * u) / STANCE;

type FootPose = { y: number; z: number; pitch: number }; // ankle centre, foot pitch (+ = toe up)

// Ankle pose for a foot pivoting about a contact point on the sole.
const pivotPose = (pivotZ: number, pivotRel: number, pitch: number): FootPose => {
  // vector from pivot (on the sole) to ankle, in foot space: (dz = -pivotRel, dy = ankleH)
  const dz = -pivotRel;
  const dy = DIM.ankleH;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  // toe-up pitch rotates the foot so +z goes up
  return { z: pivotZ + dz * c - dy * s, y: dz * s + dy * c, pitch };
};

const HEEL_ROLL = 0.12; // u where the foot is flat after heel strike
const TOE_START = 0.36; // u where the heel starts to lift

const stancePose = (u: number): FootPose => {
  // heel touches the ground at z = STRIDE/2 + heelZ offset; treat the ground
  // point under the heel as moving with the ground.
  const heelGround = groundZ(u);
  if (u < HEEL_ROLL) {
    const p = HEEL_PITCH * (1 - smooth(u / HEEL_ROLL));
    return pivotPose(heelGround, DIM.heelZ, p);
  }
  if (u < TOE_START) return pivotPose(heelGround, DIM.heelZ, 0);
  const t = (u - TOE_START) / (STANCE - TOE_START);
  const p = TOE_PITCH * t * t;
  const toeGround = heelGround + (DIM.toeZ - DIM.heelZ);
  return pivotPose(toeGround, DIM.toeZ, p);
};

const footPose = (u: number): FootPose => {
  u = ((u % 1) + 1) % 1;
  if (u < STANCE) return stancePose(u);
  const a = stancePose(STANCE - 1e-6);
  const b = stancePose(0);
  const t = (u - STANCE) / (1 - STANCE);
  // forward travel eased over the whole swing so the heel lands on the contact frame
  const z = mix(a.z, b.z, smooth(t));
  // stays clear of the ground until the heel strike (no early touch-down)
  const lift = LIFT * Math.pow(Math.sin(Math.PI * t), 0.6);
  const y = mix(a.y, b.y, t) + lift;
  const pitch = mix(a.pitch, b.pitch, smooth(clamp01(t * 1.15)));
  return { y, z, pitch };
};

// Pelvis height over the cycle: two bobs per step pair, lowest ~3 frames
// after each contact (the "down"), highest ~11 frames after (the "up").
const pelvisY = (frame: number) => {
  const t = (frame % 15) / 15;
  return DIM.pelvisY - 0.028 * Math.cos(TAU * (t - 0.2));
};

const ik = (hipY: number, hipZ: number, ankle: FootPose) => {
  const a = DIM.thigh;
  const b = DIM.shin;
  const dy = ankle.y - hipY;
  const dz = ankle.z - hipZ;
  let d = Math.hypot(dy, dz);
  d = Math.min(d, (a + b) * 0.9995);
  const base = Math.atan2(dz, -dy); // forward swing from straight down
  const alpha = Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const beta = Math.acos((a * a + b * b - d * d) / (2 * a * b));
  const thigh = base + alpha; // knee forward
  const knee = Math.PI - beta; // shin folds back
  return { thigh, knee };
};

export const poseRobot = (rig: Rig, frame: number) => {
  const f = ((frame % CYCLE) + CYCLE) % CYCLE;
  const u = f / CYCLE;
  const py = pelvisY(f);

  // weight shift toward the stance foot, and hip roll (swing side drops)
  const sway = 0.05 * Math.cos(TAU * (u - 0.3));
  const roll = 0.06 * Math.cos(TAU * (u - 0.3));
  const yawP = -0.18 * Math.cos(TAU * u); // left hip forward at left contact
  rig.pelvis.position.set(sway, py, 0);
  rig.pelvis.rotation.set(0, yawP, roll * 0.6, "YXZ"); // stance hip up, swing hip drops
  // torso counter-twists and leans a touch into the walk
  rig.torso.rotation.set(0.06 + 0.02 * Math.cos(TAU * 2 * (u - 0.1)), -yawP * 1.6, -roll * 0.9, "YXZ");
  // head lags the body by ~2 frames and stays level
  const lag = 2 / CYCLE;
  rig.head.rotation.set(-0.05 - 0.04 * Math.cos(TAU * 2 * (u - 0.2 - lag)), yawP * 0.6, roll * 0.3, "YXZ");
  rig.antenna.rotation.set(0.12 * Math.cos(TAU * 2 * (u - 0.2 - 2 * lag)), 0, -0.1 * Math.cos(TAU * (u - 0.3 - lag)));

  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const lu = u + (i === 0 ? 0 : 0.5);
    const foot = footPose(lu);
    // hip position follows the pelvis (yaw moves the hip fore/aft, roll moves it up/down)
    const hipZ = -side * DIM.hipX * Math.sin(yawP);
    const hipY = py + side * DIM.hipX * Math.sin(roll * 0.6);
    const { thigh, knee } = ik(hipY, hipZ, foot);
    const hip = rig.hip[i];
    hip.position.set(sway + side * DIM.hipX, hipY, hipZ);
    // lean the leg slightly so the foot stays under its own line
    hip.rotation.set(-thigh, 0, -Math.atan2(sway, py - 0.15), "ZXY");
    rig.knee[i].rotation.set(knee, 0, 0);
    rig.ankle[i].rotation.set(-(foot.pitch) - (-thigh + knee), 0, 0);

    // arms swing opposite to the leg on the same side, with a little drag
    const ph = TAU * (lu - 0.06);
    const swing = -0.5 * Math.cos(ph); // + = forward
    rig.shoulder[i].rotation.set(-swing, 0, side * 0.07, "ZXY");
    rig.elbow[i].rotation.set(-0.38 - 0.3 * Math.max(0, swing), 0, 0); // forearms held forward, toy-like
    rig.wrist[i].rotation.set(-0.1 - 0.1 * Math.cos(ph - 0.6), 0, 0);
  }
};

