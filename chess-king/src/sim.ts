import * as THREE from "three";
import { lyingPose, pieceCom, PieceType } from "./geometry";

export const FPS = 30;
// The reference clip is 8.04 s; 241 frames at 30 fps is the closest whole-frame match.
export const DURATION_IN_FRAMES = 241;

// Key beats of the timeline, in seconds.
export const T_KING_LAND = 0.64;
const GRAVITY = 45;

// Deterministic PRNG so every render worker computes identical motion.
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const smoother = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Playback rate of the "physics clock": real-time for the blast, a long
 * slow-motion hang while the pieces float, then back to real-time for the
 * crash.
 */
const rateAt = (t: number) => {
  if (t < T_KING_LAND) return 0;
  if (t < 0.76) return 1;
  if (t < 0.95) return lerp(1, 0.09, smooth((t - 0.76) / 0.19));
  if (t < 3.25) return 0.09;
  if (t < 3.75) return lerp(0.09, 1, smooth((t - 3.25) / 0.5));
  return 1;
};

const TAU_STEP = 1 / 1200;
const tauTable: number[] = [];
{
  let tau = 0;
  const end = DURATION_IN_FRAMES / FPS + 0.1;
  for (let i = 0; i * TAU_STEP <= end; i++) {
    tauTable.push(tau);
    tau += rateAt(i * TAU_STEP) * TAU_STEP;
  }
}
export const simTime = (t: number) => {
  const i = Math.max(0, Math.min(tauTable.length - 2, Math.floor(t / TAU_STEP)));
  const f = t / TAU_STEP - i;
  return lerp(tauTable[i], tauTable[i + 1], clamp01(f));
};

export type PieceSpec = {
  type: PieceType;
  start: THREE.Vector3; // COM position while standing
  startYaw: number;
  launchV: THREE.Vector3;
  tLand: number; // sim time of first ground contact
  contact: THREE.Vector3; // COM position at first contact
  slideDir: THREE.Vector3;
  slide: number;
  rollAxis: THREE.Vector3;
  rollRadius: number;
  bounce: number;
  qStart: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spinAngle: number;
  qRest: THREE.Quaternion;
  upright: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);

const buildPieces = (): PieceSpec[] => {
  const rnd = mulberry32(7);
  const types: PieceType[] = [
    "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook",
    "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn",
  ];

  // Standing crowd around the gold king.
  const starts: THREE.Vector2[] = [];
  const handStarts: [number, number][] = [
    [-2.9, 1.6], [-1.3, 2.2], [-1.0, 1.0], [1.15, 0.9], [1.6, -0.5], [0.8, 2.1],
    [-1.9, -0.3], [2.9, 1.9], [-0.4, 2.9], [2.1, 2.8], [-3.1, 2.8], [3.4, -0.9],
  ];
  handStarts.forEach(([x, z]) => starts.push(new THREE.Vector2(x, z)));
  while (starts.length < types.length) {
    const x = (rnd() - 0.5) * 9;
    const z = -3.8 + rnd() * 6.3;
    const p = new THREE.Vector2(x, z);
    if (p.length() < 1.1) continue;
    if (starts.some((s) => s.distanceTo(p) < 0.95)) continue;
    starts.push(p);
  }

  // Resting spots: hand-placed for the hero framing, the rest scattered.
  type Rest = { p: THREE.Vector2; yaw: number; upright: boolean };
  const rests: Rest[] = [
    { p: new THREE.Vector2(-2.0, 3.1), yaw: 2.4, upright: false },
    { p: new THREE.Vector2(1.75, 0.6), yaw: -1.2, upright: false },
    { p: new THREE.Vector2(-1.7, 0.7), yaw: 4.3, upright: false },
    { p: new THREE.Vector2(2.3, 2.9), yaw: 0.5, upright: false },
    { p: new THREE.Vector2(-3.2, 1.0), yaw: 0.4, upright: false },
    { p: new THREE.Vector2(0.9, -1.6), yaw: 0.15, upright: false },
    { p: new THREE.Vector2(-1.0, -1.7), yaw: 2.9, upright: false },
    { p: new THREE.Vector2(3.4, 0.0), yaw: -1.1, upright: false },
  ];
  const segOf = (r: Rest, len = 1.9) => {
    const d = new THREE.Vector2(Math.cos(r.yaw), -Math.sin(r.yaw));
    return r.upright
      ? [r.p.clone(), r.p.clone()]
      : [r.p.clone().addScaledVector(d, -len * 0.45), r.p.clone().addScaledVector(d, len * 0.55)];
  };
  const segDist = (a: THREE.Vector2[], b: THREE.Vector2[]) => {
    let m = Infinity;
    for (let i = 0; i <= 8; i++) {
      const pa = a[0].clone().lerp(a[1], i / 8);
      for (let j = 0; j <= 8; j++) {
        m = Math.min(m, pa.distanceTo(b[0].clone().lerp(b[1], j / 8)));
      }
    }
    return m;
  };
  let guard = 0;
  while (rests.length < types.length && guard++ < 20000) {
    const r: Rest = {
      p: new THREE.Vector2((rnd() - 0.5) * 10, -4.2 + rnd() * 7.0),
      yaw: rnd() * Math.PI * 2,
      upright: rnd() < 0.08,
    };
    const seg = segOf(r);
    if (segDist(seg, [new THREE.Vector2(), new THREE.Vector2()]) < 1.05) continue;
    // Keep the sight line from the camera to the king clear.
    if (segDist(seg, [new THREE.Vector2(0, -0.5), new THREE.Vector2(0, 6)]) < 1.1) continue;
    if (rests.some((o) => segDist(seg, segOf(o)) < 0.75)) continue;
    rests.push(r);
  }

  // Pair crowd positions with resting spots so pieces travel outward.
  const ang = (v: THREE.Vector2) => Math.atan2(v.y, v.x);
  const sortedStarts = [...starts].sort((a, b) => ang(a) - ang(b));
  const sortedRests = [...rests].sort((a, b) => ang(a.p) - ang(b.p));

  return types.map((type, i) => {
    const s2 = sortedStarts[i];
    const rest = sortedRests[i];
    const com = pieceCom(type);
    const startYaw = rnd() * Math.PI * 2;
    const qStart = new THREE.Quaternion().setFromAxisAngle(UP, startYaw);
    const start = new THREE.Vector3(s2.x, com.y, s2.y);

    let qRestLocal: THREE.Quaternion;
    let restComY: number;
    if (rest.upright) {
      qRestLocal = new THREE.Quaternion();
      restComY = com.y;
    } else {
      const lp = lyingPose(type, rnd() * Math.PI * 2);
      qRestLocal = lp.q;
      restComY = lp.comY;
    }
    const qRest = new THREE.Quaternion().setFromAxisAngle(UP, rest.yaw).multiply(qRestLocal);

    // Lying pieces roll perpendicular to their own axis after the impact.
    const axisWorld = new THREE.Vector3(0, 1, 0).applyQuaternion(qRest);
    axisWorld.y = 0;
    axisWorld.normalize();
    let slideDir = new THREE.Vector3().crossVectors(axisWorld, UP).normalize();
    const outward = new THREE.Vector3(rest.p.x, 0, rest.p.y).normalize();
    if (slideDir.dot(outward) < 0) slideDir.negate();
    if (rest.upright) slideDir = outward.clone();
    const slide = rest.upright ? 0.15 : 0.25 + rnd() * 0.45;
    const rollAxis = new THREE.Vector3().crossVectors(UP, slideDir).normalize();

    const contact = new THREE.Vector3(rest.p.x, restComY, rest.p.y).addScaledVector(slideDir, -slide);

    // Ballistic launch that peaks at `apex` and touches down at `contact`.
    const apex = 2.4 + rnd() * 1.4 + (s2.y > 2.5 ? 0.4 : 0);
    const vy = Math.sqrt(2 * GRAVITY * (apex - start.y));
    const tLand = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * (start.y - contact.y))) / GRAVITY;
    const launchV = new THREE.Vector3(
      (contact.x - start.x) / tLand,
      vy,
      (contact.z - start.z) / tLand,
    );

    // Spin chosen so the tumbling flight ends exactly in the resting pose.
    const delta = qRest.clone().multiply(qStart.clone().invert());
    const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
    const sign = delta.w < 0 ? -1 : 1;
    const sinH = Math.sqrt(Math.max(1e-9, 1 - delta.w * delta.w));
    const spinAxis = new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar(sign / sinH).normalize();
    const extra = rnd() < 0.5 ? Math.PI * 2 : 0;

    return {
      type,
      start,
      startYaw,
      launchV,
      tLand,
      contact,
      slideDir,
      slide,
      rollAxis,
      rollRadius: 0.24,
      bounce: 0.12 + rnd() * 0.2,
      qStart,
      spinAxis: angle < 1e-4 ? UP.clone() : spinAxis,
      spinAngle: angle + extra,
      qRest,
      upright: rest.upright,
    };
  });
};

export const PIECES = buildPieces();

const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

export const piecePose = (p: PieceSpec, tau: number, pos: THREE.Vector3, quat: THREE.Quaternion) => {
  if (tau <= 0) {
    pos.copy(p.start);
    quat.copy(p.qStart);
    return;
  }
  if (tau < p.tLand) {
    pos.copy(p.start).addScaledVector(p.launchV, tau);
    pos.y -= 0.5 * GRAVITY * tau * tau;
    const u = tau / p.tLand;
    quat.copy(tmpQ.setFromAxisAngle(p.spinAxis, p.spinAngle * u)).multiply(p.qStart);
    return;
  }
  const s = tau - p.tLand;
  const d = p.slide * (1 - Math.exp(-3.2 * s));
  pos.copy(p.contact).addScaledVector(p.slideDir, d);
  pos.y += p.bounce * Math.exp(-4.5 * s) * Math.abs(Math.sin(11 * s));
  const roll = p.upright ? 0 : d / p.rollRadius;
  const wobble = 0.22 * Math.exp(-5 * s) * Math.sin(16 * s);
  quat
    .copy(tmpQ.setFromAxisAngle(p.slideDir, wobble))
    .multiply(tmpQ2.setFromAxisAngle(p.rollAxis, roll))
    .multiply(p.qRest);
};

/** Gold king: drifts down through the dark and lands at T_KING_LAND. */
export const kingY = (t: number) => {
  if (t >= T_KING_LAND) return 0;
  const u = t / T_KING_LAND;
  return 4.6 * (1 - Math.pow(u, 1.7));
};

type CamKey = { t: number; pos: [number, number, number]; target: [number, number, number] };

// Camera path: tracks the falling king, sinks to board level for the impact,
// holds through the slow-motion hang, then pushes in for the hero ending.
const CAM_KEYS: CamKey[] = [
  { t: 0.0, pos: [0.5, 5.7, 8.4], target: [0.15, 5.6, 0] },
  { t: 0.3, pos: [0.35, 4.0, 8.0], target: [0.05, 4.1, 0] },
  { t: 0.55, pos: [0.05, 0.9, 7.5], target: [0, 1.4, 0] },
  { t: 0.8, pos: [0.0, 0.42, 7.35], target: [0, 1.15, 0] },
  { t: 3.6, pos: [0.0, 0.4, 7.0], target: [0, 1.15, 0] },
  { t: 5.0, pos: [0.0, 0.42, 6.3], target: [0, 1.16, 0] },
  { t: 8.1, pos: [0.0, 0.45, 5.15], target: [0, 1.17, 0] },
];

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

const sampleKeys = (t: number, key: "pos" | "target") => {
  const k = CAM_KEYS;
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[Math.max(0, i - 1)];
  const b = k[i];
  const c = k[i + 1];
  const d = k[Math.min(k.length - 1, i + 2)];
  const u = clamp01((t - b.t) / (c.t - b.t));
  return [0, 1, 2].map((j) => catmull(a[key][j], b[key][j], c[key][j], d[key][j], u)) as [number, number, number];
};

export const cameraAt = (t: number) => {
  const pos = sampleKeys(t, "pos");
  const target = sampleKeys(t, "target");
  // Impact shake on the king's landing and on the pieces' crash.
  const shake = (t0: number, amp: number) => {
    const s = t - t0;
    if (s < 0) return 0;
    return amp * Math.exp(-7 * s);
  };
  const a = shake(T_KING_LAND, 0.05) + shake(3.86, 0.03);
  pos[0] += a * Math.sin(t * 61);
  pos[1] += a * Math.sin(t * 47 + 1.3);
  target[1] += a * 0.5 * Math.sin(t * 53 + 0.4);
  return { pos, target };
};
