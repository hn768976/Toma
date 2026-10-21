import React from "react";
import * as THREE from "three";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { clamp01, keyframes, lerp, remap, smooth } from "../lib/ease";
import { mulberry32 } from "../lib/random";
import { Dots } from "../lib/three/dots";
import { Lines } from "../lib/three/lines";
import { GlowOptions, SceneRuntime, Stage, StageInfo } from "../lib/three/Stage";

// ---------------------------------------------------------------------------
// The tree, built once. Every branch owns an angular sector of the crown
// (a = sideways angle from vertical, b = angle in depth); each split divides its
// sector between 2-3 children, so tips spread evenly into a fan wider than tall.
// ---------------------------------------------------------------------------

type Branch = {
  parent: number;
  level: number;
  from: [number, number, number];
  to: [number, number, number];
  start: number; // seconds
  dur: number;
  leaf: boolean;
};

const TRUNK_TOP = 1.0;
const LEVELS = 10;
const CROWN_W = 1.85; // horizontal radius of the crown envelope
const CROWN_H = 1.4; // vertical radius
const CROWN_D = 0.85; // depth radius

// When each level grows (seconds): trunk 0-2, first splits 2-8, crown fills 8-24.
const LEVEL_START = [0, 2.0, 3.9, 5.8, 8.0, 10.6, 13.2, 15.8, 18.4, 21.0];
const LEVEL_DUR = [2.0, 1.8, 1.8, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0];

const buildTree = (targetTips: number) => {
  const rng = mulberry32(20602325);
  const branches: Branch[] = [];
  const O: [number, number, number] = [0, TRUNK_TOP, 0];
  branches.push({ parent: -1, level: 0, from: [0, 0, 0], to: O, start: 0, dur: 2, leaf: false });

  // Crown radius fraction reached by each level (the last level touches the envelope).
  const reach = (lvl: number) => Math.pow(lvl / (LEVELS - 1), 0.85);
  // Mean branching per split so that the leaf count lands near the target.
  const splits = LEVELS - 1;
  const meanK = Math.pow(targetTips, 1 / splits);
  const p3 = clamp01(meanK - 2);

  type Node = { idx: number; a0: number; a1: number; b0: number; b1: number; pos: [number, number, number] };
  let frontier: Node[] = [{ idx: 0, a0: -1.62, a1: 1.62, b0: -1.0, b1: 1.0, pos: O }];
  for (let lvl = 1; lvl < LEVELS; lvl++) {
    const next: Node[] = [];
    for (const n of frontier) {
      // First split is a clear 2-way fork, like the reference.
      const k = lvl === 1 ? 2 : rng() < p3 ? 3 : 2;
      const wa = n.a1 - n.a0;
      const wb = n.b1 - n.b0;
      const splitA = wa * 1.0 >= wb * 0.9;
      // Random proportions for each child's share of the sector.
      const cuts = [0];
      let acc = 0;
      const parts: number[] = [];
      for (let c = 0; c < k; c++) {
        const p = 0.7 + rng() * 0.6;
        parts.push(p);
        acc += p;
      }
      for (let c = 0; c < k; c++) cuts.push(cuts[c] + parts[c] / acc);
      for (let c = 0; c < k; c++) {
        const s0 = cuts[c];
        const s1 = cuts[c + 1];
        const a0 = splitA ? lerp(n.a0, n.a1, s0) : n.a0;
        const a1 = splitA ? lerp(n.a0, n.a1, s1) : n.a1;
        const b0 = splitA ? n.b0 : lerp(n.b0, n.b1, s0);
        const b1 = splitA ? n.b1 : lerp(n.b0, n.b1, s1);
        const ac = lerp(a0, a1, 0.5 + (rng() - 0.5) * 0.5);
        const bc = lerp(b0, b1, 0.5 + (rng() - 0.5) * 0.5);
        // Fan direction: a sweeps across the front plane (beyond +-90deg at the sides,
        // so the rim droops), b tilts towards/away from the camera.
        // Early levels stay close to vertical, so the fan fills down to the fork.
        const squeeze = lerp(0.3, 1, Math.pow(lvl / (LEVELS - 1), 0.6));
        const ae = ac * squeeze;
        const be = bc * 0.55 * squeeze;
        const dx = Math.sin(ae) * Math.cos(be);
        const dy = Math.cos(ae) * Math.cos(be);
        const dz = Math.sin(be);
        // Tips end at varied radii, so the crown is a filled fan rather than a rim.
        const r = lvl === LEVELS - 1 ? 0.5 + 0.55 * Math.sqrt(rng()) : reach(lvl) * (0.78 + rng() * 0.3);
        const pos: [number, number, number] = [
          O[0] + dx * CROWN_W * r,
          O[1] + dy * CROWN_H * r + (lvl === 1 ? 0.05 : 0),
          O[2] + dz * CROWN_D * r * 1.6,
        ];
        const idx = branches.length;
        const jitter = rng() * 0.45 * LEVEL_DUR[lvl];
        branches.push({
          parent: n.idx,
          level: lvl,
          from: n.pos,
          to: pos,
          start: LEVEL_START[lvl] + jitter,
          dur: LEVEL_DUR[lvl] * (0.55 + rng() * 0.2),
          leaf: lvl === LEVELS - 1,
        });
        next.push({ idx, a0, a1, b0, b1, pos });
      }
    }
    frontier = next;
  }
  return branches;
};

const BRANCHES = buildTree(COUNTS.branchingTreeTips);
const LEAF_COUNT = BRANCHES.filter((b) => b.leaf).length;

export const branchingTreeStats = { branches: BRANCHES.length, tips: LEAF_COUNT };

// ---------------------------------------------------------------------------

type Variant = "red" | "cyan";

const makeCreate = (variant: Variant) => (info: StageInfo): SceneRuntime => {
  const dark = variant === "cyan";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, info.width / info.height, 0.05, 100);
  const lines = new Lines(BRANCHES.length, info, { width: 0.9, additive: dark, depthTest: false });
  // Tip dots, plus a moving node at the end of every growing branch.
  const dots = new Dots(BRANCHES.length * 2, info, camera, { additive: dark, depthTest: false });
  scene.add(lines.mesh, dots.mesh);

  const ink = dark ? rgb(COLORS.cyan) : rgb(COLORS.red);
  const bg = dark ? rgb(COLORS.darkBackground) : rgb(COLORS.lightBackground);
  // Lighter towards the tips: on white mix towards the background, on black dim.
  const levelColor = (lvl: number): [number, number, number, number] => {
    const t = lvl / (LEVELS - 1);
    if (dark) return [ink[0], ink[1], ink[2], lerp(0.95, 0.16, Math.pow(t, 0.6))];
    return [
      lerp(ink[0] * 0.8, ink[0], t),
      lerp(ink[1] * 0.8, lerp(ink[1], bg[1], 0.25), t),
      lerp(ink[2] * 0.8, lerp(ink[2], bg[2], 0.25), t),
      lerp(0.95, 0.55, Math.pow(t, 0.7)),
    ];
  };

  BRANCHES.forEach((b, i) => {
    lines.setEnds(i, ...b.from, ...b.to);
    const c = levelColor(b.level);
    lines.setColor(i, c[0], c[1], c[2], c[3]);
    // Trunk stays a thin single line; branches get thinner towards the tips.
    lines.w[i] = b.level === 0 ? 1.25 : lerp(1.15, 0.55, b.level / (LEVELS - 1));
  });

  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      // 24-28s: the crown thickens into a dense mass (tip dots grow, links firm up).
      const thick = smooth(remap(t, 23.5, 28));
      let d = 0;
      for (let i = 0; i < BRANCHES.length; i++) {
        const b = BRANCHES[i];
        const p = smooth(clamp01((t - b.start) / b.dur));
        lines.setRange(i, 0, p);
        const c = levelColor(b.level);
        lines.col[i * 4 + 3] = c[3] * (1 + 0.35 * thick);
        if (p <= 0) continue;
        const x = lerp(b.from[0], b.to[0], p);
        const y = lerp(b.from[1], b.to[1], p);
        const z = lerp(b.from[2], b.to[2], p);
        const early = b.level <= 4;
        if (p < 1) {
          // Growing tip: a small node leading the line.
          const s = early ? 3.2 : 1.8;
          dots.set(d++, x, y, z, s, ink[0], ink[1], ink[2], 1);
        } else if (b.leaf) {
          const s = 1.35 + 0.9 * thick;
          if (dark) dots.set(d++, x, y, z, s, ink[0], ink[1], ink[2], 0.45 + 0.25 * thick);
          else dots.set(d++, x, y, z, s, ink[0] * 0.85, ink[1], ink[2], 0.85 + 0.15 * thick);
        } else {
          // Junction node.
          const s = early ? 2.6 : 1.3;
          dots.set(d++, x, y, z, s, ink[0], ink[1], ink[2], early ? 1 : 0.7);
        }
      }
      dots.setDrawCount(d);
      lines.commit();
      dots.commit();

      // Camera: slow ~40deg orbit, pulling back as the crown widens.
      const az = THREE.MathUtils.degToRad(lerp(-20, 20, smooth(t / 30)));
      const dist = keyframes(t, [
        [0, 3.0],
        [2, 3.2],
        [8, 3.9],
        [16, 5.2],
        [24, 5.9],
        [30, 6.1],
      ]);
      const lookY = keyframes(t, [
        [0, 0.75],
        [2, 0.95],
        [8, 1.25],
        [16, 1.42],
        [30, 1.45],
      ]);
      const elev = THREE.MathUtils.degToRad(6);
      camera.position.set(Math.sin(az) * Math.cos(elev) * dist, lookY + Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(0, lookY, 0);
      camera.updateMatrixWorld();
    },
  };
};

const createRed = makeCreate("red");
const createCyan = makeCreate("cyan");
const CYAN_GLOW: GlowOptions = { near: 0.55, far: 0.25 };

export const BranchingTreeRed: React.FC = () => <Stage create={createRed} background={COLORS.lightBackground} />;
export const BranchingTreeCyan: React.FC = () => (
  <Stage create={createCyan} background={COLORS.darkBackground} glow={CYAN_GLOW} />
);

