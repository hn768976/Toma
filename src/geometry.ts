import {random} from 'remotion';
import type {NodeSpec, VariantConfig, VariantKey} from './variants';
import {DUR} from './motion';

export interface Vec {
  x: number;
  y: number;
}

export interface CurvePts {
  p0: Vec;
  c1: Vec;
  c2: Vec;
  p3: Vec;
}

/** One bezier of a dendrite tree. Trunks have depth 0; children nest. */
export interface Filament {
  curve: CurvePts;
  /** Unit perpendicular to the launch direction; drift displaces along it */
  perp: Vec;
  width: number;
  alpha: number;
  depth: number;
  /** Parameter on the parent curve where this branch attaches (0 for trunks) */
  branchT: number;
  children: Filament[];
  driftFreq: [number, number, number];
  driftPhase: [number, number, number];
  flash: boolean;
  /** DUR/flashPeriod must be an integer */
  flashFreq: number;
  flashPhase: number;
}

export interface Spike {
  angle: number;
  len: number;
  width: number;
  alphaFreq: number;
  alphaPhase: number;
}

export interface NodeRT extends NodeSpec {
  px: number;
  py: number;
  haloR: number;
  spikes: Spike[];
}

export interface Pulse {
  /** Frames for a full traversal of the path; divides 375 */
  period: number;
  phase: number;
  dir: 1 | -1;
  tail: boolean;
  size: number;
}

export interface ConnectionPath {
  aIndex: number;
  bIndex: number;
  junctionIndex: number;
  aStart: Vec;
  aC1: Vec;
  bEnd: Vec;
  bC2: Vec;
  junction: Vec;
  /** Shared tangent angle at the junction - both halves obey it */
  tanAngle: number;
  /** Control distances on either side of the junction */
  dIn: number;
  dOut: number;
  /** Unit perpendicular to the A-B axis; junction drifts along it */
  perp: Vec;
  width: number;
  alpha: number;
  driftFreq: [number, number];
  driftPhase: [number, number];
  pulses: Pulse[];
}

export interface Junction {
  pos: Vec;
  pulseFreq: number;
  pulsePhase: number;
}

export interface Particle {
  x: number;
  y: number;
  r: number;
  soft: boolean;
  family: 'cool' | 'warm' | 'white';
  alpha: number;
  fx: number;
  fy: number;
  ax: number;
  ay: number;
  phx: number;
  phy: number;
  twFreq: number;
  twPhase: number;
  inwardAmp: number;
}

export interface Scene {
  nodes: NodeRT[];
  /** Free (non-connecting) filament trunks, per node */
  filaments: Filament[][];
  connections: ConnectionPath[];
  junctions: Junction[];
  particles: Particle[];
}

export const cubicAt = (c: CurvePts, t: number): Vec => {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const cc = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * c.p0.x + b * c.c1.x + cc * c.c2.x + d * c.p3.x,
    y: a * c.p0.y + b * c.c1.y + cc * c.c2.y + d * c.p3.y,
  };
};

const cubicTangent = (c: CurvePts, t: number): number => {
  const mt = 1 - t;
  const dx =
    3 * mt * mt * (c.c1.x - c.p0.x) +
    6 * mt * t * (c.c2.x - c.c1.x) +
    3 * t * t * (c.p3.x - c.c2.x);
  const dy =
    3 * mt * mt * (c.c1.y - c.p0.y) +
    6 * mt * t * (c.c2.y - c.c1.y) +
    3 * t * t * (c.p3.y - c.c2.y);
  return Math.atan2(dy, dx);
};

/** Periods that divide the 375-frame loop, slowest first */
const PULSE_PERIODS = [375, 125, 75];

const intFreq = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1));

/**
 * Build one bezier curve of a dendrite, recursing into branches.
 * The first control point hugs the radial direction so filaments stay
 * tightly bundled at the core; the far control point and endpoint drift
 * off-axis for an organic bend. Lateral offsets stay well under the
 * radial travel, so a curve can never double back toward the node.
 */
const makeCurve = (
  seed: string,
  start: Vec,
  angle: number,
  len: number,
  width: number,
  alpha: number,
  depth: number,
  branchT: number,
  cfg: VariantConfig
): Filament => {
  const dir = {x: Math.cos(angle), y: Math.sin(angle)};
  const perp = {x: -dir.y, y: dir.x};
  const r = (k: string) => random(`${seed}-${k}`);

  const lat1 = (r('l1') - 0.5) * 2 * len * 0.05;
  const bendSign = r('bs') < 0.5 ? -1 : 1;
  const lat2 = bendSign * (0.07 + 0.16 * r('l2')) * len;
  const lat3 = lat2 * 1.55 + bendSign * (0.04 + 0.1 * r('l3')) * len;

  const curve: CurvePts = {
    p0: {x: start.x, y: start.y},
    c1: {x: start.x + dir.x * len * 0.28 + perp.x * lat1, y: start.y + dir.y * len * 0.28 + perp.y * lat1},
    c2: {x: start.x + dir.x * len * 0.62 + perp.x * lat2, y: start.y + dir.y * len * 0.62 + perp.y * lat2},
    p3: {x: start.x + dir.x * len + perp.x * lat3, y: start.y + dir.y * len + perp.y * lat3},
  };

  const filament: Filament = {
    curve,
    perp,
    width,
    alpha,
    depth,
    branchT,
    children: [],
    driftFreq: [intFreq(`${seed}-df1`, 1, 2), intFreq(`${seed}-df2`, 1, 3), intFreq(`${seed}-df3`, 1, 3)],
    driftPhase: [r('dp1'), r('dp2'), r('dp3')],
    flash: depth === 0 && r('fl') < cfg.filament.flashFraction,
    flashFreq: r('flp') < 0.6 ? 1 : 3,
    flashPhase: r('flph'),
  };

  if (depth < cfg.filament.maxDepth) {
    const nBranches =
      depth === 0
        ? 1 + (r('nb') < cfg.filament.branchProb ? 1 : 0)
        : r('nb') < 0.45
          ? 1
          : 0;
    for (let b = 0; b < nBranches; b++) {
      const bSeed = `${seed}-b${b}`;
      const tb = 0.34 + 0.36 * random(`${bSeed}-t`);
      const at = cubicAt(curve, tb);
      const tangent = cubicTangent(curve, tb);
      const side = random(`${bSeed}-s`) < 0.5 ? -1 : 1;
      // Shallow departure angle keeps the child reading as part of the tree
      const childAngle = tangent + side * (0.18 + 0.3 * random(`${bSeed}-a`));
      const childLen = len * (1 - tb) * (0.55 + 0.35 * random(`${bSeed}-l`)) + len * 0.12;
      filament.children.push(
        makeCurve(bSeed, at, childAngle, childLen, width * 0.55, alpha * 0.7, depth + 1, tb, cfg)
      );
    }
  }

  return filament;
};

const makeNodeFilaments = (
  key: VariantKey,
  nodeIdx: number,
  node: NodeRT,
  count: number,
  cfg: VariantConfig
): Filament[] => {
  const out: Filament[] = [];
  const f = cfg.filament;
  const lenScale = 0.55 + 0.45 * node.scale;
  for (let i = 0; i < count; i++) {
    const seed = `${key}-n${nodeIdx}-f${i}`;
    const angle = random(`${seed}-ang`) * Math.PI * 2;
    const len = (f.minLen + (f.maxLen - f.minLen) * Math.pow(random(`${seed}-len`), 0.85)) * lenScale;
    const startR = node.haloR * 0.06;
    const start = {
      x: node.px + Math.cos(angle) * startR,
      y: node.py + Math.sin(angle) * startR,
    };
    const width = f.baseWidth * (0.7 + 0.6 * random(`${seed}-w`)) * (0.6 + 0.4 * node.scale);
    const alpha = f.baseAlpha * (0.75 + 0.5 * random(`${seed}-al`));
    out.push(makeCurve(seed, start, angle, len, width, alpha, 0, 0, cfg));
  }
  return out;
};

const makeSpikes = (key: VariantKey, nodeIdx: number, node: NodeRT): Spike[] => {
  const seed = `${key}-n${nodeIdx}-spike`;
  const n = 8 + Math.floor(random(`${seed}-n`) * 4);
  const spikes: Spike[] = [];
  for (let i = 0; i < n; i++) {
    const s = `${seed}-${i}`;
    spikes.push({
      angle: random(`${s}-a`) * Math.PI * 2,
      len: node.haloR * (0.2 + 0.24 * random(`${s}-l`)),
      width: 2.5 + 2.5 * random(`${s}-w`),
      alphaFreq: intFreq(`${s}-f`, 2, 5),
      alphaPhase: random(`${s}-p`),
    });
  }
  return spikes;
};

const buildConnections = (
  key: VariantKey,
  cfg: VariantConfig,
  nodes: NodeRT[],
  width: number
): {connections: ConnectionPath[]; junctions: Junction[]; usedPerNode: number[]} => {
  const connections: ConnectionPath[] = [];
  const junctions: Junction[] = [];
  const usedPerNode = nodes.map(() => 0);
  const syn = cfg.synapse;
  if (cfg.connectionMode !== 'synaptic' || !syn) {
    return {connections, junctions, usedPerNode};
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i];
      const B = nodes[j];
      const distFrac = Math.hypot(A.px - B.px, A.py - B.py) / width;
      if (distFrac > syn.pairDistanceMax) {
        continue;
      }
      const pairSeed = `${key}-pair-${i}-${j}`;
      const abx = B.px - A.px;
      const aby = B.py - A.py;
      const abLen = Math.hypot(abx, aby);
      const perp = {x: -aby / abLen, y: abx / abLen};

      for (let jn = 0; jn < syn.junctionsPerPair; jn++) {
        const jSeed = `${pairSeed}-j${jn}`;
        const along = 0.42 + 0.16 * random(`${jSeed}-al`);
        const side = jn % 2 === 0 ? 1 : -1;
        const mag = (0.4 + 0.6 * random(`${jSeed}-m`)) * syn.junctionLateral;
        const J = {
          x: A.px + abx * along + perp.x * side * mag,
          y: A.py + aby * along + perp.y * side * mag,
        };
        const junctionIndex = junctions.length;
        junctions.push({
          pos: J,
          pulseFreq: DUR / PULSE_PERIODS[Math.floor(random(`${jSeed}-pp`) * PULSE_PERIODS.length)],
          pulsePhase: random(`${jSeed}-pph`),
        });

        for (let p = 0; p < syn.pathsPerJunction; p++) {
          const pSeed = `${jSeed}-p${p}`;
          const rot = (k: string, spread: number) => (random(`${pSeed}-${k}`) - 0.5) * 2 * spread;

          const aToJ = Math.atan2(J.y - A.py, J.x - A.px);
          const bToJ = Math.atan2(J.y - B.py, J.x - B.px);
          const aLaunch = aToJ + rot('ala', 0.45);
          const bLaunch = bToJ + rot('bla', 0.45);
          const aStart = {
            x: A.px + Math.cos(aLaunch) * A.haloR * 0.06,
            y: A.py + Math.sin(aLaunch) * A.haloR * 0.06,
          };
          const bEnd = {
            x: B.px + Math.cos(bLaunch) * B.haloR * 0.06,
            y: B.py + Math.sin(bLaunch) * B.haloR * 0.06,
          };
          const dAJ = Math.hypot(J.x - aStart.x, J.y - aStart.y);
          const dBJ = Math.hypot(J.x - bEnd.x, J.y - bEnd.y);
          // First control point hugs the radial launch direction (bundled core)
          const aC1 = {
            x: aStart.x + Math.cos(aLaunch + rot('ac', 0.2)) * dAJ * 0.32,
            y: aStart.y + Math.sin(aLaunch + rot('ac', 0.2)) * dAJ * 0.32,
          };
          const bC2 = {
            x: bEnd.x + Math.cos(bLaunch + rot('bc', 0.2)) * dBJ * 0.32,
            y: bEnd.y + Math.sin(bLaunch + rot('bc', 0.2)) * dBJ * 0.32,
          };
          const tanAngle = Math.atan2(aby, abx) + rot('tan', 0.35);

          const nPulses =
            syn.pulsesPerPathMin +
            Math.floor(random(`${pSeed}-np`) * (syn.pulsesPerPathMax - syn.pulsesPerPathMin + 1));
          const pulses: Pulse[] = [];
          for (let q = 0; q < nPulses; q++) {
            const qSeed = `${pSeed}-q${q}`;
            pulses.push({
              period: PULSE_PERIODS[random(`${qSeed}-per`) < 0.55 ? 2 : 1],
              phase: random(`${qSeed}-ph`),
              dir: random(`${qSeed}-d`) < 0.5 ? 1 : -1,
              tail: random(`${qSeed}-t`) < 0.4,
              size: 9 + 8 * random(`${qSeed}-s`),
            });
          }

          connections.push({
            aIndex: i,
            bIndex: j,
            junctionIndex,
            aStart,
            aC1,
            bEnd,
            bC2,
            junction: J,
            tanAngle,
            dIn: dAJ * 0.34,
            dOut: dBJ * 0.34,
            perp,
            width: cfg.filament.baseWidth * (0.8 + 0.5 * random(`${pSeed}-w`)),
            alpha: cfg.filament.baseAlpha * (0.85 + 0.35 * random(`${pSeed}-al`)),
            driftFreq: [intFreq(`${pSeed}-df1`, 1, 2), intFreq(`${pSeed}-df2`, 1, 3)],
            driftPhase: [random(`${pSeed}-dp1`), random(`${pSeed}-dp2`)],
            pulses,
          });
          usedPerNode[i] += 1;
          usedPerNode[j] += 1;
        }
      }
    }
  }
  return {connections, junctions, usedPerNode};
};

const makeParticles = (
  key: VariantKey,
  cfg: VariantConfig,
  width: number,
  height: number
): Particle[] => {
  const P = cfg.particles;
  const out: Particle[] = [];
  const warmCount = Math.round(P.count * P.warmFraction);
  for (let i = 0; i < P.count; i++) {
    const seed = `${key}-part-${i}`;
    const r = (k: string) => random(`${seed}-${k}`);
    const warm = i < warmCount;
    let x: number;
    let y: number;
    if (warm) {
      // Warm accents cluster instead of spreading evenly
      const c = P.warmClusters[Math.floor(r('cl') * P.warmClusters.length)];
      x = c.x * width + (r('cx') + r('cx2') - 1) * width * 0.1;
      y = c.y * height + (r('cy') + r('cy2') - 1) * height * 0.14;
    } else {
      x = r('x') * width;
      y = r('y') * height;
    }
    const soft = r('soft') < 0.4;
    out.push({
      x,
      y,
      r: soft ? 8 + 20 * r('r') : 1.6 + 3.4 * r('r'),
      soft,
      family: warm ? 'warm' : r('fam') < 0.25 ? 'white' : 'cool',
      alpha: soft ? 0.1 + 0.22 * r('a') : 0.3 + 0.5 * r('a'),
      fx: intFreq(`${seed}-fx`, 1, 3),
      fy: intFreq(`${seed}-fy`, 1, 3),
      ax: P.driftAmp * (0.4 + 0.9 * r('ax')),
      ay: P.driftAmp * (0.4 + 0.9 * r('ay')),
      phx: r('phx'),
      phy: r('phy'),
      twFreq: intFreq(`${seed}-tw`, 1, 4),
      twPhase: r('twp'),
      inwardAmp: P.inwardPull > 0 ? P.inwardPull * (0.5 + r('in')) : 0,
    });
  }
  return out;
};

/** Build the full seeded scene once; per-frame code only applies motion offsets. */
export const buildScene = (
  key: VariantKey,
  cfg: VariantConfig,
  width: number,
  height: number
): Scene => {
  const nodes: NodeRT[] = cfg.nodes.map((n, idx) => {
    const rt: NodeRT = {
      ...n,
      px: n.x * width,
      py: n.y * height,
      haloR: cfg.baseNodeHalo * n.scale,
      spikes: [],
    };
    rt.spikes = makeSpikes(key, idx, rt);
    return rt;
  });

  const {connections, junctions, usedPerNode} = buildConnections(key, cfg, nodes, width);

  // Connection curves count against each node's filament budget so the
  // frame doesn't become an unreadable mat.
  const filaments = nodes.map((node, idx) => {
    const freeCount = Math.max(10, node.filamentCount - usedPerNode[idx]);
    return makeNodeFilaments(key, idx, node, freeCount, cfg);
  });

  return {
    nodes,
    filaments,
    connections,
    junctions,
    particles: makeParticles(key, cfg, width, height),
  };
};
