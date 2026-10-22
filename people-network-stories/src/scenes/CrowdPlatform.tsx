import React from "react";
import * as THREE from "three";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { clamp01, easeOut, keyframes, lerp, remap, smooth } from "../lib/ease";
import { mulberry32 } from "../lib/random";
import { Dots } from "../lib/three/dots";
import { Lines } from "../lib/three/lines";
import { People } from "../lib/three/people";
import { GlowOptions, SceneRuntime, Stage, StageInfo } from "../lib/three/Stage";

// Blue people on a square grid platform (with some blocks one level lower and a few
// raised), linked head-to-head by thin curved arcs, growing outwards from one row.
const G = COUNTS.crowdPlatformSize;
const SPACING = 1;
const PERSON_H = 0.5;
const LEVEL = 1.5;
const DURATION = 30;

type Cell = { i: number; j: number; x: number; y: number; z: number; at: number; parent: number };

const rng = mulberry32(3158116);
// The grid has a margin around the G x G core for strands that wander outwards.
const M = 10;
const E = G + 2 * M;
const C = (E - 1) / 2;
const level = (i: number, j: number) => {
  // Lower outer blocks and two small raised blocks, like the layered reference.
  const c = (G - 1) / 2;
  const di = i - M - c;
  const dj = j - M - c;
  if (di > 3 && di < 9 && dj > -10 && dj < -3) return 1;
  if (di < -5 && di > -11 && dj > 2 && dj < 7) return 1;
  if (Math.max(Math.abs(di), Math.abs(dj)) > c - 5 && ((i * 7 + j * 3) % 11 < 6 || Math.abs(dj) > c - 2)) return -1;
  if (dj > c - 9 && di < -2) return -1;
  return 0;
};

// Which grid points hold a person: the core, with random gaps away from the centre,
// plus strands that walk out from its edges (an irregular, growing network).
const active = new Uint8Array(E * E);
for (let i = M; i < M + G; i++)
  for (let j = M; j < M + G; j++) {
    const r = Math.max(Math.abs(i - C), Math.abs(j - C)) / (G / 2);
    active[i * E + j] = rng() < (r < 0.45 ? 0.97 : 0.68) ? 1 : 0;
  }
for (let k = 0; k < Math.round(G * 1.3); k++) {
  // Start on the core's edge and wander outwards.
  const side = Math.floor(rng() * 4);
  const u = M + Math.floor(rng() * G);
  let i = side === 0 ? M : side === 1 ? M + G - 1 : u;
  let j = side === 2 ? M : side === 3 ? M + G - 1 : u;
  const out = [[-1, 0], [1, 0], [0, -1], [0, 1]][side];
  const steps = 3 + Math.floor(rng() * 8);
  for (let st = 0; st < steps; st++) {
    const turn = rng();
    const d = turn < 0.6 ? out : turn < 0.8 ? [out[1], out[0]] : [-out[1], -out[0]];
    i = Math.min(E - 1, Math.max(0, i + d[0]));
    j = Math.min(E - 1, Math.max(0, j + d[1]));
    active[i * E + j] = 1;
  }
}

const CELLS: Cell[] = [];
const cellAt = new Int32Array(E * E).fill(-1);
const idx = (i: number, j: number) => (i < 0 || j < 0 || i >= E || j >= E ? -1 : cellAt[i * E + j]);
for (let i = 0; i < E; i++)
  for (let j = 0; j < E; j++) {
    if (!active[i * E + j]) continue;
    cellAt[i * E + j] = CELLS.length;
    const core = i >= M && i < M + G && j >= M && j < M + G;
    // Strands in the far-left quadrant float one level up (the loose fragments).
    const lv = core ? level(i, j) : i < M + 6 && j < M + 6 ? 1 : 0;
    // Jittered, gently wavy sheet rather than a strict lattice.
    const wave = 0.35 * Math.sin(i * 0.31 + 1.3) * Math.cos(j * 0.27);
    CELLS.push({
      i, j,
      x: (i - C + (rng() - 0.5) * 0.45) * SPACING,
      y: lv * LEVEL + wave,
      z: (j - C + (rng() - 0.5) * 0.45) * SPACING,
      at: 1e9, parent: -1,
    });
  }

// Growth: first a row of six people hopping one to the next (0-5s), then a randomised
// frontier expansion (closer to the centre first) until everyone has arrived at 27s.
// Hops may jump a one-cell gap.
const ORDER: number[] = [];
{
  const c = Math.round(C);
  const j0 = c + 2;
  const seen = new Uint8Array(CELLS.length);
  const first: number[] = [];
  for (let k = 0; k < 6; k++) {
    let id = idx(c - 2 + k, j0);
    if (id < 0) {
      cellAt[(c - 2 + k) * E + j0] = CELLS.length;
      CELLS.push({ i: c - 2 + k, j: j0, x: (c - 2 + k - C) * SPACING, y: 0, z: (j0 - C) * SPACING, at: 1e9, parent: -1 });
      id = CELLS.length - 1;
    }
    first.push(id);
  }
  first.forEach((id, k) => {
    ORDER.push(id);
    seen[id] = 1;
    if (k > 0) CELLS[id].parent = first[k - 1];
  });
  const frontier: number[] = [];
  const push = (from: number) => {
    const { i, j } = CELLS[from];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let id = idx(i + a, j + b);
      if (id < 0) id = idx(i + 2 * a, j + 2 * b);
      if (id < 0 || seen[id]) continue;
      seen[id] = 1;
      CELLS[id].parent = from;
      frontier.push(id);
    }
  };
  ORDER.forEach(push);
  while (frontier.length) {
    // Pick among the best few by distance to the centre (organic, roughly square growth).
    let best = 0;
    let bestScore = Infinity;
    for (let s2 = 0; s2 < 6; s2++) {
      const k = Math.floor(rng() * frontier.length);
      const cl = CELLS[frontier[k]];
      const score = Math.max(Math.abs(cl.i - c), Math.abs(cl.j - j0 + 1.5)) + rng() * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    const id = frontier.splice(best, 1)[0];
    ORDER.push(id);
    push(id);
  }
  const N = ORDER.length;
  ORDER.forEach((id, k) => {
    let t: number;
    if (k < 6) t = 0.4 + k * 0.75;
    else {
      // Count grows steadily: ~45% by 20s, all by 27s.
      const u = (k - 6) / (N - 6);
      t = 5 + 22 * Math.pow(u, 0.62);
    }
    CELLS[id].at = t;
  });
}

// Links: each person's parent arc (the hop that brought them), plus later arcs to other
// neighbours, which turn the arcs into a mesh.
type Link = { a: number; b: number; at: number; dur: number };
const LINKS: Link[] = [];
{
  const r2 = mulberry32(51);
  for (const id of ORDER) {
    const c = CELLS[id];
    if (c.parent >= 0) LINKS.push({ a: c.parent, b: id, at: c.at - 0.4, dur: 0.4 });
  }
  for (const id of ORDER) {
    const c = CELLS[id];
    for (const [a, b] of [[1, 0], [0, 1]]) {
      const o = idx(c.i + a, c.j + b);
      if (o < 0 || CELLS[o].at > 1e8) continue;
      if (CELLS[o].parent === id || c.parent === o) continue;
      if (r2() < 0.25) continue;
      const t = Math.max(c.at, CELLS[o].at) + 0.4 + r2() * 1.6;
      LINKS.push({ a: id, b: o, at: t, dur: 0.45 });
    }
  }
}
const SEGS = 8;

const glow: GlowOptions = { near: 0.35, far: 0.2 };

const createScene = (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, info.width / info.height, 0.05, 300);
  const people = new People(CELLS.length, (i) => (i * 2654435761) % 5 < 2, { front: COLORS.blue, side: COLORS.blueSide });
  const arcs = new Lines(LINKS.length * SEGS, info, { width: 0.75, additive: true });
  // Travelling glow on drawing arcs + small glowing node on every head.
  const heads = new Dots(CELLS.length + LINKS.length, info, camera, { soft: true, additive: true, depthTest: false });
  scene.add(people.group, arcs.mesh, heads.mesh);
  const blue = rgb(COLORS.blue);
  const headY = PERSON_H * 1.02;
  const ctrl = (a: Cell, b: Cell, u: number): [number, number, number] => {
    const ax = a.x, ay = a.y + headY, az = a.z;
    const bx = b.x, by = b.y + headY, bz = b.z;
    const d = Math.hypot(bx - ax, by - ay, bz - az);
    const mx = (ax + bx) / 2;
    const my = Math.max(ay, by) + 0.3 * d;
    const mz = (az + bz) / 2;
    const v = 1 - u;
    return [v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by, v * v * az + 2 * v * u * mz + u * u * bz];
  };
  LINKS.forEach((l, li) => {
    for (let k = 0; k < SEGS; k++) {
      const p0 = ctrl(CELLS[l.a], CELLS[l.b], k / SEGS);
      const p1 = ctrl(CELLS[l.a], CELLS[l.b], (k + 1) / SEGS);
      arcs.setEnds(li * SEGS + k, ...p0, ...p1);
      arcs.setColor(li * SEGS + k, 1, 0.95, 0.84, 0.34);
    }
  });

  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      // As the camera rises the people read as dots; the nodes take over.
      const far = smooth(remap(t, 14, 26));
      CELLS.forEach((c, i) => {
        if (t < c.at) {
          people.hide(i);
          heads.hide(i);
          return;
        }
        const pop = 1 + 0.25 * Math.max(0, 1 - (t - c.at) / 0.35);
        people.set(i, c.x, c.y, c.z, PERSON_H, 0.8 * pop, 0);
        heads.set(i, c.x, c.y + headY, c.z, lerp(3.0, 2.6, far), blue[0], blue[1], blue[2], lerp(0.3, 0.6, far));
      });
      let d = CELLS.length;
      LINKS.forEach((l, li) => {
        const p = easeOut(clamp01((t - l.at) / l.dur), 2);
        for (let k = 0; k < SEGS; k++) {
          const s0 = k / SEGS;
          const s1 = (k + 1) / SEGS;
          const r = clamp01((p - s0) / (s1 - s0));
          arcs.setRange(li * SEGS + k, 0, r);
        }
        // Glowing dot travelling along the arc while it draws (and briefly after).
        const age = t - l.at;
        if (age >= 0 && age < l.dur + 0.25) {
          const pos = ctrl(CELLS[l.a], CELLS[l.b], p);
          const fade = 1 - clamp01((age - l.dur) / 0.25);
          heads.set(d++, pos[0], pos[1], pos[2], 7, blue[0] * 0.6 + 0.3, blue[1] * 0.6 + 0.35, 1, 0.8 * fade);
        }
      });
      heads.setDrawCount(d);
      for (let i = d; i < heads.count; i++) heads.hide(i);
      people.commit();
      arcs.commit();
      heads.commit();
      // Camera: low and close on the first row, then rising and tilting down to ~35deg.
      const c = (G - 1) / 2;
      const target = new THREE.Vector3(
        keyframes(t, [[0, -2.4], [3, 0], [12, 0], [28, 2]]),
        keyframes(t, [[0, headY], [5, 0.4], [20, -0.4], [28, -0.5]]),
        keyframes(t, [[0, 2], [5, 2], [20, 2.5], [28, 2.5]]),
      );
      void c;
      const dist = keyframes(t, [[0, 5.5], [5, 8], [12, 18], [20, 30], [28, 46]]);
      const elev = THREE.MathUtils.degToRad(keyframes(t, [[0, 8], [5, 12], [20, 30], [28, 34]]));
      const az = THREE.MathUtils.degToRad(keyframes(t, [[0, 0], [27, 13], [28, 13.3]], (x) => x));
      camera.position.set(
        target.x + Math.sin(az) * Math.cos(elev) * dist,
        target.y + Math.sin(elev) * dist,
        target.z + Math.cos(az) * Math.cos(elev) * dist,
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
    },
  };
};

export const CrowdPlatformBlue: React.FC = () => <Stage create={createScene} background={COLORS.darkBackground} glow={glow} />;
export const crowdPlatformDuration = DURATION;
