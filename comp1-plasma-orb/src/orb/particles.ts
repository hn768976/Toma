import * as THREE from "three";
import { createRandom } from "./random";

export type LayerId = 0 | 1 | 2 | 3;

const makeGeometry = (
  count: number,
  fill: (i: number, seed: number[], param: number[]) => void,
) => {
  const seeds = new Float32Array(count * 4);
  const params = new Float32Array(count * 4);
  const s = [0, 0, 0, 0];
  const p = [0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    fill(i, s, p);
    seeds.set(s, i * 4);
    params.set(p, i * 4);
  }
  const g = new THREE.BufferGeometry();
  // Positions are computed in the vertex shader; this attribute only exists
  // so three.js knows the vertex count.
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  g.setAttribute("aParam", new THREE.BufferAttribute(params, 4));
  return g;
};

export const buildMotes = (count: number) => {
  const rnd = createRandom(1001);
  return makeGeometry(count, (_i, s, p) => {
    s[0] = rnd(); s[1] = rnd(); s[2] = rnd(); s[3] = rnd();
    p[0] = 0.98 * Math.pow(rnd(), 0.55); // radius, biased outward
    p[1] = rnd(); // angular speed
    p[2] = Math.pow(rnd(), 3); // size (mostly tiny)
    p[3] = 0.4 + rnd() * 0.6; // brightness
  });
};

export const buildStrands = (strands: number, perStrand: number) => {
  const rnd = createRandom(2002);
  return makeGeometry(strands * perStrand, (i, s, p) => {
    const strand = Math.floor(i / perStrand);
    const u = (i % perStrand) / (perStrand - 1);
    s[0] = 0.6 + rnd() * 0.4; s[1] = rnd(); s[2] = rnd(); s[3] = rnd();
    p[0] = strand + 1; p[1] = u; p[2] = 0; p[3] = 0;
  });
};

export const buildSparks = (count: number) => {
  const rnd = createRandom(3003);
  return makeGeometry(count, (_i, s, p) => {
    s[0] = rnd(); s[1] = rnd(); s[2] = rnd(); s[3] = rnd();
    p[0] = rnd(); p[1] = rnd(); p[2] = rnd(); p[3] = rnd();
  });
};

/** Background dust in a thick spherical shell around the orb. */
export const buildDust = (count: number) => {
  const rnd = createRandom(4004);
  return makeGeometry(count, (_i, s, p) => {
    const r = 1.6 + Math.pow(rnd(), 1.3) * 14;
    const z = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const k = Math.sqrt(1 - z * z);
    s[0] = r * k * Math.cos(a);
    s[1] = r * k * Math.sin(a) * 0.6;
    s[2] = r * z;
    const big = rnd();
    p[0] = rnd(); p[1] = rnd(); p[2] = big;
    // size in world units (a few are large, very soft bokeh specks)
    // ~35% are larger, softer bokeh motes; the rest are faint specks.
    s[3] = big > 0.65 ? 0.05 + rnd() * 0.1 : 0.012 + rnd() * 0.02;
    p[3] = big > 0.65 ? 0.03 + rnd() * 0.09 : 0.04 + Math.pow(rnd(), 2) * 0.22;
  });
};
