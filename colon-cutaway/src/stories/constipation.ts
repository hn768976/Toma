import * as THREE from "three";
import type { ColonWorld } from "../three/ColonWorld";
import { MOLECULE_COLOURS } from "../three/ColonWorld";
import { clamp, lerp, smootherstep, smoothstep, TAU } from "../lib/math";
import { mulberry32, pick, range } from "../lib/random";
import { DEFAULT_POST, FrameState, placeInLumen, randomAxis, Shot, shotLerp, shotToView, Story } from "./common";

// Composition 1 — Constipation Relief (450 frames, not a loop)
//   0-90    close-up on the transverse colon, packed with dark clumps
//   60-240  colourful molecules stream in from the ascending colon
//   150-330 clumps break into 3-5 pieces where molecules reach them; pieces move
//           toward the descending side and shrink
//   120-390 camera pulls back to the full colon, slightly from below
//   330-450 last pieces gone, molecules keep flowing; hold

const rng = mulberry32(1001);

// ---- clumps (all seeded at module level) ----
const CLUMP_U0 = 0.225;
const CLUMP_U1 = 0.43;
const N_CLUMPS = 60;
type Piece = { dir: THREE.Vector2; du: number; size: number; axis: THREE.Vector3; spin: number; speed: number; r: number; a: number; endF: number };
type Clump = {
  u: number;
  r: number;
  a: number;
  size: number;
  axis: THREE.Vector3;
  spin0: number;
  breakF: number;
  pieces: Piece[];
  seed: number;
};
const clumps: Clump[] = Array.from({ length: N_CLUMPS }, (_, i) => {
  const u = lerp(CLUMP_U0, CLUMP_U1, (i + 0.5) / N_CLUMPS) + range(rng, -0.004, 0.004);
  const r = Math.pow(rng(), 0.35);
  const a = rng() * TAU;
  const size = range(rng, 0.32, 0.47);
  const frac = (u - CLUMP_U0) / (CLUMP_U1 - CLUMP_U0);
  const breakF = Math.round(150 + frac * 150 + range(rng, -12, 12));
  const n = 3 + Math.floor(rng() * 3);
  const pieces: Piece[] = Array.from({ length: n }, (_, k) => {
    const ang = (k / n) * TAU + range(rng, -0.4, 0.4);
    return {
      dir: new THREE.Vector2(Math.cos(ang), Math.sin(ang)),
      du: range(rng, -0.6, 0.6),
      size: size * range(rng, 0.42, 0.56),
      axis: randomAxis(rng),
      spin: range(rng, -0.05, 0.05),
      speed: range(rng, 0.0019, 0.0029),
      r: Math.sqrt(rng()) * 0.8,
      a: rng() * TAU,
      endF: Math.min(425, breakF + Math.round(range(rng, 120, 175))),
    };
  });
  return { u, r, a, size, axis: randomAxis(rng), spin0: rng() * TAU, breakF, pieces, seed: rng() };
});

// ---- molecules ----
const N_MOL_PER_TYPE = 200;
type Mol = { type: number; slot: number; e: number; u0: number; v: number; r: number; a: number; wob: number; wobF: number; size: number; colour: THREE.Color; emissive: number; axis: THREE.Vector3; spin: number; seed: number };
const mols: Mol[] = [];
for (let type = 0; type < 4; type++) {
  for (let slot = 0; slot < N_MOL_PER_TYPE; slot++) {
    const early = rng() < 0.68;
    const e = early ? range(rng, 58, 240) : range(rng, 240, 435);
    const glow = rng() < 0.32;
    mols.push({
      type,
      slot,
      e,
      u0: range(rng, 0.0, 0.05),
      v: range(rng, 0.0022, 0.0032),
      r: Math.sqrt(rng()),
      a: rng() * TAU,
      wob: range(rng, 0.05, 0.25),
      wobF: range(rng, 0.02, 0.06),
      size: range(rng, 0.055, 0.09),
      colour: pick(rng, MOLECULE_COLOURS),
      emissive: glow ? range(rng, 1.4, 2.4) : 0,
      axis: randomAxis(rng),
      spin: range(rng, -0.08, 0.08),
      seed: rng(),
    });
  }
}

// ---- camera ----
const CLOSE: Shot = { target: [0.0, 3.1, 1.2], dist: 7.6, yaw: -14, pitch: 18, fov: 30, aperture: 0.012, maxCoc: 0.007 };
const CLOSE_END: Shot = { ...CLOSE, target: [0.15, 3.05, 1.2], dist: 7.1, yaw: -9, pitch: 16 };
const FULL: Shot = { target: [0.0, -0.2, 0], dist: 30, yaw: 10, pitch: -12, fov: 30, aperture: 0.006, maxCoc: 0.0035 };
const FULL_END: Shot = { ...FULL, yaw: 8.5, pitch: -11.5, dist: 29.5 };

const shotAt = (f: number): Shot => {
  if (f <= 120) return shotLerp(CLOSE, CLOSE_END, smoothstep(0, 120, f) * 0.85);
  const start = shotLerp(CLOSE, CLOSE_END, 0.85);
  if (f <= 390) return shotLerp(start, FULL, smootherstep(120, 390, f));
  return shotLerp(FULL, FULL_END, smoothstep(390, 450, f));
};

const grey = new THREE.Color(1, 1, 1);

export const constipationStory: Story = {
  id: "Colon-ConstipationRelief",
  durationInFrames: 450,
  update(world: ColonWorld, f: number): FrameState {
    const L = world.cl.length;
    world.setPatches([]);

    // clumps
    const C = world.clumps;
    clumps.forEach((c, i) => {
      // gentle drift while packed
      const du = 0.0025 * Math.sin(f * 0.021 + i * 1.7);
      const spin = c.spin0 + f * 0.0035;
      const crack = smoothstep(c.breakF - 6, c.breakF + 5, f);
      const parentScale = c.size * (1 - 0.35 * crack);
      if (f < c.breakF + 5) {
        placeInLumen(world, C, i, c.u + du, c.r * Math.cos(c.a), c.r * Math.sin(c.a), parentScale, c.axis, spin, grey, 1, 0, c.seed);
      } else {
        C.hide(i);
      }
      c.pieces.forEach((p, k) => {
        const slot = N_CLUMPS + i * 5 + k;
        if (f < c.breakF - 4 || f >= p.endF) {
          C.hide(slot);
          return;
        }
        const age = f - c.breakF;
        // burst apart, then get carried along toward the descending colon
        const sep = smoothstep(-4, 22, age);
        const travel = age <= 0 ? 0 : p.speed * (age - 26 * (1 - Math.exp(-age / 26)));
        const u = c.u + du + (p.du * c.size * sep * 0.9) / L + travel;
        const ox0 = c.r * Math.cos(c.a);
        const oy0 = c.r * Math.sin(c.a);
        const settle = smoothstep(10, 70, age);
        const ox = lerp(ox0 + p.dir.x * 0.45 * sep, p.r * Math.cos(p.a + age * 0.01), settle);
        const oy = lerp(oy0 + p.dir.y * 0.45 * sep, p.r * Math.sin(p.a + age * 0.01), settle);
        const grow = smoothstep(-4, 6, age);
        const shrink = 1 - smoothstep(c.breakF + 30, p.endF, f);
        const s = p.size * (0.55 + 0.45 * grow) * Math.pow(shrink, 0.8);
        placeInLumen(world, C, slot, u, ox, oy, s, p.axis, spin + p.spin * age, grey, 1, 0, c.seed + k * 0.37);
      });
    });

    // molecules
    for (const m of mols) {
      const g = world.molecules[m.type];
      const age = f - m.e;
      if (age < 0) {
        g.hide(m.slot);
        continue;
      }
      const u = m.u0 + m.v * age;
      if (u >= 1) {
        g.hide(m.slot);
        continue;
      }
      const fadeIn = smoothstep(0, 14, age);
      const fadeOut = 1 - smoothstep(0.95, 1.0, u);
      const alpha = fadeIn * fadeOut;
      const a = m.a + Math.sin(age * m.wobF + m.seed * 9) * m.wob * 3;
      const r = clamp(m.r + Math.sin(age * m.wobF * 0.7 + m.seed * 5) * m.wob, 0, 1);
      placeInLumen(world, g, m.slot, u, r * Math.cos(a), r * Math.sin(a), m.size * (0.9 + 0.1 * alpha), m.axis, m.seed * TAU + m.spin * age, m.colour, alpha, m.emissive, m.seed);
    }
    for (const g of [...world.cool, world.rods, world.cocci, world.spikes]) for (let i = 0; i < g.count; i++) g.hide(i);

    const shot = shotAt(f);
    const view = shotToView(shot, f, f / 600, f);
    return { view, post: DEFAULT_POST };
  },
};
