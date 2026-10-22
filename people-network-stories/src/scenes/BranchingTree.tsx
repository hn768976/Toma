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
  // Pale cross-link between neighbouring nodes (the lattice in the open fan).
  cross?: boolean;
};

const TRUNK_TOP = 0.55;
const LEVELS = 10;
const CROWN_W = 1.3; // horizontal radius of the crown envelope
const CROWN_H = 1.45; // vertical radius
const CROWN_D = 0.75; // depth radius
// Each tip ends in a few short twigs with nodes: the granular texture of the dense crown.
const TWIGS = 3;

// When each level grows (seconds): trunk 0-2, first splits 2-8, crown fills 8-24.
const LEVEL_START = [0, 2.0, 3.9, 5.8, 8.0, 10.6, 13.2, 15.8, 18.4, 21.0];
const LEVEL_DUR = [2.0, 1.8, 1.8, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0];

const buildTree = (targetTips: number) => {
  const rng = mulberry32(20602325);
  const branches: Branch[] = [];
  const O: [number, number, number] = [0, TRUNK_TOP, 0];
  branches.push({ parent: -1, level: 0, from: [0, 0, 0], to: O, start: 0, dur: 2, leaf: false });

  // Crown radius fraction reached by each level (the last level touches the envelope).
  // Inner levels stay low and narrow (a funnel of links), the crown is a dome on top.
  const reach = (lvl: number) => Math.pow(lvl / (LEVELS - 1), 1.25);
  // Mean branching per split so that the leaf count lands near the target.
  const splits = LEVELS - 1;
  const meanK = Math.pow(targetTips, 1 / splits);
  const p3 = clamp01(meanK - 2);

  type Node = { idx: number; a0: number; a1: number; b0: number; b1: number; pos: [number, number, number] };
  let frontier: Node[] = [{ idx: 0, a0: -1.5, a1: 1.5, b0: -1.0, b1: 1.0, pos: O }];
  for (let lvl = 1; lvl < LEVELS; lvl++) {
    const next: Node[] = [];
    for (const n of frontier) {
      // First split is a clear 2-way fork, like the reference.
      // The first split is three-way, so there is a central stem up to the top of the dome.
      const k = lvl === 1 ? 3 : rng() < p3 ? 3 : 2;
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
        // Tips get extra spread beyond their sector, which smooths the crown into one dome.
        const spread = lvl >= LEVELS - 2 ? 1.6 : 0.5;
        const ac = lerp(a0, a1, 0.5 + (rng() - 0.5) * spread);
        const bc = lerp(b0, b1, 0.5 + (rng() - 0.5) * 0.5);
        // Fan direction: a sweeps across the front plane (beyond +-90deg at the sides,
        // so the rim droops), b tilts towards/away from the camera.
        // Early levels stay close to vertical, so the fan fills down to the fork.
        const squeeze = lerp(0.32, 1, Math.pow(lvl / (LEVELS - 1), 1.1));
        const ae = ac * squeeze;
        const be = bc * 0.55 * squeeze;
        // Superellipse envelope: a rounded dome with steep sides (mushroom cap).
        const se = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.6);
        const dx = Math.sin(ae) * Math.cos(be);
        const dy = se(Math.cos(ae)) * Math.cos(be);
        const dz = Math.sin(be);
        // Tips end at varied radii, so the crown is a filled fan rather than a rim.
        // Tips sit in the outer shell of the dome (densest at the top).
        const r = lvl === LEVELS - 1 ? 0.62 + 0.4 * Math.sqrt(rng()) : reach(lvl) * (0.8 + rng() * 0.3);
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
        if (lvl === LEVELS - 1) {
          for (let w = 0; w < TWIGS; w++) {
            const len = 0.05 + rng() * 0.09;
            const ta = rng() * Math.PI * 2;
            const tb = (rng() - 0.5) * Math.PI;
            branches.push({
              parent: idx,
              level: LEVELS,
              from: pos,
              to: [pos[0] + Math.cos(ta) * Math.cos(tb) * len, pos[1] + Math.abs(Math.sin(ta)) * len * 0.8, pos[2] + Math.sin(tb) * len],
              start: branches[idx].start + branches[idx].dur + rng() * 2.5,
              dur: 0.5,
              leaf: true,
            });
          }
          branches[idx].leaf = false;
        }
      }
    }
    frontier = next;
    // Cross-links between neighbouring nodes of the mid levels: a fine lattice in the fan.
    if (lvl >= 3 && lvl <= 6) {
      const sorted = next.slice().sort((p, q) => p.pos[0] - q.pos[0]);
      for (let n = 0; n + 1 < sorted.length; n++) {
        const A = sorted[n];
        const B = sorted[n + 1];
        if (rng() < 0.45) continue;
        const a = branches[A.idx];
        const b = branches[B.idx];
        branches.push({
          parent: A.idx,
          level: lvl,
          from: A.pos,
          to: B.pos,
          start: Math.max(a.start + a.dur, b.start + b.dur) + rng() * 2,
          dur: 0.8,
          leaf: false,
          cross: true,
        });
      }
    }
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
  // Links: the open fan below the crown is a fine pale (pink-grey on white) web; the
  // crown's own links are red. Each line gets lighter (more transparent) towards the
  // tips; the crown reads dense and dark from the overlap and its nodes.
  const levelColor = (lvl: number): [number, number, number, number] => {
    const t = Math.min(1, lvl / (LEVELS - 1));
    if (dark) return [ink[0], ink[1], ink[2], lvl === 0 ? 0.9 : lerp(0.5, 0.09, Math.pow(t, 0.6))];
    const pale = [lerp(ink[0], 0.72, 0.55), lerp(ink[1], 0.6, 0.6), lerp(ink[2], 0.6, 0.6)];
    const k = smooth(remap(t, 0.35, 0.9));
    return [lerp(pale[0], ink[0] * 0.8, k), lerp(pale[1], ink[1] * 0.8, k), lerp(pale[2], ink[2] * 0.8, k), lvl === 0 ? 0.85 : lerp(0.75, 0.62, t)];
  };
  const tipInk = dark ? ink : rgb(COLORS.redSide).map((v) => v * 0.85);

  const baseAlpha = new Float32Array(BRANCHES.length);
  BRANCHES.forEach((b, i) => {
    lines.setEnds(i, ...b.from, ...b.to);
    const c = b.cross ? levelColor(1).map((v, k) => (k === 3 ? (dark ? 0.35 : 0.55) : v)) : levelColor(b.level);
    lines.setColor(i, c[0], c[1], c[2], c[3]);
    baseAlpha[i] = c[3];
    // Trunk stays a thin single line; branches get thinner towards the tips.
    lines.w[i] = b.level === 0 ? 1.1 : lerp(0.95, 0.5, Math.min(1, b.level / (LEVELS - 1)));
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
        lines.col[i * 4 + 3] = baseAlpha[i] * (1 + 0.35 * thick);
        if (p <= 0 || b.cross) continue;
        const x = lerp(b.from[0], b.to[0], p);
        const y = lerp(b.from[1], b.to[1], p);
        const z = lerp(b.from[2], b.to[2], p);
        const early = b.level <= 4;
        if (p < 1) {
          // Growing tip: a small node leading the line.
          const s = early ? 3.2 : 1.8;
          dots.set(d++, x, y, z, s, ink[0], ink[1], ink[2], 1);
        } else if (b.leaf) {
          const s = 1.5 + 0.7 * thick;
          if (dark) dots.set(d++, x, y, z, s, ink[0], ink[1], ink[2], 0.3 + 0.15 * thick);
          else {
            // Darker towards the top of the dome.
            const h = 0.55 + 0.45 * (1 - clamp01((y - TRUNK_TOP - 0.6) / 1.0));
            dots.set(d++, x, y, z, s, tipInk[0] * h, tipInk[1] * h, tipInk[2] * h, 0.95);
          }
        } else {
          // Junction node.
          const s = early ? 2.6 : b.level === LEVELS - 1 ? 1.9 + 0.6 * thick : 1.3;
          const c = b.level === LEVELS - 1 ? tipInk : ink;
          dots.set(d++, x, y, z, s, c[0], c[1], c[2], early ? 1 : dark ? 0.5 : 0.85);
        }
      }
      dots.setDrawCount(d);
      lines.commit();
      dots.commit();

      // Camera: slow ~40deg orbit, pulling back as the crown widens.
      // Everything settles by 28s: the last 2s hold.
      const az = THREE.MathUtils.degToRad(lerp(-20, 20, smooth(t / 28)));
      const dist = keyframes(t, [
        [0, 2.2],
        [2, 2.4],
        [8, 3.0],
        [16, 4.0],
        [24, 4.45],
        [28, 4.5],
      ]);
      const lookY = keyframes(t, [
        [0, 0.4],
        [2, 0.55],
        [8, 0.8],
        [16, 1.0],
        [28, 1.06],
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
const CYAN_GLOW: GlowOptions = { near: 0.35, far: 0.15 };

export const BranchingTreeRed: React.FC = () => <Stage create={createRed} background={COLORS.lightBackground} />;
export const BranchingTreeCyan: React.FC = () => (
  <Stage create={createCyan} background={COLORS.darkBackground} glow={CYAN_GLOW} />
);

