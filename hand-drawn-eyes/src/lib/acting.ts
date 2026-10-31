// Seeded "acting" for a pair of eyes over a looping timeline: glances,
// blinks, a suspicious narrow and a surprised widen. Poses are held on twos
// (evaluated on even frames). The timeline starts and ends on the rest pose
// (looking ahead, open), so frame 300 equals frame 0.
import { easeInOut, lerp, mod } from "./math";
import type { Rng } from "./rng";

export type Pose = { gx: number; gy: number; open: number; slit: number };

type GazeKey = { t: number; dur: number; x: number; y: number };
type Window = { t: number; kind: "blink" | "narrow" | "widen"; len: number };

export type ActingOpts = {
  duration: number; // loop length in frames
  glanceDur: [number, number]; // frames for a glance (eased)
  holdRange: [number, number]; // frames to hold a look
  blinkLen: number; // frames for a full blink (close+reopen)
  blinks: number;
  narrow: boolean;
  widen: boolean;
  amplitude?: number; // how far the gaze goes (0..1)
  targets?: [number, number][];
};

const DEFAULT_TARGETS: [number, number][] = [
  [-1, 0], [1, 0], [0, -0.9], [0, 0.85], [-0.8, -0.6], [0.8, -0.6], [-0.75, 0.6], [0.75, 0.6],
];

// Blink openness profile; k = 0..1 through the blink (sampled on twos).
// First drawing already half-closed, then shut, then half-open, then open:
// for a 6-frame blink that is 0.45 / 0 / 0.42 on twos.
const blinkProfile = (k: number) => {
  if (k < 0 || k >= 1) return 1;
  if (k < 0.3) return 0.45 * (1 - k / 0.3);
  if (k < 0.5) return 0;
  return Math.pow((k - 0.5) / 0.5, 0.8) * 0.75 + 0.05;
};

export const buildActing = (rng: Rng, o: ActingOpts) => {
  const D = o.duration;
  const amp = o.amplitude ?? 1;
  const targets = o.targets ?? DEFAULT_TARGETS;

  // Gaze keys: rest at 0, a run of glances, back to rest well before D.
  const keys: GazeKey[] = [{ t: 0, dur: 0, x: 0, y: 0 }];
  let t = rng.int(10, 24);
  let last = -1;
  while (true) {
    const dur = rng.int(o.glanceDur[0], o.glanceDur[1]);
    const hold = rng.int(o.holdRange[0], o.holdRange[1]);
    if (t + dur + hold + o.glanceDur[1] + 16 > D) break;
    let idx = rng.int(0, targets.length - 1);
    if (idx === last) idx = (idx + 1) % targets.length;
    last = idx;
    // Every few glances, come back to centre for a beat.
    const back = keys.length % 3 === 0 && rng.next() < 0.5;
    const [x, y] = back ? [0, 0] : targets[idx];
    keys.push({ t, dur, x: x * amp, y: y * amp });
    t += dur + hold;
  }
  keys.push({ t: Math.min(t, D - o.glanceDur[1] - 10), dur: o.glanceDur[1], x: 0, y: 0 });

  // Windows: blinks, narrow, widen, non-overlapping, away from the loop seam.
  const wins: Window[] = [];
  const free = (a: number, len: number) =>
    a > 6 &&
    a + len < D - 6 &&
    wins.every((w) => a + len + 10 < w.t || a > w.t + w.len + 10);
  const place = (kind: Window["kind"], len: number) => {
    for (let tries = 0; tries < 200; tries++) {
      const a = 2 * Math.floor(rng.range(8, D - len - 8) / 2);
      if (free(a, len)) {
        wins.push({ t: a, kind, len });
        return;
      }
    }
  };
  if (o.narrow) place("narrow", 32);
  if (o.widen) place("widen", 16);
  for (let i = 0; i < o.blinks; i++) place("blink", o.blinkLen);

  const gazeAt = (f: number) => {
    let gx = 0;
    let gy = 0;
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      const prev = keys[i - 1];
      if (f < k.t) break;
      const p = easeInOut((f - k.t) / k.dur);
      gx = lerp(prev.x, k.x, p);
      gy = lerp(prev.y, k.y, p);
    }
    return [gx, gy];
  };

  const poseAt = (frame: number): Pose => {
    const f = mod(frame, D);
    const fq = f - (f % 2); // held on twos
    const [gx, gy] = gazeAt(fq);
    let open = 1;
    let slit = 1;
    for (const w of wins) {
      const k = (fq - w.t) / w.len;
      if (k < 0 || k >= 1) continue;
      if (w.kind === "blink") open *= blinkProfile(k);
      if (w.kind === "narrow") {
        const e = k < 0.2 ? easeInOut(k / 0.2) : k > 0.8 ? easeInOut((1 - k) / 0.2) : 1;
        open *= lerp(1, 0.42, e);
        slit *= lerp(1, 0.75, e);
      }
      if (w.kind === "widen") {
        const e = k < 0.2 ? easeInOut(k / 0.2) : k > 0.6 ? easeInOut((1 - k) / 0.4) : 1;
        open *= lerp(1, 1.2, e);
        slit *= lerp(1, 1.5, e);
      }
    }
    return { gx, gy, open, slit };
  };

  return { poseAt, keys, wins };
};
