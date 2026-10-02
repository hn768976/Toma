import * as THREE from "three";
import type { ColonWorld, ViewParams } from "../three/ColonWorld";
import type { PostParams } from "../three/Post";
import type { InstancedGroup } from "../three/particles";
import { clamp, lerp, smoothstep, TAU } from "../lib/math";
import { Rng } from "../lib/random";

export type FrameState = {
  view: ViewParams;
  post: Pick<PostParams, "bloom" | "threshold" | "exposure" | "grain">;
};

export type Story = {
  id: string;
  durationInFrames: number;
  update: (world: ColonWorld, frame: number) => FrameState;
};

export const DEFAULT_POST = { bloom: 0.9, threshold: 1.25, exposure: 0.93, grain: 0.02 };

export type Shot = {
  target: [number, number, number];
  dist: number;
  yaw: number; // degrees, 0 = straight on (+z)
  pitch: number; // degrees, negative = camera below looking up
  fov: number;
  aperture: number;
  maxCoc: number;
};

export const shotLerp = (a: Shot, b: Shot, t: number): Shot => ({
  target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)],
  // distance in log space so the pull-back speed feels even
  dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), t)),
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  fov: lerp(a.fov, b.fov, t),
  aperture: lerp(a.aperture, b.aperture, t),
  maxCoc: lerp(a.maxCoc, b.maxCoc, t),
});

export const shotToView = (
  s: Shot,
  frame: number,
  specksT: number,
  grainFrame: number,
  focus?: THREE.Vector3,
): ViewParams => {
  const target = new THREE.Vector3(...s.target);
  const y = THREE.MathUtils.degToRad(s.yaw);
  const p = THREE.MathUtils.degToRad(s.pitch);
  const camPos = new THREE.Vector3(
    Math.sin(y) * Math.cos(p),
    Math.sin(p),
    Math.cos(y) * Math.cos(p),
  )
    .multiplyScalar(s.dist)
    .add(target);
  return {
    camPos,
    target,
    fov: s.fov,
    focusPoint: focus ?? target,
    aperture: s.aperture,
    maxCoc: s.maxCoc,
    specksT,
    frame: grainFrame,
  };
};

// ---------------------------------------------------------------- particles

export type Mover = {
  type: number; // which InstancedGroup
  slot: number; // instance index in that group
  colour: THREE.Color;
  size: number; // bounding radius in model units
  emissive: number;
  seed: number;
  axis: THREE.Vector3;
  spin0: number;
  r0: number; // radial offset (0..1 of the safe radius)
  a0: number; // angle of the offset
};

export const randomAxis = (rng: Rng) => {
  const z = rng() * 2 - 1;
  const a = rng() * TAU;
  const s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z);
};

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Place an object inside the lumen. Size is reduced where the lumen narrows
 * (so it never pokes through the wall), the offset is kept inside the safe
 * radius by Centreline.lumenPoint.
 */
export const placeInLumen = (
  world: ColonWorld,
  grp: InstancedGroup,
  slot: number,
  u: number,
  ox: number,
  oy: number,
  size: number,
  spinAxis: THREE.Vector3,
  spin: number,
  colour: THREE.Color,
  alpha: number,
  emissive: number,
  seed: number,
) => {
  const rIn = world.cl.innerRadius(u);
  const s = Math.min(size, rIn * 0.55);
  world.cl.lumenPoint(u, ox, oy, s, _p);
  _q.setFromAxisAngle(spinAxis, spin);
  grp.set(slot, _p, _q, s, colour, clamp(alpha), emissive, seed);
};

/** Fade at the ends of the colon: in over the first 4% of u, out over the last 4%. */
export const endFade = (u: number) => smoothstep(0, 0.04, u) * (1 - smoothstep(0.96, 1, u));
