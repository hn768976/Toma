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
const level = (i: number, j: number) => {
  // Lower outer blocks and two small raised blocks, like the layered reference.
  const c = (G - 1) / 2;
  const di = i - c;
  const dj = j - c;
  if (di > 3 && di < 9 && dj > -10 && dj < -3) return 1;
  if (di < -5 && di > -11 && dj > 2 && dj < 7) return 1;
  if (Math.max(Math.abs(di), Math.abs(dj)) > c - 5 && ((i * 7 + j * 3) % 11 < 6 || Math.abs(dj) > c - 2)) return -1;
  if (dj > c - 9 && di < -2) return -1;
  return 0;
};

const CELLS: Cell[] = [];
const idx = (i: number, j: number) => i * G + j;
for (let i = 0; i < G; i++)
  for (let j = 0; j < G; j++) {
    const c = (G - 1) / 2;
    CELLS.push({ i, j, x: (i - c) * SPACING, y: level(i, j) * LEVEL, z: (j - c) * SPACING, at: 1e9, parent: -1 });
  }

// Growth: first a row of six people hopping one to the next (0-5s), then a randomised
// frontier expansion (closer to the centre first) until the whole grid is filled at 27s.
const ORDER: number[] = [];
{
  const c = Math.floor((G - 1) / 2);
  const j0 = c + 2;
  const seen = new Uint8Array(G * G);
  for (let k = 0; k < 6; k++) {
    const id = idx(c - 2 + k, j0);
    ORDER.push(id);
    seen[id] = 1;
    if (k > 0) CELLS[id].parent = idx(c - 3 + k, j0);
  }
  const frontier: number[] = [];
  const push = (from: number) => {
    const { i, j } = CELLS[from];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a;
      const nj = j + b;
      if (ni < 0 || nj < 0 || ni >= G || nj >= G) continue;
      const id = idx(ni, nj);
      if (seen[id]) continue;
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
    for (let s = 0; s < 6; s++) {
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
      const ni = c.i + a;
      const nj = c.j + b;
      if (ni >= G || nj >= G) continue;
      const o = idx(ni, nj);
      if (CELLS[o].parent === id || c.parent === o) continue;
      if (r2() < 0.25) continue;
      const t = Math.max(c.at, CELLS[o].at) + 0.4 + r2() * 1.6;
      LINKS.push({ a: id, b: o, at: t, dur: 0.45 });
    }
  }
}
const SEGS = 8;

const glow: GlowOptions = { near: 0.5, far: 0.25 };

const createScene = (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, info.width / info.height, 0.05, 300);
  const people = new People(CELLS.length, (i) => (i * 2654435761) % 5 < 2, { front: COLORS.blue, side: "#1474B4" });
  const arcs = new Lines(LINKS.length * SEGS, info, { width: 0.85, additive: true });
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
    const my = Math.max(ay, by) + 0.45 * d;
    const mz = (az + bz) / 2;
    const v = 1 - u;
    return [v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by, v * v * az + 2 * v * u * mz + u * u * bz];
  };
  LINKS.forEach((l, li) => {
    for (let k = 0; k < SEGS; k++) {
      const p0 = ctrl(CELLS[l.a], CELLS[l.b], k / SEGS);
      const p1 = ctrl(CELLS[l.a], CELLS[l.b], (k + 1) / SEGS);
      arcs.setEnds(li * SEGS + k, ...p0, ...p1);
      arcs.setColor(li * SEGS + k, 0.92, 0.97, 1, 0.42);
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
        people.set(i, c.x, c.y, c.z, PERSON_H, pop, 0);
        heads.set(i, c.x, c.y + headY, c.z, lerp(3.2, 2.6, far), blue[0] * 0.5 + 0.4, blue[1] * 0.5 + 0.45, 1, lerp(0.35, 0.75, far));
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
          heads.set(d++, pos[0], pos[1], pos[2], 9, 0.75, 0.95, 1, 0.95 * fade);
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
        keyframes(t, [[0, -2.4], [3, 0], [12, 0], [30, 0]]),
        keyframes(t, [[0, headY], [5, 0.4], [20, -0.4], [30, -0.5]]),
        keyframes(t, [[0, 2], [5, 2], [20, 2.5], [30, 3.5]]),
      );
      void c;
      const dist = keyframes(t, [[0, 5.5], [5, 8], [12, 18], [20, 31], [28, 47], [30, 47.5]]);
      const elev = THREE.MathUtils.degToRad(keyframes(t, [[0, 8], [5, 12], [20, 35], [28, 40], [30, 40]]));
      const az = THREE.MathUtils.degToRad(keyframes(t, [[0, 0], [30, 14]], (x) => x));
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
