import { Fn, abs, dot, float, floor, fract, mix, sin, smoothstep, vec2, vec3 } from "three/tsl";
import type { TSL, TSLInput } from "./tsl";

/**
 * Cheap procedural noise for surface detail.
 *
 * The cloud volumes read from baked 3D textures because they are sampled dozens
 * of times per pixel; paint wear is sampled once, so evaluating it in the
 * shader is the cheaper trade and avoids another texture upload.
 */

/**
 * Scalar hash of a lattice point.
 *
 * Deliberately sin-free. The familiar `fract(sin(dot(p, k)) * 43758.5)` costs a
 * transcendental per lattice corner, and value noise needs eight of them per
 * octave — which on a software rasteriser made the container paint the single
 * most expensive thing in the frame, ahead of all its geometry. This is Dave
 * Hoskins' hash: a handful of multiplies and fracts, same quality for noise.
 */
export const hash13 = Fn(([p]: [TSL]) => {
  const q = fract(floor(p).mul(vec3(0.1031, 0.1030, 0.0973))).toVar();
  q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
});

/** Trilinearly interpolated value noise in [0, 1]. */
export const valueNoise3 = Fn(([p]: [TSL]) => {
  const i = floor(p);
  const f = fract(p);
  // Quintic fade: continuous second derivative, so no lattice creases show up
  // across a flat container wall.
  const u = f.mul(f).mul(f).mul(f.mul(f.mul(6).sub(15)).add(10));

  const c000 = hash13(i);
  const c100 = hash13(i.add(vec3(1, 0, 0)));
  const c010 = hash13(i.add(vec3(0, 1, 0)));
  const c110 = hash13(i.add(vec3(1, 1, 0)));
  const c001 = hash13(i.add(vec3(0, 0, 1)));
  const c101 = hash13(i.add(vec3(1, 0, 1)));
  const c011 = hash13(i.add(vec3(0, 1, 1)));
  const c111 = hash13(i.add(vec3(1, 1, 1)));

  const x00 = mix(c000, c100, u.x);
  const x10 = mix(c010, c110, u.x);
  const x01 = mix(c001, c101, u.x);
  const x11 = mix(c011, c111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
});

/**
 * Three-octave fBm in [0, 1].
 *
 * Three rather than four: the fourth octave lands below a texel at every
 * distance these shots actually use, so it cost an eighth of the material's
 * budget to produce noise no frame could resolve.
 */
export const fbm3 = Fn(([p]: [TSL]) => {
  const n1 = valueNoise3(p).mul(0.5714);
  const n2 = valueNoise3(p.mul(2.03)).mul(0.2857);
  const n3 = valueNoise3(p.mul(4.01)).mul(0.1429);
  return n1.add(n2).add(n3);
});

/** Ridged fBm — sharper crests, good for rust and salt bloom. */
export const ridged3 = Fn(([p]: [TSL]) => {
  const a = float(1).sub(abs(valueNoise3(p).mul(2).sub(1))).mul(0.65);
  const b = float(1).sub(abs(valueNoise3(p.mul(2.11)).mul(2).sub(1))).mul(0.35);
  return a.add(b);
});

/**
 * Weathering that runs downhill.
 *
 * Rain carries oxide down a container wall in narrow vertical fingers, so the
 * noise is sampled with the vertical axis heavily compressed: high frequency
 * across the wall, very low frequency down it.
 */
export const runoff = Fn(([p, frequency]: [TSL, TSL]) => {
  const stretched = vec3(p.x.mul(frequency), p.y.mul(0.08), p.z.mul(frequency));
  const streak = fbm3(stretched);
  // Push the distribution towards isolated streaks rather than even mottling.
  return smoothstep(0.36, 0.74, streak);
});

/** 2D value noise, for screen-space effects like grain. */
export const hash12 = Fn(([p]: [TSL]) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453)));

/**
 * A descending smoothstep: 1 at or below `inner`, 0 at or above `outer`.
 *
 * Calling `smoothstep` with its edges the wrong way round is undefined in both
 * GLSL and WGSL. It happens to behave on some drivers and not others, and when
 * it misbehaves it returns 1 in exactly the region the mask was meant to
 * exclude — which is how a band of cabin windows ends up painted across a tail
 * fin. Every falling mask in this project goes through here instead.
 */
export const falloff = (inner: TSLInput, outer: TSLInput, x: TSLInput): TSL =>
  smoothstep(inner, outer, x).oneMinus() as TSL;
