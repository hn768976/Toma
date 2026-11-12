import * as THREE from "three";
import { mulberry32, pick, range } from "../lib/random";

export type LabelKind = "hex" | "num" | "box" | "caption";

export type DataLabel = {
  id: number;
  pos: THREE.Vector3; // world space (labels live in the outer shell frame)
  /** drift velocity (world units / s); intro labels stream past the lens */
  vel: THREE.Vector3;
  kind: LabelKind;
  seed: number;
  size: number; // relative font size
  appear: number; // seconds
  vanish: number; // seconds
  /** digits change at this rate (Hz); 0 = static */
  tick: number;
};

const CAPTIONS = [
  "DATA STREAM ANALYSIS",
  "GLOBAL NODE SYNC",
  "PACKET ROUTING 04",
  "NETWORK LATENCY",
  "SIGNAL INTEGRITY",
  "UPLINK STATUS",
  "SECTOR SCAN",
  "ENCRYPTED CHANNEL",
];

const HEX = "0123456789ABCDEF";

const randomOnSphere = (rng: () => number) => {
  const u = rng() * 2 - 1;
  const th = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
};

/**
 * Labels are scattered in a shell around the planet; a denser cluster sits
 * along the opening camera path so the first seconds fly through floating
 * read-outs as in the reference.
 */
export type Stream = { pos: THREE.Vector3; vel: THREE.Vector3; appear: number };

export const buildLabels = (pathHints: THREE.Vector3[], streams: Stream[] = []): DataLabel[] => {
  const rng = mulberry32(7741);
  const labels: DataLabel[] = [];
  const kinds: LabelKind[] = ["hex", "num", "num", "box", "box", "caption"];
  let id = 0;
  for (let i = 0; i < 80; i++) {
    const r = 1.12 + Math.pow(rng(), 1.4) * 3.6;
    labels.push({
      id: id++,
      pos: randomOnSphere(rng).multiplyScalar(r),
      vel: new THREE.Vector3(),
      kind: pick(rng, kinds),
      seed: Math.floor(rng() * 1e9),
      size: range(rng, 0.55, 1.1),
      appear: range(rng, 2, 9),
      vanish: 999,
      tick: rng() < 0.45 ? range(rng, 2, 8) : 0,
    });
  }
  for (const hint of pathHints) {
    for (let i = 0; i < 6; i++) {
      const jitter = randomOnSphere(rng).multiplyScalar(range(rng, 0.15, 0.9));
      labels.push({
        id: id++,
        pos: hint.clone().add(jitter),
        vel: new THREE.Vector3(),
        kind: pick(rng, kinds),
        seed: Math.floor(rng() * 1e9),
        size: range(rng, 0.8, 1.3),
        appear: range(rng, 1.6, 3.2),
        vanish: range(rng, 5.5, 9),
        tick: rng() < 0.5 ? range(rng, 3, 9) : 0,
      });
    }
  }
  // Foreground read-outs that stream past the lens during the opening.
  for (const s of streams) {
    labels.push({
      id: id++,
      pos: s.pos,
      vel: s.vel,
      kind: pick(rng, ["num", "box", "hex", "num"] as const),
      seed: Math.floor(rng() * 1e9),
      size: range(rng, 1.1, 1.9),
      appear: s.appear,
      vanish: s.appear + range(rng, 2.2, 3.5),
      tick: rng() < 0.5 ? range(rng, 4, 10) : 0,
    });
  }
  return labels;
};

/** Text of a label at time t (numbers tick deterministically). */
export const labelText = (l: DataLabel, t: number): string => {
  const step = l.tick > 0 ? Math.floor(t * l.tick) : 0;
  const rng = mulberry32(l.seed + step * 7919);
  const base = mulberry32(l.seed);
  switch (l.kind) {
    case "hex": {
      let s = "0x";
      const len = 12 + Math.floor(base() * 5);
      for (let i = 0; i < len; i++) s += HEX[Math.floor((i < 4 ? base() : rng()) * 16)];
      return s;
    }
    case "num": {
      const digits = 3 + Math.floor(base() * 3);
      const whole = Math.floor(base() * 3);
      return `${whole}.${Math.floor(rng() * 10 ** digits)
        .toString()
        .padStart(digits, "0")}`;
    }
    case "box": {
      const digits = 4 + Math.floor(base() * 2);
      const whole = Math.floor(base() * 4);
      return `${whole}.${Math.floor(rng() * 10 ** digits)
        .toString()
        .padStart(digits, "0")}`;
    }
    case "caption":
      return CAPTIONS[Math.floor(base() * CAPTIONS.length)];
  }
};
