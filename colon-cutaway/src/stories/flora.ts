import * as THREE from "three";
import type { ColonWorld } from "../three/ColonWorld";
import { BACTERIA_COLOURS, MOLECULE_COLOURS } from "../three/ColonWorld";
import { clamp, TAU, wrap01 } from "../lib/math";
import { mulberry32, pick, range } from "../lib/random";
import { DEFAULT_POST, endFade, FrameState, placeInLumen, randomAxis, Shot, shotToView, Story } from "./common";

// Composition 2 — Healthy Flora (600 frames, seamless loop)
// Everything is a function of t = frame / 600 with whole-number frequencies:
//   u = wrap(u0 + k*t + a*sin(2*pi*(m*t + phase)))   k, m integers
// so frame 600 is identical to frame 0.

export const LOOP = 600;
const rng = mulberry32(2002);

type Drifter = {
  group: "rod" | "coccus" | "mol";
  type: number;
  slot: number;
  u0: number;
  k: number;
  au: number;
  mu: number;
  pu: number;
  r0: number;
  ar: number;
  mr: number;
  pr: number;
  a0: number;
  aa: number;
  ma: number;
  pa: number;
  axis: THREE.Vector3;
  s0: number;
  ms: number;
  size: number;
  colour: THREE.Color;
  emissive: number;
  seed: number;
  front: boolean;
};

const ints = [1, 2, 3];
const makeDrifter = (group: Drifter["group"], type: number, slot: number, front: boolean): Drifter => {
  const k = rng() < 0.82 ? 1 : 2;
  const sizeBase = group === "rod" ? range(rng, 0.17, 0.24) : group === "coccus" ? range(rng, 0.09, 0.125) : range(rng, 0.06, 0.09);
  return {
    group,
    type,
    slot,
    u0: rng(),
    k,
    au: range(rng, 0.004, 0.014) / k,
    mu: pick(rng, ints),
    pu: rng(),
    r0: front ? range(rng, 0.85, 1.0) : Math.sqrt(rng()) * 0.92,
    ar: range(rng, 0.03, 0.1),
    mr: pick(rng, ints),
    pr: rng(),
    a0: front ? (rng() < 0.5 ? -1 : 1) * range(rng, 1.75, 2.1) : rng() * TAU,
    aa: front ? range(rng, 0.05, 0.12) : range(rng, 0.15, 0.5),
    ma: pick(rng, ints),
    pa: rng(),
    axis: randomAxis(rng),
    s0: rng() * TAU,
    ms: (rng() < 0.5 ? -1 : 1) * pick(rng, ints),
    size: sizeBase * (front ? 1.25 : 1),
    colour: group === "mol" ? pick(rng, MOLECULE_COLOURS) : pick(rng, BACTERIA_COLOURS),
    emissive: group === "mol" && rng() < 0.35 ? range(rng, 1.2, 2.0) : 0,
    seed: rng(),
    front,
  };
};

const drifters: Drifter[] = [];
for (let i = 0; i < 150; i++) drifters.push(makeDrifter("rod", 0, i, i < 12));
for (let i = 0; i < 80; i++) drifters.push(makeDrifter("coccus", 0, i, i < 6));
for (let type = 0; type < 4; type++) for (let i = 0; i < 45; i++) drifters.push(makeDrifter("mol", type, i, false));

const BASE: Shot = { target: [0.0, -0.2, 0], dist: 27, yaw: 6, pitch: -10, fov: 30, aperture: 0.03, maxCoc: 0.0045 };

export const floraStory: Story = {
  id: "Colon-HealthyFlora",
  durationInFrames: LOOP,
  update(world: ColonWorld, frame: number): FrameState {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const t = f / LOOP;
    world.setPatches([]);
    for (const d of drifters) {
      const grp = d.group === "rod" ? world.rods : d.group === "coccus" ? world.cocci : world.molecules[d.type];
      const u = wrap01(d.u0 + d.k * t + d.au * Math.sin(TAU * (d.mu * t + d.pu)));
      const r = clamp(d.r0 + d.ar * Math.sin(TAU * (d.mr * t + d.pr)), 0, 1);
      const a = d.a0 + d.aa * Math.sin(TAU * (d.ma * t + d.pa));
      // ox: across the tube (side), oy: toward the back wall (+) / camera (-)
      const ox = r * Math.sin(a);
      const oy = r * Math.cos(a);
      const fade = endFade(u);
      const spin = d.s0 + TAU * d.ms * t;
      placeInLumen(world, grp, d.slot, u, ox, oy, d.size * (0.9 + 0.1 * fade), d.axis, spin, d.colour, fade, d.emissive, d.seed);
    }
    for (const g of [...world.cool, world.spikes, world.clumps]) for (let i = 0; i < g.count; i++) g.hide(i);
    for (let type = 0; type < 4; type++) for (let i = 45; i < world.molecules[type].count; i++) world.molecules[type].hide(i);

    const shot: Shot = {
      ...BASE,
      yaw: BASE.yaw + 3 * Math.sin(TAU * t),
      pitch: BASE.pitch + 2 * Math.sin(TAU * t + 1.1),
      dist: BASE.dist + 0.35 * Math.cos(TAU * t),
    };
    // focus a touch behind the centre plane, so the bacteria riding near the
    // cut edge (closest to camera) go softly out of focus
    const view = shotToView(shot, f, t, f, new THREE.Vector3(0.0, -0.2, -0.6));
    return { view, post: DEFAULT_POST };
  },
};
