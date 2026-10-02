import * as THREE from "three";
import type { ColonWorld } from "../three/ColonWorld";
import { COOL_COLOURS, SPIKE_COLOURS } from "../three/ColonWorld";
import { clamp, smootherstep, smoothstep, TAU } from "../lib/math";
import { mulberry32, pick, range } from "../lib/random";
import { DEFAULT_POST, FrameState, placeInLumen, randomAxis, Shot, shotLerp, shotToView, Story } from "./common";

// Composition 3 — Inflammation Relief (450 frames, not a loop)
//   0-120   wide view; inflamed red patches (mostly descending + sigmoid) with
//           small red-orange spiky particles; camera pushes in on the descending colon
//   90-300  cool particles (white / cyan / pale blue) flow in from the caecum
//   180-360 as the cool front reaches each patch it heals: red fades to cream,
//           glow and bumps go, the spiky particles shrink away, a cool shimmer passes
//   300-450 camera pulls back to the full, healthy colon; hold
// Each patch's heal value is computed from the frame (front arrival time), not stored.

const rng = mulberry32(3003);

const FRONT_START = 90; // first cool particles enter at the caecum
const FRONT_V = 0.0045; // u per frame of the leading particles
const HEAL_FRAMES = 55;
const arrival = (u: number) => FRONT_START + (u - 0.02) / FRONT_V + 12;

type Patch = { u: number; theta: number; halfLen: number; halfAngle: number; a: number };
const PATCH_U = [0.33, 0.56, 0.62, 0.69, 0.76, 0.83, 0.9];
const patches: Patch[] = PATCH_U.map((u) => ({
  u: u + range(rng, -0.008, 0.008),
  theta: range(rng, -0.65, 0.65),
  halfLen: range(rng, 0.75, 1.0),
  halfAngle: range(rng, 0.9, 1.2),
  a: 0,
}));
patches.forEach((p) => (p.a = arrival(p.u)));

const healAt = (p: Patch, f: number) => smootherstep(p.a, p.a + HEAL_FRAMES, f);

// spiky irritants hovering near each patch
type Spike = { patch: number; slot: number; du: number; th: number; r: number; size: number; axis: THREE.Vector3; spin: number; bob: number; ph: number; colour: THREE.Color };
const spikes: Spike[] = [];
patches.forEach((p, i) => {
  for (let k = 0; k < 12; k++) {
    spikes.push({
      patch: i,
      slot: spikes.length,
      du: range(rng, -0.85, 0.85) * p.halfLen,
      th: p.theta + range(rng, -0.75, 0.75) * p.halfAngle,
      r: range(rng, 0.62, 0.95),
      size: range(rng, 0.055, 0.09),
      axis: randomAxis(rng),
      spin: range(rng, -0.05, 0.05),
      bob: range(rng, 0.02, 0.05),
      ph: rng() * TAU,
      colour: pick(rng, SPIKE_COLOURS),
    });
  }
});

// cool soothing molecules
type Cool = { type: number; slot: number; e: number; u0: number; v: number; r: number; a: number; wob: number; wobF: number; size: number; colour: THREE.Color; emissive: number; axis: THREE.Vector3; spin: number; seed: number };
const cool: Cool[] = [];
for (let type = 0; type < 4; type++) {
  for (let slot = 0; slot < 140; slot++) {
    const lead = slot < 8; // the leading edge of the stream
    const late = !lead && rng() < 0.22;
    cool.push({
      type,
      slot,
      e: lead ? range(rng, FRONT_START, FRONT_START + 10) : late ? range(rng, 300, 440) : range(rng, FRONT_START, 300),
      u0: range(rng, 0.0, 0.03),
      v: lead ? range(rng, FRONT_V - 0.0002, FRONT_V) : range(rng, 0.0032, 0.0045),
      r: Math.sqrt(rng()),
      a: rng() * TAU,
      wob: range(rng, 0.05, 0.25),
      wobF: range(rng, 0.02, 0.06),
      size: range(rng, 0.055, 0.09),
      colour: pick(rng, COOL_COLOURS),
      emissive: rng() < 0.4 ? range(rng, 1.3, 2.2) : 0,
      axis: randomAxis(rng),
      spin: range(rng, -0.08, 0.08),
      seed: rng(),
    });
  }
}

// camera
const WIDE: Shot = { target: [0.0, -0.2, 0], dist: 30, yaw: -6, pitch: -10, fov: 30, aperture: 0.006, maxCoc: 0.0035 };
const PUSH: Shot = { target: [2.3, -0.4, -0.7], dist: 12.5, yaw: 14, pitch: -9, fov: 30, aperture: 0.012, maxCoc: 0.006 };
const DRIFT: Shot = { target: [1.6, -1.2, -0.7], dist: 12.5, yaw: 8, pitch: -12, fov: 30, aperture: 0.012, maxCoc: 0.006 };
const FULL: Shot = { target: [0.0, -0.2, 0], dist: 30, yaw: 7, pitch: -13, fov: 30, aperture: 0.006, maxCoc: 0.0035 };
const FULL_END: Shot = { ...FULL, yaw: 6, pitch: -12.5, dist: 29.5 };
const shotAt = (f: number): Shot => {
  if (f < 150) return shotLerp(WIDE, PUSH, smootherstep(15, 150, f));
  if (f < 300) return shotLerp(PUSH, DRIFT, smoothstep(150, 300, f));
  if (f < 420) return shotLerp(DRIFT, FULL, smootherstep(300, 420, f));
  return shotLerp(FULL, FULL_END, smoothstep(420, 450, f));
};

export const inflammationStory: Story = {
  id: "Colon-InflammationRelief",
  durationInFrames: 450,
  update(world: ColonWorld, f: number): FrameState {
    const L = world.cl.length;
    world.setPatches(
      patches.map((p, i) => {
        const heal = healAt(p, f);
        const pulse = 0.93 + 0.07 * Math.sin(f * 0.11 + i * 1.9);
        return {
          u: p.u,
          theta: p.theta,
          halfLen: p.halfLen,
          halfAngle: p.halfAngle,
          inflammation: (1 - heal) * pulse,
          shimmer: clamp((f - p.a) / HEAL_FRAMES),
        };
      }),
    );

    for (const s of spikes) {
      const p = patches[s.patch];
      const heal = healAt(p, f);
      const scale = s.size * Math.pow(1 - heal, 0.7);
      const u = p.u + s.du / L + 0.004 * Math.sin(f * 0.03 + s.ph);
      const th = s.th + s.bob * 3 * Math.sin(f * 0.025 + s.ph * 2);
      const r = clamp(s.r + s.bob * Math.sin(f * 0.04 + s.ph));
      placeInLumen(world, world.spikes, s.slot, u, r * Math.sin(th), r * Math.cos(th), scale, s.axis, s.ph + s.spin * f, s.colour, scale > 0.004 ? 1 : 0, 0.55, s.ph);
    }

    for (const m of cool) {
      const g = world.cool[m.type];
      const age = f - m.e;
      const u = m.u0 + m.v * age;
      if (age < 0 || u >= 1) {
        g.hide(m.slot);
        continue;
      }
      const alpha = smoothstep(0, 14, age) * (1 - smoothstep(0.95, 1.0, u));
      const a = m.a + Math.sin(age * m.wobF + m.seed * 9) * m.wob * 3;
      const r = clamp(m.r + Math.sin(age * m.wobF * 0.7 + m.seed * 5) * m.wob, 0, 1);
      placeInLumen(world, g, m.slot, u, r * Math.cos(a), r * Math.sin(a), m.size * (0.9 + 0.1 * alpha), m.axis, m.seed * TAU + m.spin * age, m.colour, alpha, m.emissive, m.seed);
    }
    for (const g of [...world.molecules, world.rods, world.cocci, world.clumps]) for (let i = 0; i < g.count; i++) g.hide(i);

    const shot = shotAt(f);
    return { view: shotToView(shot, f, f / 600, f), post: DEFAULT_POST };
  },
};
