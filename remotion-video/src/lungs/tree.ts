import { random } from "remotion";
import {
  Lobe,
  Point,
  boundsOf,
  pointInPolygon,
} from "./anatomy";
import { LungVariant } from "./variants";

/**
 * Recursive, seeded bronchial tree. Grown once per variant and memoised — if
 * this ran per frame the whole tree would writhe.
 */

export type Branch = {
  d: string;
  width: number;
  depth: number;
  /** Junction at the far end of this segment (where its children start). */
  end: Point;
  terminal: boolean;
};

export type ConstrictionNode = {
  x: number;
  y: number;
  r: number;
};

export type LungTree = {
  branches: Branch[];
  /** Endpoints of the finest branches — the particles cluster around these. */
  tips: Point[];
  nodes: ConstrictionNode[];
};

const rr = (seed: string, min: number, max: number) => min + random(seed) * (max - min);

const DEG = Math.PI / 180;

export const growTree = (lobe: Lobe, variant: LungVariant): LungTree => {
  const cfg = variant.tree;
  const branches: Branch[] = [];
  const tips: Point[] = [];
  const junctions: Point[] = [];

  const inward = (from: Point, angle: number): number => {
    // Angle that would point straight at the lobe's centre of mass.
    const toCentre = Math.atan2(lobe.centroid.y - from.y, lobe.centroid.x - from.x);
    let delta = toCentre - angle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return delta;
  };

  const grow = (
    from: Point,
    angle: number,
    length: number,
    width: number,
    depth: number,
    seed: string,
  ) => {
    let a = angle;
    let len = length;

    // Bias away from the lobe wall: if this segment would land outside the
    // grow polygon, swing it back toward the centre and shorten it. Up to six
    // attempts, then give up and let the clip path handle it.
    for (let attempt = 0; attempt < 6; attempt++) {
      const test = { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
      if (pointInPolygon(test, lobe.growPolygon)) break;
      a += inward(from, a) * 0.42;
      len *= 0.86;
    }

    const end: Point = { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };

    // Segments bow slightly to one side; straight lines read as a circuit
    // diagram rather than an airway.
    const curl = rr(`${seed}-curl`, -0.17, 0.17) * len;
    const mid = { x: (from.x + end.x) / 2, y: (from.y + end.y) / 2 };
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const ctrl = { x: mid.x + nx * curl, y: mid.y + ny * curl };

    const terminal = depth >= cfg.depth;
    branches.push({
      d: `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${ctrl.x.toFixed(2)} ${ctrl.y.toFixed(
        2,
      )} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      width,
      depth,
      end,
      terminal,
    });

    if (terminal) {
      tips.push(end);
      return;
    }
    junctions.push(end);

    // Direction of travel at the end of a curved segment, so children leave
    // the parent tangentially rather than kinking.
    const exitAngle = Math.atan2(end.y - ctrl.y, end.x - ctrl.x);

    // Nominal 35 degree split, varied by +/-20 degrees per side and per seed.
    // The first two generations open much wider so the tree reaches the apex
    // as well as the base, the way lobar bronchi actually divide.
    const nominal = depth === 1 ? 52 : depth === 2 ? 42 : 35;
    const spreadA = (nominal + rr(`${seed}-a1`, -20, 20)) * DEG;
    const spreadB = (nominal + rr(`${seed}-a2`, -20, 20)) * DEG;

    // Lengths vary independently of the angles, and one child is usually the
    // longer of the pair.
    const base = len * cfg.lengthFactor;
    const swap = random(`${seed}-swap`) < 0.5;
    const longer = base * rr(`${seed}-l1`, 0.98, 1.18);
    const shorter = base * rr(`${seed}-l2`, 0.66, 0.9);

    const childWidth = Math.max(cfg.minWidth, width * cfg.widthFactor);

    grow(
      end,
      exitAngle - spreadA,
      swap ? longer : shorter,
      childWidth,
      depth + 1,
      `${seed}-0`,
    );
    grow(
      end,
      exitAngle + spreadB,
      swap ? shorter : longer,
      childWidth,
      depth + 1,
      `${seed}-1`,
    );
  };

  grow(lobe.hilum, lobe.rootAngle, cfg.rootLength, cfg.rootWidth, 1, lobe.treeSeed);

  // Constriction nodes: thickened dark lumps at a scattering of junctions.
  const nodes: ConstrictionNode[] = [];
  if (cfg.nodeCount > 0 && junctions.length > 0) {
    const used = new Set<number>();
    for (let i = 0; i < cfg.nodeCount; i++) {
      let idx = Math.floor(random(`${lobe.treeSeed}-node-${i}`) * junctions.length);
      let guard = 0;
      while (used.has(idx) && guard++ < 24) {
        idx = (idx + 7) % junctions.length;
      }
      used.add(idx);
      const j = junctions[idx];
      nodes.push({
        x: j.x,
        y: j.y,
        r: rr(`${lobe.treeSeed}-node-r-${i}`, cfg.nodeMinRadius, cfg.nodeMaxRadius),
      });
    }
  }

  return { branches, tips, nodes };
};

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

export type Particle = {
  /** Index of the lobe this speck belongs to. */
  lobe: number;
  x: number;
  y: number;
  size: number;
  bright: boolean;
  opacity: number;
  /** Unit vector away from the lobe centroid — the breath carries them along it. */
  outX: number;
  outY: number;
  /** Closed drift path. Integer frequencies, so every path shuts at frame 420. */
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  radiusX: number;
  radiusY: number;
  /** Integer frequency for the opacity flicker. */
  fadeFreq: number;
  fadePhase: number;
};

export const scatterParticles = (
  lobes: Lobe[],
  trees: LungTree[],
  variant: LungVariant,
  hilum: Point,
): Particle[] => {
  const cfg = variant.particles;
  const out: Particle[] = [];
  const perLobe = Math.round(cfg.count / lobes.length);

  lobes.forEach((lobe, li) => {
    const tips = trees[li].tips;
    const bounds = boundsOf(lobe.polygon);
    const n = li === lobes.length - 1 ? cfg.count - out.length : perLobe;

    for (let i = 0; i < n; i++) {
      const s = `${lobe.treeSeed}-p-${i}`;
      let x = 0;
      let y = 0;

      if (tips.length > 0 && random(`${s}-mode`) < cfg.tipBias) {
        // Denser near the branch tips.
        const tip = tips[Math.floor(random(`${s}-tip`) * tips.length)];
        const ang = random(`${s}-ta`) * Math.PI * 2;
        const rad = Math.pow(random(`${s}-tr`), 0.6) * 110;
        x = tip.x + Math.cos(ang) * rad;
        y = tip.y + Math.sin(ang) * rad;
      } else {
        // Rejection-sample the rest across the lobe.
        for (let k = 0; k < 40; k++) {
          x = rr(`${s}-x-${k}`, bounds.minX, bounds.maxX);
          y = rr(`${s}-y-${k}`, bounds.minY, bounds.maxY);
          if (pointInPolygon({ x, y }, lobe.polygon)) break;
        }
      }

      // Sluggish air never reaches the periphery: pull the whole field back in
      // toward the hilum.
      if (cfg.hilumPull > 0) {
        const k = cfg.hilumPull * rr(`${s}-pull`, 0.55, 1);
        x += (hilum.x - x) * k;
        y += (hilum.y - y) * k;
      }

      const dx = x - lobe.centroid.x;
      const dy = y - lobe.centroid.y;
      const len = Math.hypot(dx, dy) || 1;

      out.push({
        lobe: li,
        x,
        y,
        size: rr(`${s}-size`, cfg.minSize, cfg.maxSize),
        bright: random(`${s}-bright`) < cfg.brightShare,
        opacity: cfg.baseOpacity * rr(`${s}-op`, 0.55, 1.35),
        outX: dx / len,
        outY: dy / len,
        freqX: 1 + Math.floor(random(`${s}-fx`) * 2),
        freqY: 1 + Math.floor(random(`${s}-fy`) * 2),
        phaseX: random(`${s}-px`),
        phaseY: random(`${s}-py`),
        radiusX: cfg.driftRadius * rr(`${s}-rx`, 0.5, 1.4),
        radiusY: cfg.driftRadius * rr(`${s}-ry`, 0.5, 1.4),
        fadeFreq: 1 + Math.floor(random(`${s}-ff`) * 3),
        fadePhase: random(`${s}-fp`),
      });
    }
  });

  return out;
};
