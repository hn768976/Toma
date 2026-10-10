import { mulberry32, range } from "../common/random";

// Scene constants shared with the shader.
export const BLOB_COUNT = 24;
export const CAM_Z = 7.5; // camera on +z looking along -z
export const FOV_DEG = 38;
export const TAN_HALF = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
export const PERIOD_H = 11; // vertical wrap period (view is ~6.5-7 tall at mid depth)
export const SMOOTH_K = 0.55; // polynomial smin radius
const ASPECT = 16 / 9;

type Member = {
  r: number;
  off: [number, number, number]; // rest offset from the group centre
  pulse: number; // relative breathing of the offset (merge <-> split)
  pulseCycles: number;
  pulsePhase: number;
};

type Group = {
  x: number;
  z: number;
  y0: number; // start height inside the period
  periods: 1 | 2; // whole periods travelled per 600-frame loop
  swayX: number;
  swayZ: number;
  swayCycles: number;
  swayPhase: number;
  members: Member[];
};

// Half the visible height at depth z (plus a halo margin): a group must stay
// beyond this, at its own depth, at the moment it wraps from top to bottom.
const halfView = (z: number) => (CAM_Z - z) * TAN_HALF;
const haloMargin = (z: number) => 0.3 + 0.032 * (CAM_Z - z);

// Group layout: 10 singles, 4 pairs, 2 triplets = 24 blobs.
const SIZES = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3];

const build = (): Group[] => {
  const rng = mulberry32(0x5eed_b10b);
  const groups: Group[] = [];
  SIZES.forEach((n, gi) => {
    // Stratify depth so near, middle and far blobs are all present.
    const z = -5 + (6.5 * (gi + rng())) / SIZES.length;
    const swayZ = range(rng, 0.1, 0.25);
    const zFar = z - swayZ - 0.2; // 0.2: largest member z offset
    const room = PERIOD_H / 2 - halfView(zFar) - haloMargin(zFar);
    // Members: radius limited so the group (and its halo) stays out of view when it wraps.
    const members: Member[] = [];
    const rMaxDepth = Math.min(1.25, Math.max(0.35, room));
    for (let m = 0; m < n; m++) {
      const rBase = n === 1 ? range(rng, 0.45, 1.0) : range(rng, 0.4, 0.75);
      const r = Math.max(0.35, Math.min(rMaxDepth, rBase * rMaxDepth));
      let off: [number, number, number] = [0, 0, 0];
      if (m > 0) {
        const prev = members[m - 1];
        const a = range(rng, 0, Math.PI * 2);
        const dist = (prev.r + r) * range(rng, 0.85, 1.05);
        off = [prev.off[0] + Math.cos(a) * dist, prev.off[1] + Math.sin(a) * dist, range(rng, -0.2, 0.2)];
      }
      members.push({
        r,
        off,
        pulse: range(rng, 0.18, 0.32),
        pulseCycles: 1 + Math.floor(rng() * 2),
        pulsePhase: range(rng, 0, Math.PI * 2),
      });
    }
    // Centre the members on the group origin.
    const cx = members.reduce((s, m) => s + m.off[0], 0) / n;
    const cy = members.reduce((s, m) => s + m.off[1], 0) / n;
    members.forEach((m) => {
      m.off = [m.off[0] - cx, m.off[1] - cy, m.off[2]];
    });
    // Shrink the group if, at full stretch, it would poke into view while wrapping.
    const extent = Math.max(...members.map((m) => Math.abs(m.off[1]) * (1 + m.pulse) + m.r));
    const fit = Math.min(1, room / extent);
    members.forEach((m) => {
      m.r *= fit;
      m.off = [m.off[0] * fit, m.off[1] * fit, m.off[2]];
    });
    const halfW = Math.min(6, halfView(z) * ASPECT + 0.3);
    groups.push({
      x: range(rng, -halfW, halfW),
      z,
      y0: (PERIOD_H * (gi * 7 % SIZES.length + rng() * 0.8)) / SIZES.length,
      periods: rng() < 0.7 ? 1 : 2,
      swayX: range(rng, 0.15, 0.45),
      swayZ,
      swayCycles: 1 + Math.floor(rng() * 2),
      swayPhase: range(rng, 0, Math.PI * 2),
      members,
    });
  });
  return groups;
};

export const GROUPS = build();

/**
 * Blob centres + radii for a loop phase in [0, 1). Rises are whole periods and
 * sways whole cycles, so phase 0 and phase 1 give identical positions.
 * Output: Float32Array of BLOB_COUNT * 4 (x, y, z, r).
 */
export const blobsAt = (phase: number, out = new Float32Array(BLOB_COUNT * 4)) => {
  const TAU = Math.PI * 2;
  let k = 0;
  for (const g of GROUPS) {
    // The whole group wraps as a unit (so pairs never get torn apart in view).
    const yRaw = g.y0 + g.periods * PERIOD_H * phase;
    const yc = (yRaw % PERIOD_H) - PERIOD_H / 2;
    const sx = g.x + g.swayX * Math.sin(TAU * g.swayCycles * phase + g.swayPhase);
    const sz = g.z + g.swayZ * Math.sin(TAU * phase + g.swayPhase * 1.7);
    for (const m of g.members) {
      const s = 1 + m.pulse * Math.sin(TAU * m.pulseCycles * phase + m.pulsePhase);
      out[k++] = sx + m.off[0] * s;
      out[k++] = yc + m.off[1] * s;
      out[k++] = sz + m.off[2];
      out[k++] = m.r;
    }
  }
  return out;
};
