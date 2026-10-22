import * as THREE from "three";
import counts from "../../../data/counts.json";
import { irange, mulberry32, pick, range } from "../../lib/random";
import { GeoBuilder, V3, pathToRoot, polyline } from "./geometry";
import { Neuron, addNeuron, makeNeuron } from "./neuron";

export const LOOP = 600;
export const FOV = 40;
export const TILE = 18; // world units: one tile of the repeating layout
const NEAR_Z = 6;
const FAR_Z = 17;
const BLUR_Z = 13.5; // farther than this: the soft layer

export type Layout = {
  neurons: Neuron[];
  near: THREE.BufferGeometry;
  far: THREE.BufferGeometry;
  paths: { dend: ReturnType<typeof polyline>[]; axon: ReturnType<typeof polyline> }[];
  events: { t: number; n: number; dend: number[]; dendDur: number[]; axonDur: number }[];
};

export const buildLayout = (): Layout => {
  const rng = mulberry32(0x0e0_7a11);
  const N = counts.neuronNetwork.neuronsPerTile;
  const neurons: Neuron[] = [];
  const nearB = new GeoBuilder();
  const farB = new GeoBuilder();
  const tanH = Math.tan(((FOV / 2) * Math.PI) / 180);
  for (let i = 0; i < N; i++) {
    const depth = range(rng, NEAR_Z, FAR_Z);
    const x = (i + rng()) * (TILE / N);
    const y = range(rng, -0.95, 0.95) * depth * tanH + 0.12 * depth * tanH;
    const scale = range(rng, 0.65, 1.05);
    const axDown = rng() < 0.9;
    const axonDir: V3 = axDown ? [range(rng, -0.25, 0.25), -1, range(rng, -0.2, 0.2)] : [range(rng, -0.6, 0.6), 1, 0];
    const n = makeNeuron(rng, {
      id: i,
      center: [x, y, -depth],
      R: 0.2 * scale,
      nDend: irange(rng, counts.neuronNetwork.dendritesMin, counts.neuronNetwork.dendritesMax),
      dend: {
        rootLen: 0.46 * scale,
        rootRadius: 0.015 * scale,
        tipRadius: 0.0011,
        maxDepth: rng() < 0.8 ? 3 : counts.neuronNetwork.branchDepth,
        segLen: 0.045,
        wiggle: 0.28,
        spread: [0.3, 0.75],
        shrink: [0.62, 0.86],
      },
      apical: { dir: [range(rng, -0.25, 0.25), 1, 0], lenMul: 1.6 },
      axon: {
        dir: axonDir,
        length: range(rng, 1.2, 3.4) * scale,
        r0: 0.012 * scale,
        r1: 0.007 * scale,
        wiggle: 0.12,
        segLen: 0.12,
        terminals: {
          rootLen: 0.18,
          rootRadius: 0.004,
          tipRadius: 0.0014,
          maxDepth: 2,
          segLen: 0.05,
          wiggle: 0.3,
          spread: [0.3, 0.7],
          shrink: [0.6, 0.85],
        },
      },
      seed: i,
    });
    neurons.push(n);
    addNeuron(depth > BLUR_Z ? farB : nearB, n, { somaDetail: 3 });
  }
  // Signal paths: a few dendrite leaves to the soma, and the axon.
  const paths = neurons.map((n) => ({
    dend: Array.from({ length: 6 }, () => polyline(pathToRoot(n.branches, pick(rng, n.leaves)).concat([n.center]))),
    axon: polyline([n.center, ...n.branches[n.axon].pts]),
  }));
  // Events on a 600-frame period: ~15 sparks in flight at any time.
  const events: Layout["events"] = [];
  const nEvents = 40;
  const candidates = neurons.filter((n) => -n.center[2] < BLUR_Z + 1).map((n) => n.id);
  for (let e = 0; e < nEvents; e++) {
    const k = irange(rng, 2, 4);
    events.push({
      t: Math.floor((e + rng() * 0.8) * (LOOP / nEvents)),
      n: pick(rng, candidates),
      dend: Array.from({ length: k }, () => irange(rng, 0, 5)),
      dendDur: Array.from({ length: k }, () => range(rng, 36, 54)),
      axonDur: range(rng, 60, 90),
    });
  }
  return { neurons, near: nearB.build(), far: farB.build(), paths, events };
};

let layoutCache: Layout | null = null;
export const layout = () => (layoutCache ??= buildLayout());

