// Look 1 — Cube Cluster. Pure data + pure functions of the frame.
//
// Everything is generated once at module load from a fixed seed. Every
// time-varying value is a function of t = (frame % LOOP) / LOOP with a whole
// number of cycles per loop, so frame 600 is the same picture as frame 0.

import { Quaternion, Vector3 } from "three";
import { assignTypes, type CubeType, mulberry32, pick, range, shuffle } from "../rng";

export const LOOP = 600;
export const SPACING = 1.34; // lattice pitch; cubes are 1.0 wide (loose, as the references)
export const CLUSTER_Y = 3.6; // height of the lattice centre above the floor

export type ToneSlot = 0 | 1 | 2 | "accent";

export type ClusterCube = {
  id: number;
  type: CubeType;
  tone: ToneSlot;
  /** rest position in cluster space */
  home: Vector3;
  size: number;
  /** slide: unit axis, amplitude (≤ 1 cube), whole cycles per loop, phase */
  slideDir: Vector3;
  slideAmp: number;
  slideCycles: number;
  slidePhase: number;
  /** glow pulse */
  glowBase: number;
  pulseCycles: number;
  pulsePhase: number;
  pulseDepth: number;
  /** tiny drifting cubes only */
  tiny: boolean;
  drift?: {
    amp: Vector3;
    cycles: [number, number, number];
    phase: [number, number, number];
    spinAxis: Vector3;
    spinTurns: number; // whole turns per loop
    spinPhase: number;
  };
};

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

const generate = (): ClusterCube[] => {
  const rng = mulberry32(0x6c75_7374); // "lust"

  // ── choose lattice cells: a loose blob with ragged outline and a few gaps ──
  type Cell = { x: number; y: number; z: number; score: number };
  const cells: Cell[] = [];
  for (let x = -3; x <= 3; x++)
    for (let y = -2; y <= 2; y++)
      for (let z = -3; z <= 3; z++) {
        const d = Math.sqrt((x / 2.35) ** 2 + (y / 1.75) ** 2 + (z / 2.35) ** 2);
        cells.push({ x, y, z, score: d + range(rng, -0.42, 0.42) });
      }
  cells.sort((a, b) => a.score - b.score);
  const chosen = cells.slice(0, 63);
  // punch a few gaps inside the cluster
  const inner = chosen.filter((c) => Math.abs(c.x) <= 1 && Math.abs(c.y) <= 1 && Math.abs(c.z) <= 1);
  const gaps = new Set(shuffle(rng, inner).slice(0, 7).map((c) => key(c.x, c.y, c.z)));
  const occupied = chosen.filter((c) => !gaps.has(key(c.x, c.y, c.z)));

  const occ = new Set(occupied.map((c) => key(c.x, c.y, c.z)));
  const claimed = new Set<string>();
  const types = assignTypes(rng, occupied.length);

  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  const cubes: ClusterCube[] = occupied.map((c, i) => {
    // Slide toward an empty, unclaimed neighbour cell — never into another
    // cube's cell or into a cell another cube also slides into.
    const free = shuffle(rng, dirs).filter(([dx, dy, dz]) => {
      const k = key(c.x + dx, c.y + dy, c.z + dz);
      return !occ.has(k) && !claimed.has(k) && c.y + dy >= -2; // never down below the bottom layer
    });
    let slideDir = new Vector3();
    let slideAmp = 0;
    if (free.length > 0 && rng() < 0.82) {
      const [dx, dy, dz] = free[0];
      claimed.add(key(c.x + dx, c.y + dy, c.z + dz));
      slideDir = new Vector3(dx, dy, dz);
      slideAmp = range(rng, 0.35, 0.95); // ≤ one cube width
    }
    const type = types[i];
    const tone: ToneSlot = type === "glow" ? (rng() < 0.14 ? "accent" : pick(rng, [0, 1, 1, 2, 2] as const)) : 1;
    return {
      id: i,
      type,
      tone,
      home: new Vector3(c.x * SPACING, c.y * SPACING, c.z * SPACING),
      size: range(rng, 0.94, 1.0),
      slideDir,
      slideAmp,
      slideCycles: pick(rng, [1, 1, 2, 2, 3]),
      slidePhase: range(rng, 0, Math.PI * 2),
      glowBase: type === "glow" ? range(rng, 0.75, 1.15) : type === "frosted" ? range(rng, 0.6, 1.2) : 1,
      pulseCycles: pick(rng, [1, 2, 3, 4, 5]),
      pulsePhase: range(rng, 0, Math.PI * 2),
      pulseDepth: range(rng, 0.3, 0.6),
      tiny: false,
    };
  });

  // ── tiny cubes drifting around the edges (outside every reachable cell) ──
  const tinyTypes: CubeType[] = ["glow", "glow", "glow", "glow", "glow", "frosted", "frosted", "glass", "glass", "dark", "glow"];
  const nTiny = tinyTypes.length;
  for (let j = 0; j < nTiny; j++) {
    const a = (j / nTiny) * Math.PI * 2 + range(rng, -0.25, 0.25);
    const r = range(rng, 6.9, 7.9);
    const y = range(rng, -1.9, 3.6);
    const type = tinyTypes[j];
    const axis = new Vector3(range(rng, -1, 1), range(rng, -1, 1), range(rng, -1, 1)).normalize();
    cubes.push({
      id: cubes.length,
      type,
      tone: type === "glow" ? (j % 4 === 0 ? "accent" : pick(rng, [0, 1, 2] as const)) : 1,
      home: new Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      size: range(rng, 0.2, 0.36),
      slideDir: new Vector3(),
      slideAmp: 0,
      slideCycles: 1,
      slidePhase: 0,
      glowBase: type === "glow" ? range(rng, 0.9, 1.3) : 1,
      pulseCycles: pick(rng, [2, 3, 4]),
      pulsePhase: range(rng, 0, Math.PI * 2),
      pulseDepth: 0.35,
      tiny: true,
      drift: {
        amp: new Vector3(range(rng, 0.2, 0.45), range(rng, 0.25, 0.55), range(rng, 0.2, 0.45)),
        cycles: [pick(rng, [1, 2]), pick(rng, [1, 2, 3]), pick(rng, [1, 2])],
        phase: [range(rng, 0, 6.283), range(rng, 0, 6.283), range(rng, 0, 6.283)],
        spinAxis: axis,
        spinTurns: pick(rng, [-1, 1]),
        spinPhase: range(rng, 0, 6.283),
      },
    });
  }
  return cubes;
};

export const CLUSTER: ClusterCube[] = generate();

/** Switches used by the loop-debugging procedure (all on in the deliverable). */
export type ClusterToggles = {
  turn: boolean;
  slides: boolean;
  pulses: boolean;
  tiny: boolean;
  camera: boolean;
  grain: boolean;
};
export const ALL_ON: ClusterToggles = { turn: true, slides: true, pulses: true, tiny: true, camera: true, grain: true };

const TAU = Math.PI * 2;
/** eased 0→1→0 shuttle with dwell at both ends; whole cycles per loop */
const shuttle = (t: number, cycles: number, phase: number) => {
  const s = 0.5 - 0.5 * Math.cos(TAU * cycles * t + phase);
  return s * s * (3 - 2 * s);
};

export type ClusterPose = {
  pos: Vector3;
  quat: Quaternion;
  scale: number;
  glow: number;
};

const UP = new Vector3(0, 1, 0);

/**
 * Pose of every cube at loop phase t ∈ [0,1). `noWrap` (debug) lets t run
 * past 1 to prove the motion closes on its own, not just because of the modulo.
 */
export const clusterPoses = (t: number, tg: ClusterToggles = ALL_ON): ClusterPose[] => {
  const turn = tg.turn ? TAU * t : 0;
  const qTurn = new Quaternion().setFromAxisAngle(UP, turn);
  return CLUSTER.map((c) => {
    const local = c.home.clone();
    let q = new Quaternion();
    if (c.tiny && c.drift) {
      if (tg.tiny) {
        const d = c.drift;
        local.x += d.amp.x * Math.sin(TAU * d.cycles[0] * t + d.phase[0]);
        local.y += d.amp.y * Math.sin(TAU * d.cycles[1] * t + d.phase[1]);
        local.z += d.amp.z * Math.sin(TAU * d.cycles[2] * t + d.phase[2]);
        q = new Quaternion().setFromAxisAngle(d.spinAxis, TAU * d.spinTurns * t + d.spinPhase);
      } else {
        q = new Quaternion().setFromAxisAngle(c.drift.spinAxis, c.drift.spinPhase);
      }
    } else if (tg.slides && c.slideAmp > 0) {
      local.addScaledVector(c.slideDir, c.slideAmp * shuttle(t, c.slideCycles, c.slidePhase));
    }
    local.applyQuaternion(qTurn);
    local.y += CLUSTER_Y;
    const pulse = tg.pulses ? 0.5 + 0.5 * Math.sin(TAU * c.pulseCycles * t + c.pulsePhase) : 0.5;
    const glow = c.glowBase * (1 - c.pulseDepth + c.pulseDepth * pulse * 1.6);
    return { pos: local, quat: qTurn.clone().multiply(q), scale: c.size, glow };
  });
};

export const CAM_TARGET = new Vector3(0, CLUSTER_Y - 0.35, 0);
export const CAM_DIST = 23;
export const CAM_ELEV = (40 * Math.PI) / 180;
export const CAM_FOV = 32;

/** Camera on a small closed path (whole cycles per loop). */
export const clusterCamera = (t: number, tg: ClusterToggles = ALL_ON): Vector3 => {
  const az = tg.camera ? 0.035 * Math.sin(TAU * t) : 0;
  const el = CAM_ELEV + (tg.camera ? 0.018 * Math.sin(TAU * 2 * t + 1.1) : 0);
  return new Vector3(
    CAM_TARGET.x + CAM_DIST * Math.cos(el) * Math.sin(az),
    CAM_TARGET.y + CAM_DIST * Math.sin(el),
    CAM_TARGET.z + CAM_DIST * Math.cos(el) * Math.cos(az),
  );
};
