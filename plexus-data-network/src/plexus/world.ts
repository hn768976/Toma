import { mulberry32, pick, range } from "./random";

export type Vec3 = { x: number; y: number; z: number };

export type PlexusNode = Vec3 & {
  hub: boolean;
  brightness: number;
  label: string | null;
  boxed: boolean;
  labelSide: number;
};

export type Edge = { a: number; b: number; strength: number };

export type BokehParticle = Vec3 & { size: number; color: number; alpha: number };

export type CodeBlock = Vec3 & { lines: string[]; widths: number[] };

export type FreeLabel = Vec3 & { text: string; boxed: boolean };

export type Streak = { y: number; z: number; x0: number; x1: number; alpha: number };

export type PlexusWorld = {
  nodes: PlexusNode[];
  edges: Edge[];
  bokeh: BokehParticle[];
  dust: Vec3[];
  codeBlocks: CodeBlock[];
  freeLabels: FreeLabel[];
  streaks: Streak[];
};

const randomNumberLabel = (rnd: () => number) => {
  const r = rnd();
  if (r < 0.55) return (rnd() * 9 + 0.1).toFixed(3); // 7.154
  if (r < 0.85) return (rnd() * 900 + 100).toFixed(3); // 405.728
  return (rnd() * 90 + 10).toFixed(2); // 22.84
};

const CODE_CHARS = "0123456789ABCDEF.:-_/#x";
const codeLine = (rnd: () => number) => {
  const len = Math.floor(range(rnd, 4, 13));
  let s = "";
  for (let i = 0; i < len; i++) {
    s += rnd() < 0.18 ? " " : pick(rnd, CODE_CHARS.split(""));
  }
  return s;
};

/**
 * Builds the static 3D world once (seeded). The camera flies through it;
 * nothing here depends on time, so every frame is deterministic.
 */
export const buildWorld = (seed: number): PlexusWorld => {
  const rnd = mulberry32(seed);

  // --- Network nodes, laid out along the camera's flight corridor ---
  const nodes: PlexusNode[] = [];
  const NODE_COUNT = 470;
  for (let i = 0; i < NODE_COUNT; i++) {
    const z = range(rnd, -15, 270);
    // Nodes concentrate in the middle/upper part of the frame; the lower
    // half is dominated by the soft bokeh "floor" as in the reference.
    const yr = rnd();
    const y = yr < 0.8 ? range(rnd, -8, 30) : range(rnd, -20, -8);
    const x = range(rnd, -75, 85);
    const hub = rnd() < 0.13;
    const hasLabel = rnd() < (hub ? 0.85 : 0.42);
    nodes.push({
      x,
      y,
      z,
      hub,
      brightness: hub ? range(rnd, 0.9, 1.15) : range(rnd, 0.55, 0.95),
      label: hasLabel ? randomNumberLabel(rnd) : null,
      boxed: hasLabel && rnd() < 0.22,
      labelSide: rnd() < 0.7 ? 1 : -1,
    });
  }

  // --- Edges: k-nearest neighbours (hubs get many), deduplicated ---
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const k = n.hub ? Math.floor(range(rnd, 5, 9)) : Math.floor(range(rnd, 1, 4));
    const maxD = n.hub ? 46 : 30;
    const cands: { j: number; d: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (j === i) continue;
      const m = nodes[j];
      const dx = m.x - n.x;
      const dy = (m.y - n.y) * 1.3;
      const dz = (m.z - n.z) * 0.8;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < maxD) cands.push({ j, d });
    }
    cands.sort((p, q) => p.d - q.d);
    // Skip the very nearest occasionally so lines become long and spidery.
    let added = 0;
    for (const c of cands) {
      if (added >= k) break;
      if (rnd() < 0.25) continue;
      const key = i < c.j ? `${i}-${c.j}` : `${c.j}-${i}`;
      if (seen.has(key)) {
        added++;
        continue;
      }
      seen.add(key);
      edges.push({ a: i, b: c.j, strength: range(rnd, 0.55, 1) });
      added++;
    }
  }

  // --- Out-of-focus bokeh floor + scattered far bokeh ---
  const bokeh: BokehParticle[] = [];
  for (let i = 0; i < 1100; i++) {
    const floor = rnd() < 0.72;
    bokeh.push({
      x: range(rnd, -110, 120),
      y: floor ? range(rnd, -34, -9) : range(rnd, -8, 34),
      z: range(rnd, -5, 290),
      size: range(rnd, 0.25, 1.0),
      color: Math.floor(rnd() * 6),
      alpha: floor ? range(rnd, 0.35, 1) : range(rnd, 0.15, 0.6),
    });
  }

  // --- Fine dust specks ---
  const dust: Vec3[] = [];
  for (let i = 0; i < 700; i++) {
    dust.push({ x: range(rnd, -90, 100), y: range(rnd, -25, 30), z: range(rnd, -5, 280) });
  }

  // --- Floating tiny "code column" readouts ---
  const codeBlocks: CodeBlock[] = [];
  for (let i = 0; i < 170; i++) {
    const n = Math.floor(range(rnd, 3, 10));
    const lines: string[] = [];
    const widths: number[] = [];
    for (let l = 0; l < n; l++) {
      lines.push(codeLine(rnd));
      widths.push(range(rnd, 0.3, 1));
    }
    codeBlocks.push({
      x: range(rnd, -80, 90),
      y: range(rnd, -14, 24),
      z: range(rnd, -5, 275),
      lines,
      widths,
    });
  }

  // --- Free-floating numeric labels ---
  const freeLabels: FreeLabel[] = [];
  for (let i = 0; i < 220; i++) {
    freeLabels.push({
      x: range(rnd, -85, 95),
      y: range(rnd, -16, 26),
      z: range(rnd, -5, 275),
      text: randomNumberLabel(rnd),
      boxed: rnd() < 0.18,
    });
  }

  // --- Long horizontal light streaks ---
  const streaks: Streak[] = [];
  for (let i = 0; i < 14; i++) {
    const cx = range(rnd, -40, 60);
    const len = range(rnd, 80, 220);
    streaks.push({
      y: range(rnd, -6, 10),
      z: range(rnd, 10, 270),
      x0: cx - len / 2,
      x1: cx + len / 2,
      alpha: range(rnd, 0.25, 0.7),
    });
  }

  return { nodes, edges, bokeh, dust, codeBlocks, freeLabels, streaks };
};
