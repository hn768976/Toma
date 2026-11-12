import { mulberry32, pick, range } from "./random";

export type Vec3 = { x: number; y: number; z: number };

export type PlexusNode = Vec3 & {
  hub: boolean;
  brightness: number;
  label: LabelSpec | null;
  labelSide: number;
};

/** A numeric readout. Some digits "tick" over time like live data. */
export type LabelSpec = {
  intDigits: number;
  decimals: number;
  seed: number;
  /** seconds between value updates (0 = static) */
  period: number;
  boxed: boolean;
};

export type Edge = { a: number; b: number; strength: number };

export type BokehParticle = Vec3 & { size: number; color: number; alpha: number };

export type NebulaBlob = Vec3 & { size: number; alpha: number; color: number };

export type CodeBlock = Vec3 & { rows: { text: string; bar: number; alpha: number }[] };

export type FreeLabel = Vec3 & { label: LabelSpec };

export type Streak = { y: number; z: number; x0: number; x1: number; alpha: number };

export type PlexusWorld = {
  nodes: PlexusNode[];
  edges: Edge[];
  bokeh: BokehParticle[];
  nebula: NebulaBlob[];
  dust: Vec3[];
  codeBlocks: CodeBlock[];
  freeLabels: FreeLabel[];
  streaks: Streak[];
};

// The camera trucks left (content flows to the right) along x, so the world
// is laid out as a long slab covering the whole camera path.
export const WORLD_X: [number, number] = [-165, 85];
export const WORLD_Z: [number, number] = [3, 125];

const makeLabel = (rnd: () => number, boxedChance: number): LabelSpec => {
  const r = rnd();
  const intDigits = r < 0.6 ? 1 : r < 0.88 ? 3 : 2; // 7.154 / 405.728 / 22.84
  return {
    intDigits,
    decimals: intDigits === 2 ? 2 : 3,
    seed: Math.floor(rnd() * 1e9),
    period: rnd() < 0.7 ? range(rnd, 0.12, 0.7) : 0,
    boxed: rnd() < boxedChance,
  };
};

const CODE_CHARS = "0123456789ABCDEF.:-_/#";
const codeLine = (rnd: () => number) => {
  const len = Math.floor(range(rnd, 3, 11));
  let s = "";
  for (let i = 0; i < len; i++) s += rnd() < 0.12 ? " " : pick(rnd, CODE_CHARS.split(""));
  return s;
};

/**
 * Builds the static 3D world once (seeded). The camera moves through it;
 * nothing here depends on time, so every frame is deterministic.
 */
export const buildWorld = (seed: number): PlexusWorld => {
  const rnd = mulberry32(seed);

  // --- Network nodes ---
  const nodes: PlexusNode[] = [];
  const NODE_COUNT = 330;
  for (let i = 0; i < NODE_COUNT; i++) {
    const hub = rnd() < 0.2;
    const hasLabel = rnd() < (hub ? 0.9 : 0.45);
    nodes.push({
      x: range(rnd, WORLD_X[0], WORLD_X[1]),
      y: rnd() < 0.82 ? range(rnd, -9, 27) : range(rnd, -18, -9),
      z: range(rnd, WORLD_Z[0], WORLD_Z[1]),
      hub,
      brightness: hub ? range(rnd, 1.0, 1.25) : range(rnd, 0.6, 0.95),
      label: hasLabel ? makeLabel(rnd, 0.24) : null,
      labelSide: rnd() < 0.7 ? 1 : -1,
    });
  }

  // --- Edges: hubs throw several long lines (star patterns); ordinary
  // nodes hang off one or two nearby hubs. ---
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const addEdge = (a: number, b: number, strength: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, strength });
  };
  const dist = (p: Vec3, q: Vec3) => {
    const dx = p.x - q.x;
    const dy = (p.y - q.y) * 1.2;
    const dz = (p.z - q.z) * 0.9;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  const hubs = nodes.map((n, i) => (n.hub ? i : -1)).filter((i) => i >= 0);
  for (const h of hubs) {
    const n = nodes[h];
    const cands: number[] = [];
    nodes.forEach((m, j) => {
      const d = dist(n, m);
      if (j !== h && d > 8 && d < 52) cands.push(j);
    });
    const k = Math.floor(range(rnd, 3, 7));
    for (let c = 0; c < k && cands.length; c++) {
      const idx = Math.floor(rnd() * cands.length);
      addEdge(h, cands[idx], range(rnd, 0.7, 1));
      cands.splice(idx, 1);
    }
  }
  nodes.forEach((n, i) => {
    if (n.hub) return;
    const near = hubs
      .map((h) => ({ h, d: dist(n, nodes[h]) }))
      .filter((o) => o.d < 40)
      .sort((p, q) => p.d - q.d);
    const k = rnd() < 0.85 ? 1 : 2;
    for (let c = 0; c < Math.min(k, near.length); c++) addEdge(i, near[c].h, range(rnd, 0.5, 0.9));
  });

  // --- Out-of-focus bokeh, mostly in the lower half ---
  const bokeh: BokehParticle[] = [];
  for (let i = 0; i < 760; i++) {
    const floor = rnd() < 0.75;
    bokeh.push({
      x: range(rnd, WORLD_X[0] - 30, WORLD_X[1] + 30),
      y: floor ? range(rnd, -30, -7) : range(rnd, -6, 30),
      z: range(rnd, 6, 150),
      size: Math.pow(rnd(), 1.8) * 1.4 + 0.15,
      color: Math.floor(rnd() * 6),
      alpha: floor ? range(rnd, 0.3, 0.9) : range(rnd, 0.15, 0.5),
    });
  }

  // --- Nebula haze: large very soft clouds (lower centre) ---
  const nebula: NebulaBlob[] = [];
  for (let i = 0; i < 70; i++) {
    nebula.push({
      x: range(rnd, WORLD_X[0] - 40, WORLD_X[1] + 40),
      y: range(rnd, -16, 6),
      z: range(rnd, 35, 150),
      size: range(rnd, 10, 28),
      alpha: range(rnd, 0.06, 0.16),
      color: Math.floor(rnd() * 3),
    });
  }

  // --- Fine dust specks ---
  const dust: Vec3[] = [];
  for (let i = 0; i < 650; i++) {
    dust.push({ x: range(rnd, WORLD_X[0], WORLD_X[1]), y: range(rnd, -20, 28), z: range(rnd, 3, 130) });
  }

  // --- Dense "code column" readouts: rows of short text and bars ---
  const codeBlocks: CodeBlock[] = [];
  for (let i = 0; i < 120; i++) {
    const n = Math.floor(range(rnd, 8, 20));
    const rows: CodeBlock["rows"] = [];
    for (let l = 0; l < n; l++) {
      rows.push({
        text: rnd() < 0.55 ? codeLine(rnd) : "",
        bar: range(rnd, 0.2, 1),
        alpha: range(rnd, 0.45, 1),
      });
    }
    codeBlocks.push({
      x: range(rnd, WORLD_X[0], WORLD_X[1]),
      y: range(rnd, -12, 24),
      z: range(rnd, 6, 120),
      rows,
    });
  }

  // --- Free-floating numeric labels ---
  const freeLabels: FreeLabel[] = [];
  for (let i = 0; i < 150; i++) {
    freeLabels.push({
      x: range(rnd, WORLD_X[0], WORLD_X[1]),
      y: range(rnd, -14, 26),
      z: range(rnd, 6, 120),
      label: makeLabel(rnd, 0.2),
    });
  }

  // --- Long horizontal light streaks ---
  const streaks: Streak[] = [];
  for (let i = 0; i < 12; i++) {
    const cx = range(rnd, WORLD_X[0], WORLD_X[1]);
    const len = range(rnd, 90, 220);
    streaks.push({ y: range(rnd, -5, 9), z: range(rnd, 15, 120), x0: cx - len / 2, x1: cx + len / 2, alpha: range(rnd, 0.3, 0.75) });
  }

  return { nodes, edges, bokeh, nebula, dust, codeBlocks, freeLabels, streaks };
};

/** Deterministic label text at time t (some readouts tick like live data). */
export const labelText = (l: LabelSpec, t: number) => {
  const step = l.period > 0 ? Math.floor(t / l.period) : 0;
  const r = mulberry32(l.seed + step * 7919)();
  const base = mulberry32(l.seed)();
  const max = Math.pow(10, l.intDigits);
  const min = l.intDigits === 1 ? 0.1 : Math.pow(10, l.intDigits - 1);
  // The leading part stays stable; only the trailing digits change.
  const stable = min + base * (max - min);
  const jitter = (r - 0.5) * Math.pow(10, -1) * (l.intDigits === 1 ? 1 : 3);
  const v = Math.min(max - 0.001, Math.max(min, stable + jitter));
  return v.toFixed(l.decimals);
};
