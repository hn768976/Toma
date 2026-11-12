// Side-view 2D walk rig for an original adult woman, ~7.5 heads tall.
// The pelvis moves at constant speed; feet are planted (no sliding): each
// stance foot rolls heel -> flat -> ball, swing feet travel on an arc, legs
// are solved with 2-bone IK, and the pelvis height comes from the stance
// leg length (so the body bobs: low at double support, high at passing).
// Arms swing opposite to the legs.

import type { Pt } from "../lib/math";
import { clamp, lerp, smoothstep } from "../lib/math";

export const CYCLE = 60; // frames per step pair (one stride)
export const STEP_FRAMES = CYCLE / 2;

export type Bone = { a: Pt; b: Pt; wa: number; wb: number; name: string; depth: number };
export type Pose = {
  parts: { name: string; pts: Pt[]; depth: number }[];
  bones: Bone[]; // for coil / blob styles
  head: { c: Pt; r: number };
  bbox: [number, number, number, number];
};

export type RigConfig = {
  height: number; // figure height in px
  groundY: number;
  x0: number; // pelvis x at t=0
  x1: number; // pelvis x at t=tEnd
  tEnd: number; // frames
};

const rotP = ([x, y]: Pt, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const scl = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const DEG = Math.PI / 180;

const ik = (hip: Pt, ankle: Pt, L1: number, L2: number): Pt => {
  const dv = sub(ankle, hip);
  let d = len(dv);
  d = clamp(d, Math.abs(L1 - L2) + 1, L1 + L2 - 0.5);
  const th = Math.atan2(dv[1], dv[0]);
  const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const k1: Pt = add(hip, [Math.cos(th - al) * L1, Math.sin(th - al) * L1]);
  const k2: Pt = add(hip, [Math.cos(th + al) * L1, Math.sin(th + al) * L1]);
  // knee points forward (+x, she walks to the right)
  return k1[0] > k2[0] ? k1 : k2;
};

// Tapered limb outline along a polyline of joints with per-joint front/back
// half widths (front = +normal side facing walking direction).
const limb = (joints: Pt[], front: number[], back: number[]): Pt[] => {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < joints.length; i++) {
    const p = joints[i];
    const q = joints[Math.min(joints.length - 1, i + 1)];
    const o = joints[Math.max(0, i - 1)];
    const t = sub(q, o);
    const L = len(t) || 1;
    // "front" = the side that faces +x when the bone points straight down
    const nf: Pt = [t[1] / L, -t[0] / L];
    left.push(add(p, scl(nf, front[i])));
    right.push(sub(p, scl(nf, back[i])));
  }
  return [...left, ...right.reverse()];
};

const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export const makeRig = (cfg: RigConfig) => {
  const h = cfg.height / 7.5; // head unit
  const L1 = 1.95 * h; // thigh
  const L2 = 1.68 * h; // shin
  const FH = 0.36 * h; // ankle height above sole
  const FL = 1.02 * h; // foot length
  const UA = 1.42 * h;
  const FA = 1.2 * h;
  const v = (cfg.x1 - cfg.x0) / cfg.tEnd; // px per frame
  const S = v * STEP_FRAMES; // step length
  const heelLocal: Pt = [-0.2 * FL, FH];
  const ballLocal: Pt = [0.6 * FL, FH];

  const X = (t: number) => cfg.x0 + v * t;

  // foot state for a foot whose heel strikes at phases k + ph
  const foot = (t: number, ph: number) => {
    const u0 = t / CYCLE - ph;
    const k = Math.floor(u0);
    const u = u0 - k; // 0..1 since last heel strike
    const tStrike = (k + ph) * CYCLE;
    const plantAnkle = (ts: number): Pt => [X(ts) + 0.55 * S, cfg.groundY - FH];
    const A0 = plantAnkle(tStrike);
    const A1 = plantAnkle(tStrike + CYCLE);
    const strikeAng = -28 * DEG;
    const offAng = 38 * DEG;
    let ankle: Pt;
    let ang: number;
    if (u < 0.14) {
      // heel strike -> foot flat, pivot on the heel
      ang = lerp(strikeAng, 0, smoothstep(0, 0.14, u));
      const heel = add(A0, heelLocal);
      ankle = sub(heel, rotP(heelLocal, ang));
    } else if (u < 0.42) {
      ang = 0;
      ankle = A0;
    } else if (u < 0.62) {
      // heel off, roll over the ball of the foot
      ang = lerp(0, offAng, smoothstep(0.42, 0.62, u));
      const ball = add(A0, ballLocal);
      ankle = sub(ball, rotP(ballLocal, ang));
    } else {
      // swing: from toe-off to next heel strike on an arc
      const s = (u - 0.62) / 0.38;
      const ballOff = add(A0, ballLocal);
      const startAnkle = sub(ballOff, rotP(ballLocal, offAng));
      const heelNext = add(A1, heelLocal);
      const endAnkle = sub(heelNext, rotP(heelLocal, strikeAng));
      const e = s * s * (3 - 2 * s) * 0.85 + s * 0.15;
      ankle = lerpPt(startAnkle, endAnkle, e);
      ankle[1] -= Math.sin(Math.PI * Math.pow(s, 0.7)) * 0.36 * h;
      ang = s < 0.55 ? lerp(offAng, -4 * DEG, smoothstep(0, 0.55, s)) : lerp(-4 * DEG, strikeAng, smoothstep(0.55, 0.95, s));
    }
    return { ankle, ang, u };
  };

  const pose = (t: number): Pose => {
    const R = foot(t, 0); // near (right) leg
    const Lf = foot(t, 0.5); // far (left) leg
    const px = X(t);
    // pelvis height: highest point where a stance leg stays nearly straight
    const reach = (L1 + L2) * 0.993;
    let hipY = -Infinity;
    for (const f of [R, Lf]) {
      if (f.u < 0.62) {
        const dx = px - f.ankle[0];
        const y = f.ankle[1] - Math.sqrt(Math.max(0, reach * reach - dx * dx));
        hipY = Math.max(hipY, y);
      }
    }
    // loading-response dip just after each heel strike ("down" pose)
    const sp = (t % STEP_FRAMES) / STEP_FRAMES; // 0 = a heel strike
    const bob = 0.5 + 0.5 * Math.cos(2 * Math.PI * (sp - 0.12));
    hipY += bob * 0.13 * h;
    const hip: Pt = [px, hipY];

    const legParts = (f: { ankle: Pt; ang: number; u: number }, depth: number, name: string) => {
      const knee = ik(hip, f.ankle, L1, L2);
      const heel = add(f.ankle, rotP(heelLocal, f.ang));
      const ball = add(f.ankle, rotP(ballLocal, f.ang));
      const toeAng = f.ang > 0 && f.u < 0.62 ? 0 : f.ang;
      const toe = add(ball, rotP([0.3 * FL, -0.12 * FH], toeAng));
      const instep = add(f.ankle, rotP([0.35 * FL, FH * 0.15], f.ang));
      const thighMid = lerpPt(hip, knee, 0.45);
      const calf = lerpPt(knee, f.ankle, 0.3);
      const leg = limb(
        [hip, thighMid, knee, calf, f.ankle],
        [0.38 * h, 0.28 * h, 0.17 * h, 0.15 * h, 0.105 * h],
        [0.36 * h, 0.28 * h, 0.17 * h, 0.22 * h, 0.1 * h],
      );
      const soleBack = add(f.ankle, rotP([-0.23 * FL, FH * 0.8], f.ang));
      const footPoly: Pt[] = [
        add(f.ankle, rotP([-0.1 * FL, -0.2 * FH], f.ang)),
        add(f.ankle, rotP([0.12 * FL, -0.12 * FH], f.ang)),
        instep,
        add(f.ankle, rotP([0.6 * FL, FH * 0.5], f.ang)),
        add(ball, rotP([0.12 * FL, -0.38 * FH], toeAng)),
        add(ball, rotP([0.24 * FL, -0.3 * FH], toeAng)),
        toe,
        add(ball, rotP([0.2 * FL, 0], toeAng)),
        ball,
        add(heel, rotP([0.05 * FL, 0.02 * FH], f.ang)),
        soleBack,
      ];
      const thighAng = Math.atan2(knee[0] - hip[0], knee[1] - hip[1]);
      return {
        parts: [
          { name: `${name}-leg`, pts: leg, depth },
          { name: `${name}-foot`, pts: footPoly, depth },
        ],
        bones: [
          { a: hip, b: knee, wa: 0.62 * h, wb: 0.34 * h, name: `${name}-thigh`, depth },
          { a: knee, b: f.ankle, wa: 0.32 * h, wb: 0.17 * h, name: `${name}-shin`, depth },
          { a: heel, b: toe, wa: 0.25 * h, wb: 0.12 * h, name: `${name}-foot`, depth },
        ] as Bone[],
        thighAng,
      };
    };
    const legR = legParts(R, 1, "r");
    const legL = legParts(Lf, -1, "l");

    // torso, neck, head as one profile outline (heights in head units above hip)
    const lean = (4.5 + 0.6 * Math.cos(2 * Math.PI * (sp - 0.2))) * DEG;
    const T = (x: number, y: number): Pt => {
      const q = rotP([(x + 0.07) * h, -y * h], lean);
      return [hip[0] + q[0], hip[1] + q[1]];
    };
    // head bobs a little less than the pelvis (neck absorbs some)
    const torso: Pt[] = [
      T(0.12, -0.32), T(0.36, 0.05), T(0.37, 0.45), T(0.32, 0.85), T(0.4, 1.2),
      T(0.66, 1.42), T(0.62, 1.62), T(0.48, 1.85), T(0.3, 2.12), T(0.2, 2.3),
      // head (profile, facing right)
      T(0.27, 2.47), T(0.37, 2.55), T(0.4, 2.65), T(0.44, 2.7), T(0.4, 2.76), T(0.49, 2.86),
      T(0.42, 2.98), T(0.4, 3.12), T(0.3, 3.3), T(0.1, 3.47), T(-0.15, 3.48),
      // bun at the back of the head
      T(-0.3, 3.5), T(-0.48, 3.42), T(-0.55, 3.25), T(-0.47, 3.08),
      T(-0.46, 2.9), T(-0.42, 2.72), T(-0.3, 2.56), T(-0.2, 2.4),
      // back
      T(-0.3, 2.05), T(-0.46, 1.72), T(-0.44, 1.3), T(-0.36, 0.86), T(-0.44, 0.42),
      T(-0.53, 0.05), T(-0.47, -0.25), T(-0.3, -0.38),
    ];
    const head = { c: T(0.02, 2.98), r: 0.5 * h };

    // arms: swing opposite to the same-side leg
    const shoulder = T(-0.1, 2.1);
    const armParts = (legPhase: number, depth: number, name: string) => {
      // arm is furthest forward when the same-side leg is furthest back (toe-off)
      const sw = -5 * DEG + 20 * DEG * Math.cos(2 * Math.PI * (legPhase - 0.55));
      const ua = sw;
      const elbow = add(shoulder, rotP([0, UA], -ua));
      const flex = (10 + 20 * clamp(sw / (20 * DEG), 0, 1)) * DEG;
      const fa = ua + flex;
      const wrist = add(elbow, rotP([0, FA], -fa));
      const hand = add(wrist, rotP([0, 0.62 * h], -(fa + 6 * DEG)));
      const arm = limb([shoulder, lerpPt(shoulder, elbow, 0.5), elbow, wrist], [0.26 * h, 0.19 * h, 0.13 * h, 0.08 * h], [0.25 * h, 0.18 * h, 0.13 * h, 0.08 * h]);
      const handPoly = limb([lerpPt(elbow, wrist, 0.85), wrist, lerpPt(wrist, hand, 0.45), hand], [0.07 * h, 0.075 * h, 0.085 * h, 0.03 * h], [0.07 * h, 0.075 * h, 0.075 * h, 0.03 * h]);
      return {
        parts: [
          { name: `${name}-arm`, pts: arm, depth },
          { name: `${name}-hand`, pts: handPoly, depth },
        ],
        bones: [
          { a: shoulder, b: elbow, wa: 0.4 * h, wb: 0.26 * h, name: `${name}-upper`, depth },
          { a: elbow, b: wrist, wa: 0.24 * h, wb: 0.15 * h, name: `${name}-fore`, depth },
          { a: wrist, b: hand, wa: 0.16 * h, wb: 0.12 * h, name: `${name}-hand`, depth },
        ] as Bone[],
      };
    };
    const armR = armParts(R.u, 2, "r");
    const armL = armParts(Lf.u, -2, "l");

    const parts = [
      ...armL.parts,
      ...legL.parts,
      { name: "torso", pts: torso, depth: 0 },
      ...legR.parts,
      ...armR.parts,
    ];
    const bones: Bone[] = [
      ...armL.bones,
      ...legL.bones,
      { a: T(0, -0.1), b: T(0, 0.9), wa: 1.05 * h, wb: 0.85 * h, name: "pelvis", depth: 0 },
      { a: T(0.05, 0.9), b: T(0.05, 1.95), wa: 0.9 * h, wb: 1.0 * h, name: "chest", depth: 0 },
      { a: T(0.05, 1.95), b: T(0.12, 2.45), wa: 0.4 * h, wb: 0.36 * h, name: "neck", depth: 0 },
      ...legR.bones,
      ...armR.bones,
    ];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of parts) for (const [x, y] of p.pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { parts, bones, head, bbox: [x0, y0, x1, y1] };
  };

  return { pose, h, S };
};
