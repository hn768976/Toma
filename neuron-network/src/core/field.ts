/**
 * Assembles a whole neuron field for one look, once.
 *
 * Everything here runs at build time from a seeded RNG and is cached at
 * module level, so the geometry exists before any frame is rendered and is
 * identical on every thread. If branch geometry is ever rebuilt inside a
 * render, that is the bug.
 */

import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { growNeuron, makeTreePulse } from "./branching";
import { mulberry32, range } from "./random";
import { buildSomaGeometry } from "./soma";
import { buildTubeGeometry } from "./tube";
import type { Field, Neuron, Particle } from "./types";
import { HEIGHT, WIDTH } from "../looks/looks";
import type { Look } from "../looks/types";

export type BuiltField = {
  neurons: Neuron[];
  tubes: BufferGeometry;
  somas: BufferGeometry;
  particles: BufferGeometry | null;
  sparks: BufferGeometry | null;
  stats: Field["stats"];
};

/**
 * Screen-space placement.
 *
 * Scattering neurons through a world-space box leaves visible holes: a box
 * that covers the frame at one depth under-fills it at another, because the
 * frustum widens with distance. Sampling a screen position and a depth, then
 * projecting out to that depth, gives even coverage at every layer -- which
 * is what lets look 4 reach all four frame edges.
 *
 * `spreadX` / `spreadY` are fractions of the frame: 1.0 exactly fills it.
 */
const screenToWorld = (
  look: Look,
  ndcX: number,
  ndcY: number,
  z: number,
  aspect: number,
) => {
  const cam = look.camera.position;
  const dist = Math.max(0.5, cam[2] - z);
  const halfHeight = Math.tan(((look.camera.fov / 2) * Math.PI) / 180) * dist;
  const halfWidth = halfHeight * aspect;
  return new Vector3(
    cam[0] + ndcX * halfWidth * look.field.spreadX,
    cam[1] + ndcY * halfHeight * look.field.spreadY,
    z,
  );
};

const placeNeurons = (look: Look, seed: number) => {
  const rng = mulberry32(seed);
  const f = look.field;
  const aspect = WIDTH / HEIGHT;
  const placed: { center: Vector3; radius: number }[] = [];

  if (f.hero) {
    placed.push({
      center: new Vector3(...f.heroCenter),
      radius: f.heroRadius,
    });
  }

  // Stratify over the frame: a grid sized to the neuron count, one cell each,
  // jittered inside the cell. Uniform sampling at these counts reliably
  // leaves a hole somewhere, and look 4 is judged on reaching all four edges.
  const remaining = f.neuronCount - placed.length;
  const cols = Math.max(1, Math.round(Math.sqrt(remaining * aspect)));
  const rows = Math.max(1, Math.ceil(remaining / cols));

  const cells: number[] = [];
  for (let i = 0; i < cols * rows; i++) cells.push(i);
  // Shuffle so depth assignment does not correlate with screen position.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  for (let n = 0; n < remaining; n++) {
    const cell = cells[n % cells.length];
    const cx = cell % cols;
    const cy = Math.floor(cell / cols);
    const ndcX = ((cx + range(rng, 0.12, 0.88)) / cols) * 2 - 1;
    const ndcY = ((cy + range(rng, 0.12, 0.88)) / rows) * 2 - 1;
    const z = range(rng, f.zFar, f.zNear);
    placed.push({
      center: screenToWorld(look, ndcX, ndcY, z, aspect),
      radius: f.radius * range(rng, 0.75, 1.25),
    });
  }

  return placed;
};

export const buildField = (look: Look): BuiltField => {
  const placed = placeNeurons(look, look.seed);
  const rng = mulberry32(look.seed ^ 0x5f3a91);
  const f = look.field;

  const neurons: Neuron[] = placed.map((slot, i) => {
    // Detail falls off with depth. Background neurons are blurred past
    // recognition, so full branch depth there is wasted render time.
    const depthT = Math.min(
      1,
      Math.max(0, (f.zNear - slot.center.z) / Math.max(1e-6, f.zNear - f.zFar)),
    );
    const detail = f.hero && i === 0 ? 1 : 1 - depthT * 0.55;
    const depthDrop = Math.round(depthT * f.backgroundDepthDrop);

    const scale = slot.radius / Math.max(1e-6, look.grow.somaRadius);
    const grown = growNeuron(
      {
        ...look.grow,
        somaRadius: slot.radius,
        // Scale the whole cell with its soma, so a smaller neuron is a
        // smaller cell rather than a small ball with full-length dendrites.
        // The reference is the soma size the grow row was authored for --
        // scaling against the background radius would inflate a hero cell.
        baseRadius: look.grow.baseRadius * scale,
        baseLength: look.grow.baseLength * scale,
      },
      slot.center,
      (look.seed * 7919 + i * 104729) >>> 0,
      look.grow.maxDepth - depthDrop,
    );

    const treeCount = Math.max(
      1,
      ...grown.branches.map((b) => b.treeIndex + 1),
    );
    const trees = Array.from({ length: treeCount }, () =>
      makeTreePulse(rng, look.pulse.slots, look.pulse.counts, look.pulse.amplitude),
    );

    return { ...grown, trees, somaPhase: rng() * Math.PI * 2, detail };
  });

  const { geometry: tubes, stats: tubeStats } = buildTubeGeometry(neurons, {
    radialCap: look.tube.radialCap,
    subdivisions: look.tube.subdivisions,
    baseRadius: look.grow.baseRadius,
    tipRadius: look.grow.tipRadius,
    tipTaperPower: look.grow.tipTaperPower,
    myelinAmplitude: look.tube.myelinAmplitude,
    myelinPeriod: look.tube.myelinPeriod,
    myelinFraction: look.tube.myelinFraction,
  });

  const { geometry: somas, triangleCount: somaTriangleCount } =
    buildSomaGeometry(neurons, look.soma, look.seed ^ 0x1b7f31);

  const particles = buildParticles(look, neurons, mulberry32(look.seed ^ 0x2c9e11));
  const sparks = buildSparks(look, neurons, mulberry32(look.seed ^ 0x77d3a5));

  return {
    neurons,
    tubes,
    somas,
    particles: particles.geometry,
    sparks: sparks.geometry,
    stats: {
      neuronCount: neurons.length,
      ...tubeStats,
      somaTriangleCount,
      particleCount: particles.count,
      sparkCount: sparks.count,
      junctionCount: neurons.reduce((n, x) => n + x.junctions.length, 0),
    },
  };
};

const buildParticles = (
  look: Look,
  neurons: Neuron[],
  rng: () => number,
): { geometry: BufferGeometry | null; count: number } => {
  const cfg = look.particles;
  if (cfg.count <= 0) return { geometry: null, count: 0 };

  const items: Particle[] = [];

  // Pool of dendrite points, for looks whose particles cluster on the fibres.
  const fibrePoints: Vector3[] = [];
  if (cfg.alongFibres) {
    for (const n of neurons) {
      for (const b of n.branches) {
        if (rng() < 0.35) fibrePoints.push(b.points[b.points.length - 1]);
      }
    }
  }

  for (let i = 0; i < cfg.count; i++) {
    let center: Vector3;
    if (cfg.alongFibres && fibrePoints.length > 0) {
      const src = fibrePoints[Math.floor(rng() * fibrePoints.length) % fibrePoints.length];
      center = src
        .clone()
        .add(
          new Vector3(
            (rng() - 0.5) * cfg.spread,
            (rng() - 0.5) * cfg.spread,
            (rng() - 0.5) * cfg.spread,
          ),
        );
    } else {
      center = screenToWorld(
        look,
        range(rng, -1.1, 1.1),
        range(rng, -1.1, 1.1),
        range(rng, look.field.zFar, look.field.zNear + 2),
        WIDTH / HEIGHT,
      );
    }

    items.push({
      center,
      amp: new Vector3(
        range(rng, 0.2, 1) * cfg.amplitude,
        range(rng, 0.2, 1) * cfg.amplitude,
        range(rng, 0.2, 1) * cfg.amplitude,
      ),
      // Integer frequencies, so every particle path closes over the loop.
      freq: new Vector3(
        1 + Math.floor(rng() * 2),
        1 + Math.floor(rng() * 2),
        1 + Math.floor(rng() * 2),
      ),
      phase: new Vector3(rng(), rng(), rng()),
      size: cfg.size * range(rng, 0.45, 1.55),
      brightness: cfg.brightness * range(rng, 0.4, 1.3),
    });
  }

  const geometry = new BufferGeometry();
  const pos = new Float32Array(items.length * 3);
  const amp = new Float32Array(items.length * 3);
  const freq = new Float32Array(items.length * 3);
  const phase = new Float32Array(items.length * 3);
  const misc = new Float32Array(items.length * 2);
  items.forEach((p, i) => {
    pos.set([p.center.x, p.center.y, p.center.z], i * 3);
    amp.set([p.amp.x, p.amp.y, p.amp.z], i * 3);
    freq.set([p.freq.x, p.freq.y, p.freq.z], i * 3);
    phase.set([p.phase.x, p.phase.y, p.phase.z], i * 3);
    misc.set([p.size, p.brightness], i * 2);
  });
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("aAmp", new BufferAttribute(amp, 3));
  geometry.setAttribute("aFreq", new BufferAttribute(freq, 3));
  geometry.setAttribute("aPhase", new BufferAttribute(phase, 3));
  geometry.setAttribute("aMisc", new BufferAttribute(misc, 2));
  geometry.computeBoundingSphere();
  return { geometry, count: items.length };
};

/** Star-shaped flashes at branch junctions -- look 4's signature. */
const buildSparks = (
  look: Look,
  neurons: Neuron[],
  rng: () => number,
): { geometry: BufferGeometry | null; count: number } => {
  if (look.sparks.count <= 0) return { geometry: null, count: 0 };

  const pool: Vector3[] = [];
  for (const n of neurons) pool.push(...n.junctions);
  if (pool.length === 0) return { geometry: null, count: 0 };

  const count = Math.min(look.sparks.count, pool.length);
  const chosen: Vector3[] = [];
  const stride = pool.length / count;
  for (let i = 0; i < count; i++) {
    chosen.push(pool[Math.min(pool.length - 1, Math.floor(i * stride + rng() * stride))]);
  }

  const pos = new Float32Array(count * 3);
  const misc = new Float32Array(count * 3);
  chosen.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    misc.set(
      [
        rng() * Math.PI * 2, // phase
        look.sparks.size * range(rng, 0.6, 1.6), // size
        rng() * Math.PI * 2, // rotation of the star
      ],
      i * 3,
    );
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("aMisc", new BufferAttribute(misc, 3));
  geometry.computeBoundingSphere();
  return { geometry, count };
};

/**
 * Module-level cache. The field for a look is built on first use and reused
 * for every frame on that thread; a cold thread rebuilds it from the same
 * seed and gets the same result, which is what keeps frame 300 rendered
 * alone byte-identical to frame 300 of a full sequential render.
 */
const cache = new Map<string, BuiltField>();

export const getField = (look: Look): BuiltField => {
  const hit = cache.get(look.id);
  if (hit) return hit;
  const built = buildField(look);
  cache.set(look.id, built);
  return built;
};
